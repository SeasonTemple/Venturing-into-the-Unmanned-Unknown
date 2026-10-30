"""Exercise full-pose paint import in isolated copies; never edit source art."""
import argparse
import hashlib
import io
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring, tostring

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXPORTER = ROOT / 'scripts/export-actor-pose-paint.py'


def rgba(path):
    return Image.open(path).convert('RGBA')


def same(a, b):
    return a.size == b.size and a.tobytes() == b.tobytes()


def copy_master(source, dest):
    dest.mkdir(parents=True)
    meta = json.loads((source / 'authoring.json').read_text(encoding='utf-8'))
    for name in ['authoring.json'] + [p[k] for p in meta['poses'] for k in ['png', 'editable']]:
        shutil.copyfile(source / name, dest / name)
    return meta


def run_export(recipe, source, out, error=None):
    result = subprocess.run([sys.executable, '-X', 'utf8', str(EXPORTER), '--recipe', str(recipe),
                             '--pose-source', str(source), '--out-dir', str(out)],
                            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if error is None:
        if result.returncode:
            raise AssertionError(result.stderr)
    else:
        assert result.returncode != 0 and error in result.stderr, result.stderr
        assert not out.exists(), 'Invalid input left partial output'
    return result


def rewrite_ora(path, callback):
    with zipfile.ZipFile(path) as archive:
        contents = {name: archive.read(name) for name in archive.namelist()}
    root = fromstring(contents['stack.xml'])
    callback(root, contents)
    contents['stack.xml'] = tostring(root, encoding='utf-8')
    with zipfile.ZipFile(path, 'w') as archive:
        for name, data in contents.items():
            archive.writestr(name, data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recipe', type=Path, required=True)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, required=True)
    args = parser.parse_args()
    source, work = args.source_dir.resolve(), args.out_dir.resolve()
    if work.exists():
        raise ValueError('Keep previous evidence; use a new check directory')
    # Sandbox recipes reference copies relative to the actual project root.
    work.relative_to(ROOT)
    work.mkdir(parents=True)
    recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    meta = json.loads((source / 'authoring.json').read_text(encoding='utf-8'))
    before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()}
    baseline = work / 'unchanged-export'
    run_export(args.recipe, source, baseline)
    for pose in meta['poses']:
        assert same(rgba(source / pose['png']), rgba(baseline / pose['png']))

    edited = work / 'edited-pose-source'
    copy_master(source, edited)
    selected = meta['poses'][2]
    selected_recipe = recipe['poses'][2]
    knee_y = selected_recipe['L']['kneeY'] + recipe['sourceOffset'][1]

    def paint_silhouette(root, contents):
        node = next(n for n in root.find('stack') if n.get('name') == 'trouser_L')
        layer = Image.open(io.BytesIO(contents[node.get('src')])).convert('RGBA')
        for y in range(knee_y - 3, knee_y + 4):
            xs = [x for x in range(layer.width) if layer.getpixel((x, y))[3] > 0]
            assert len(xs) > 8
            # Erase outer knee pixels and add a conspicuous internal test patch.
            layer.putpixel((max(xs), y), (0, 0, 0, 0))
            layer.putpixel((max(xs) - 1, y), (0, 0, 0, 0))
            layer.putpixel((xs[len(xs) // 2], y), (242, 32, 180, 255))
        # Exercise cropped layer offsets; leave mergedimage.png stale on purpose.
        box = layer.getbbox()
        cropped = layer.crop(box)
        node.set('x', str(box[0])); node.set('y', str(box[1]))
        stream = io.BytesIO(); cropped.save(stream, format='PNG')
        contents[node.get('src')] = stream.getvalue()

    rewrite_ora(edited / selected['editable'], paint_silhouette)
    painted = work / 'painted-export'
    run_export(args.recipe, edited, painted)
    painted_meta = json.loads((painted / 'authoring.json').read_text(encoding='utf-8'))
    delta = next(p for p in painted_meta['poses'] if p['pose'] == selected['pose'])
    assert delta['silhouetteChangedPixels'] > 0 and delta['changedPixels'] > delta['silhouetteChangedPixels']
    for pose in meta['poses']:
        if pose['pose'] != selected['pose']:
            assert same(rgba(source / pose['png']), rgba(painted / pose['png']))
    assert not same(rgba(source / selected['png']), rgba(painted / selected['png']))
    repainted = work / 'painted-second-export'
    run_export(args.recipe, painted, repainted)
    for pose in meta['poses']:
        assert same(rgba(painted / pose['png']), rgba(repainted / pose['png']))

    stale_recipe = work / 'stale-recipe.json'
    changed_recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
    changed_recipe['poses'][0]['upperShift'][0] += 1
    stale_recipe.write_text(json.dumps(changed_recipe, ensure_ascii=False), encoding='utf-8')
    run_export(stale_recipe, source, work / 'must-not-exist-recipe', 'STALE_BASE: contour recipe changed')

    # Use an isolated copy for shared-layer mutation as well.
    copied_layers = work / 'shared-layer-copy'
    shutil.copytree(ROOT / recipe['layerSource'], copied_layers)
    copied_recipe = dict(recipe, layerSource=copied_layers.relative_to(ROOT).as_posix())
    copied_recipe_path = work / 'isolated-recipe.json'
    copied_recipe_path.write_text(json.dumps(copied_recipe, ensure_ascii=False), encoding='utf-8')
    copied_master = work / 'isolated-input'
    copied_meta = copy_master(source, copied_master)
    copied_meta['recipeSha256'] = hashlib.sha256(copied_recipe_path.read_bytes()).hexdigest()
    (copied_master / 'authoring.json').write_text(json.dumps(copied_meta, ensure_ascii=False), encoding='utf-8')
    layer_path = copied_layers / 'leg_L.png'
    layer = rgba(layer_path); layer.putpixel((100, 240), (1, 2, 3, 255)); layer.save(layer_path)
    run_export(copied_recipe_path, copied_master, work / 'must-not-exist-layer', 'STALE_BASE: shared source layers changed')

    # An invalid last pose must not leave even the first pose exported.
    corrupt = work / 'wrong-canvas-input'
    copy_master(source, corrupt)
    rewrite_ora(corrupt / meta['poses'][-1]['editable'], lambda root, contents: root.set('w', str(recipe['canvas'][0] + 1)))
    run_export(args.recipe, corrupt, work / 'must-not-exist-canvas', 'Pose canvas changed')
    after = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()}
    assert before == after, 'Original input changed during checks'
    report = {
        'scope': 'Engineering checks only; diagnostic magenta patch is not production art.',
        'unchangedRoundtripPoseCount': len(meta['poses']),
        'editedPose': selected['pose'], 'changedPixels': delta['changedPixels'],
        'silhouetteChangedPixels': delta['silhouetteChangedPixels'],
        'croppedLayerOffsetsApplied': True, 'staleMergedPreviewIgnored': True,
        'otherPosesUnchanged': True, 'paintedSecondExportIdentical': True,
        'changedRecipeRejectedBeforeOutput': True, 'changedSharedLayerRejectedBeforeOutput': True,
        'invalidFinalPoseRejectedBeforeAnyOutput': True, 'originalInputsUnchanged': True,
        'artApproved': False, 'walkCycleValidated': False,
    }
    (work / 'checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
