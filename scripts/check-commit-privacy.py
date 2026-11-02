#!/usr/bin/env python3
"""Enforce anonymous commit identity and reject private machine details."""
import argparse, io, re, subprocess, sys
NAME = b"SeasonTemple"
EMAIL = b"46681958+SeasonTemple@users.noreply.github.com"
PATTERNS = [
    re.compile(rb"[A-Za-z]:[/\\]+Users[/\\]+[^/\\\r\n]+", re.I),
    re.compile(rb"[A-Z0-9._%+-]+@lenovo\.com", re.I),
    re.compile(rb"\b10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]+"),
]
def git(*args, input=None):
    return subprocess.check_output(["git", *args], input=input)
def check_data(data, label):
    if b"\0" not in data and any(p.search(data) for p in PATTERNS):
        raise SystemExit("Privacy check rejected private details in " + label)
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staged", action="store_true")
    parser.add_argument("--history", action="store_true")
    args = parser.parse_args()
    if args.staged:
        for kind in ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]:
            ident = git("var", kind)
            if not ident.startswith(NAME + b" <" + EMAIL + b"> "):
                raise SystemExit("Privacy check: use repository anonymous name/email for author AND committer")
        entries = []
        for entry in git("ls-files", "--stage", "-z").split(b"\0"):
            if not entry: continue
            meta, path = entry.split(b"\t", 1)
            mode, oid, stage = meta.split()
            if mode == b"160000": continue
            entries.append((oid, path))
        if entries:
            data = io.BytesIO(git("cat-file", "--batch", input=b"\n".join(oid for oid, path in entries) + b"\n"))
            for oid, path in entries:
                header = data.readline().split()
                content = data.read(int(header[2]))
                data.read(1)
                check_data(content, "staged file " + path.decode(errors="replace"))
    if args.history:
        for line in git("log", "--all", "--format=%H%x09%an%x09%ae%x09%cn%x09%ce").splitlines():
            oid, an, ae, cn, ce = line.split(b"\t")
            if (an, ae, cn, ce) != (NAME, EMAIL, NAME, EMAIL):
                raise SystemExit("Privacy check: non-anonymous history at " + oid[:12].decode())
        for line in git("for-each-ref", "--format=%(refname)%09%(taggername)%09%(taggeremail)", "refs/tags").splitlines():
            ref, name, email = line.split(b"\t")
            if name and (name, email) != (NAME, b"<" + EMAIL + b">"):
                raise SystemExit("Privacy check: non-anonymous annotated tag " + ref.decode())
    if not args.staged and not args.history:
        for path in git("ls-files", "-z").split(b"\0"):
            if not path: continue
            try:
                with open(path.decode(), "rb") as f: check_data(f.read(), "tracked file " + path.decode(errors="replace"))
            except (FileNotFoundError, IsADirectoryError): pass
    print("Privacy check passed")
if __name__ == "__main__": main()
