#!/usr/bin/env python3
"""Reject experimental artifacts, undeclared media, and repository size regressions."""
import argparse
import json
import re
from pathlib import PurePosixPath
import subprocess

MEDIA = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.webm',
         '.blend', '.ora', '.psd', '.ase', '.aseprite', '.zip', '.7z', '.tar',
         '.gz', '.pdf', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.asf',
         '.amc', '.mhclo', '.obj', '.fbx', '.glb', '.gltf', '.bin'}
LOCAL_ROOTS = {'.scratch', '.lab', '.agents', '.build', '.rev', '.minimax',
               '.zcode', '.shots', 'hero-candidates', 'tmp', 'temp', 'artifacts',
               'outputs', 'captures', 'screenshots', 'node_modules'}
SOURCE = {'.html', '.css', '.js', '.mjs', '.py', '.md'}


def git(*args, input=None):
    return subprocess.check_output(['git', *args], input=input)


def allowed(path, registered):
    parts = PurePosixPath(path).parts
    if any(p in {'node_modules', '__pycache__'} for p in parts) or parts[0] in LOCAL_ROOTS:
        return False
    if path.startswith('docs/research/') and (re.search(r'-(validation|checks|audit|study)\.json$', path)
                                             or ('cleanup' in path and path.endswith('.json'))):
        return False
    if path in registered:
        return True
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in MEDIA or suffix in {'.log', '.pyc', '.pyo', '.blend1', '.blend2'}:
        return False
    if parts[0] == 'prototypes':
        return ('candidates' not in parts and
                (suffix in SOURCE or path.endswith(('.spec.json', '.recipe.json'))))
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--staged', action='store_true')
    parser.add_argument('--history', action='store_true')
    args = parser.parse_args()
    policy = json.loads(git('show', ':config/repository-assets.json' if args.staged
                            else 'HEAD:config/repository-assets.json'))
    registered = set(policy['assets'])
    if any(not entry.get('purpose') for entry in policy['assets'].values()):
        raise SystemExit('Every registered asset needs a concrete purpose')
    errors = []
    if args.history:
        for path in set(git('log', '--all', '--format=', '--name-only').decode().splitlines()):
            if path and not allowed(path, registered):
                errors.append('Forbidden historical artifact path: ' + path)
        entries = git('rev-list', '--objects', '--all').splitlines()
        rows = []
        for entry in entries:
            fields = entry.split(b' ', 1)
            if len(fields) == 2:
                rows.append((fields[0].decode(), fields[1].decode()))
    elif args.staged:
        rows = []
        for entry in git('ls-files', '--stage', '-z').split(b'\0'):
            if not entry:
                continue
            meta, path = entry.split(b'\t', 1)
            mode, oid, stage = meta.split()
            if stage != b'0':
                errors.append('Unresolved index entry: ' + path.decode())
            if mode != b'160000':
                rows.append((oid.decode(), path.decode()))
    else:
        rows = []
        for entry in git('ls-tree', '-r', '-z', 'HEAD').split(b'\0'):
            if not entry:
                continue
            meta, path = entry.split(b'\t', 1)
            mode, kind, oid = meta.split()
            if kind == b'blob':
                rows.append((oid.decode(), path.decode()))
    info = git('cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)',
               input=('\n'.join(oid for oid, path in rows) + '\n').encode()).splitlines()
    total = 0
    for (oid, path), meta in zip(rows, info):
        _, kind, size = meta.split()
        if kind != b'blob':
            continue
        size = int(size)
        total += size
        if not allowed(path, registered):
            errors.append('Forbidden or unregistered artifact: ' + path)
        if size > policy['maxFileBytes']:
            errors.append('File exceeds size budget: ' + path)
    budget = policy['maxHistoryBlobBytes'] if args.history else policy['maxTreeBytes']
    if total > budget:
        errors.append('Repository budget exceeded: ' + str(total) + ' > ' + str(budget))
    if errors:
        raise SystemExit('\n'.join(errors[:30]))
    print('Repository hygiene passed: ' + str(len(rows)) + ' objects, ' +
          str(round(total / 1048576, 2)) + ' MiB')


if __name__ == '__main__':
    main()
