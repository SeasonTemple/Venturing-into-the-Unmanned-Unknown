"""Reimport complete painted pose layers, including silhouette corrections.

Unlike the earlier alpha-preserving retouch exporter, this path allows artists
to redraw trousers, shoes or the whole body in the saved pose ORA. It does not
regenerate those layers from the contour recipe. Upstream inputs stay pinned;
technical checks do not approve the artwork or motion.
"""
import argparse
import hashlib
import io
import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring

from PIL import Image, ImageChops

from actor_pose_review import write_review_sheet

ROOT = Path(__file__).resolve().parents[1]


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba_hash(im):
    return hashlib.sha256(im.convert('RGBA').tobytes()).hexdigest()


def read_painted_pose(path, canvas, required_names):
    """Honor full-canvas offsets and normal-blend layer order, not cached PNGs."""
    with zipfile.ZipFile(path) as archive:
        root = fromstring(archive.read('stack.xml'))
        if (int(root.get('w')), int(root.get('h'))) != canvas:
            raise ValueError('Pose canvas changed: ' + path.name)
        stack = root.find('stack')
        if stack is None or any(node.tag != 'layer' for node in stack):
            raise ValueError('Export a flat normal-blend layer stack: ' + path.name)
        if (stack.get('composite-op', 'svg:src-over') != 'svg:src-over'
                or float(stack.get('opacity', '1')) != 1
                or stack.get('visibility', 'visible') != 'visible'):
            raise ValueError('Keep the root paint stack visible at normal blend and full opacity: ' + path.name)
        nodes = list(reversed(list(stack)))
        names = [node.get('name', '') for node in nodes]
        if len(set(names)) != len(names) or not set(required_names).issubset(names):
            raise ValueError('Keep original layer names unique; additional paint layers are allowed: ' + path.name)
        result = Image.new('RGBA', canvas)
        for node in nodes:
            if node.get('composite-op', 'svg:src-over') != 'svg:src-over':
                raise ValueError('Rasterize non-normal blend modes: ' + path.name)
            if node.get('visibility', 'visible') not in ['visible', 'hidden']:
                raise ValueError('Invalid layer visibility: ' + path.name)
            if node.get('visibility', 'visible') == 'hidden':
                continue
            opacity = float(node.get('opacity', '1'))
            if not 0 <= opacity <= 1:
                raise ValueError('Invalid layer opacity: ' + path.name)
            im = Image.open(io.BytesIO(archive.read(node.get('src')))).convert('RGBA')
            if opacity != 1:
                im.putalpha(im.getchannel('A').point(lambda a: round(a * opacity)))
            result.alpha_composite(im, (int(node.get('x', '0')), int(node.get('y', '0'))))
    return result, names


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', type=Path, required=True)
    parser.add_argument('--pose-source', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, required=True)
    args = parser.parse_args()
    master, out = args.pose_source.resolve(), args.out_dir.resolve()
    if out.exists():
        raise ValueError('Keep previous exports intact; choose a new output directory')
    recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    meta = json.loads((master / 'authoring.json').read_text(encoding='utf-8'))
    if meta.get('editablePoseContract') != 'full-canvas-normal-layers-v1':
        raise ValueError('Export versioned full-pose paint inputs before reimporting')
    if file_hash(args.recipe) != meta['recipeSha256']:
        raise ValueError('STALE_BASE: contour recipe changed; review and rebase pose artwork')
    if file_hash(ROOT / recipe['source']) != meta['sourceSha256']:
        raise ValueError('STALE_BASE: identity reference changed')
    layers = ROOT / recipe['layerSource']
    actual_layers = {p.name: file_hash(p) for p in layers.glob('*.png')}
    if actual_layers != meta['layerSourceSha256']:
        raise ValueError('STALE_BASE: shared source layers changed; review pose artwork before reusing it')
    cloth_path = meta.get('editedClothMaster')
    if cloth_path and file_hash(ROOT / cloth_path) != meta['editedClothMasterSha256']:
        raise ValueError('STALE_BASE: shared cloth master changed')
    canvas = tuple(recipe['canvas'])
    expected = [pose['name'] for pose in recipe['poses']]
    if [pose['pose'] for pose in meta['poses']] != expected:
        raise ValueError('Pose set or order changed; do not silently drop poses')
    exports = []
    # Validate every pose and dependency before creating any output.
    for pose in meta['poses']:
        name = pose['pose']
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', name):
            raise ValueError('Use simple unique pose IDs')
        if pose['png'] != name + '.png' or pose['editable'] != name + '.ora':
            raise ValueError('Keep versioned pose file names')
        base = Image.open(master / pose['png']).convert('RGBA')
        if base.size != canvas or rgba_hash(base) != pose['baseRgbaSha256']:
            raise ValueError('STALE_BASE: original pose PNG changed for ' + name)
        ora = master / pose['editable']
        painted, names = read_painted_pose(ora, canvas, pose['layerNames'])
        difference = ImageChops.difference(base, painted)
        changed = sum(a != b for a, b in zip(base.get_flattened_data(), painted.get_flattened_data()))
        alpha_changed = sum(a != b for a, b in zip(base.getchannel('A').get_flattened_data(),
                                                  painted.getchannel('A').get_flattened_data()))
        record = dict(pose, baseRgbaSha256=rgba_hash(painted), layerNames=names, artApproved=False,
                      priorBaseRgbaSha256=pose['baseRgbaSha256'], changedPixels=changed,
                      silhouetteChangedPixels=alpha_changed,
                      changedBounds=difference.getbbox(alpha_only=False),
                      paintSourceSha256=file_hash(ora))
        exports.append((painted, record))
    out.mkdir(parents=True)
    for image, pose in exports:
        image.save(out / pose['png'])
        shutil.copyfile(master / pose['editable'], out / pose['editable'])
    source = Image.new('RGBA', canvas)
    source.alpha_composite(Image.open(ROOT / recipe['source']).convert('RGBA'), tuple(recipe['sourceOffset']))
    source.save(out / 'source-reference.png')
    review = write_review_sheet(out, source, [pose for _, pose in exports], canvas, recipe.get('reviewColumns'))
    result = dict(meta, poses=[pose for _, pose in exports], reviewSheet=review,
                  method='Complete-pose ORA paint reimport; no contour regeneration; silhouette edits permitted.',
                  parentPaintDirectory=str(master),
                  status='static-pose-paint-export; art and motion not approved',
                  artApproved=False, walkCycleValidated=False, homepageIntegrated=False)
    (out / 'authoring.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(out), 'poses': len(exports),
                      'changedPoses': [p['pose'] for _, p in exports if p['changedPixels']],
                      'artApproved': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
