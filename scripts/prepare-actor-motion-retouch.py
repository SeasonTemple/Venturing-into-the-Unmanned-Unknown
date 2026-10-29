"""Author a small knee-cloth candidate over immutable v03 animation frames.

The recipe and ORA stacks are editable sources. Subsequent exports must use
finish-actor-poses.py, rather than re-running this authoring step over edits.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'prototypes/visual-direction/actor-rig-v03'
OUT = ROOT / 'prototypes/visual-direction/actor-rig-v04'
sys.stdout.reconfigure(encoding='utf-8')


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def author():
    OUT.mkdir(parents=True, exist_ok=True)
    recipe_path = OUT / 'actor-v04-retouch.recipe.json'
    if recipe_path.exists():
        raise ValueError('Authoring sources already exist; export their edits instead of overwriting them')
    report = json.loads((BASE / 'actor-v03.json').read_text(encoding='utf-8'))
    samples = {s['frame']: s for s in report['motionSamples']}
    frames = {f['frame']: f for f in report['frames']}
    # Discontinuous transverse stripes were rejected in v02. These small,
    # staggered clusters describe a compression pocket on the inner knee.
    motifs = [
        ('fold_shadow', [(3, -3), (5, -4), (10, -5), (8, -3), (5, -2)], (23, 36, 36)),
        ('cloth_turn', [(2, -1), (4, -2), (7, -1), (5, 0), (3, 0)], (45, 61, 51)),
        ('fold_shadow', [(6, 3), (8, 3), (11, 5), (11, 6), (8, 5)], (24, 37, 38)),
    ]
    # Each step has its own envelope. No correction remains on a resting leg.
    windows = [('R', 7, 11, 17), ('L', 17, 23, 29)]
    poses = []
    registration = []
    for frame in range(1, 50):
        pose = {'name': f'frame-{frame:03}', 'baseFile': '../actor-rig-v03/' + frames[frame]['file'], 'operations': []}
        for side, start, peak, end in windows:
            if not start < frame < end:
                continue
            t = (frame - start) / (peak - start) if frame <= peak else (end - frame) / (end - peak)
            strength = t * t * (3 - 2 * t)
            knee = samples[frame]['legs'][side]['knee']
            x, y = round(knee[0] + report['sourceOffset'][0]), round(knee[1] + report['sourceOffset'][1])
            pose['clipBox'] = [x - 2, y - 8, x + 15, y + 10]
            for layer, points, color in motifs:
                pose['operations'].append({'layer': layer, 'polygon': [[x + px, y + py] for px, py in points],
                                           'color': [*color, round(205 * strength)]})
            registration.append({'frame': frame, 'side': side, 'knee': [x, y], 'strength': strength})
        poses.append(pose)
    write_json(recipe_path, {'tag': 'actor-v04', 'canvas': [300, 400],
                            'correctionsDirectory': 'pose-corrections', 'finalDirectory': 'final',
                            'method': 'Program-assisted small cloth clusters, knee-registered per frame with explicit step envelopes; no silhouette or rig edits',
                            'registration': registration, 'poses': poses})
    for mode in [['--prepare'], []]:
        subprocess.run([sys.executable, str(ROOT / 'scripts/finish-actor-poses.py'), '--recipe', str(recipe_path), *mode], check=True)


def package():
    report = json.loads((BASE / 'actor-v03.json').read_text(encoding='utf-8'))
    finished = json.loads((OUT / 'final/actor-v04-finish.json').read_text(encoding='utf-8'))
    spec = json.loads((BASE / report['specification']).read_text(encoding='utf-8'))
    samples = {s['frame']: s for s in report['motionSamples']}
    raw = {f['frame']: f['file'] for f in report['frames']}
    assert len(finished['poses']) == 49
    original = Image.new('RGBA', (2100, 2800))
    corrected = original.copy()
    manifest = {'version': 'cloth04', 'fps': 12, 'frameCount': 49, 'frameSize': [300, 400], 'columns': 7,
                'beforeAtlas': 'actor-v03-atlas.png', 'afterAtlas': 'actor-v04-atlas.png',
                'sourceRig': '../actor-rig-v03/actor-v03-editable.blend', 'frames': [],
                'artApproved': False, 'homepageIntegrated': False}
    checks = []
    for i, item in enumerate(finished['poses']):
        frame = i + 1
        before = Image.open(BASE / raw[frame]).convert('RGBA')
        after = Image.open(OUT / 'final' / item['file']).convert('RGBA')
        if hashlib.sha256(before.tobytes()).hexdigest() != item['baseRgbaSha256']:
            raise ValueError('STALE_BASE: rebase the frame paint before repackaging')
        if hashlib.sha256(after.tobytes()).hexdigest() != item['finalRgbaSha256']:
            raise ValueError('Final frame changed outside its paint export; reimport the ORA source')
        delta = ImageChops.difference(before, after)
        assert not delta.getchannel('A').getbbox()
        # All changes must stay in trouser area, never touch soles, hands or face.
        bounds = delta.getbbox(alpha_only=False)
        assert not bounds or (245 <= bounds[1] < bounds[3] <= 310)
        spot = ((i % 7) * 300, (i // 7) * 400)
        original.paste(before, spot)
        corrected.paste(after, spot)
        current = next(p for p in reversed(spec['poses']) if p['frame'] <= frame)
        side = 'R' if frame <= 17 else 'L'
        knee = samples[frame]['legs'][side]['knee']
        manifest['frames'].append({'number': frame, 'label': current['label'], 'side': side,
                                  'knee': [round(knee[0] + 72), round(knee[1] + 26)],
                                  'changedPixels': item['changedPixels'],
                                  'ora': 'pose-corrections/' + item['paintSource'] if item['paintSource'] else None})
        checks.append({'frame': frame, 'changedPixels': item['changedPixels'], 'changedBounds': bounds})
    original.save(OUT / manifest['beforeAtlas'], optimize=True)
    corrected.save(OUT / manifest['afterAtlas'], optimize=True)
    write_json(OUT / 'review.json', manifest)
    write_json(OUT / 'actor-v04-validation.json', {
        'silhouetteAlphaUnchangedAll49Frames': True, 'headGripAndSolesPixelIdenticalToV03': True,
        'baseSources': '../actor-rig-v03/actor-v03.json', 'posePaintInputs': 'pose-corrections/actor-v04-paint-inputs.json',
        'changedFrames': sum(bool(c['changedPixels']) for c in checks), 'maxChangedPixels': max(c['changedPixels'] for c in checks),
        'frames': checks, 'artApproved': False, 'temporalArtApproved': False, 'newPaidMediaRequests': 0})
    # Actual before/after stills at an integer 4x zoom; no rescaling of anatomy.
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
    sheet = Image.new('RGB', (900, 530), '#dce1d2')
    d = ImageDraw.Draw(sheet)
    for row, frame in enumerate([11, 23]):
        item = manifest['frames'][frame - 1]; x, y = item['knee']
        for col, atlas in enumerate([original, corrected]):
            spot = (((frame - 1) % 7) * 300, ((frame - 1) // 7) * 400)
            crop = atlas.crop((spot[0]+x-14, spot[1]+y-20, spot[0]+x+26, spot[1]+y+28))
            crop = crop.resize((160,192), Image.Resampling.NEAREST)
            sheet.paste(crop, (col*450+30,row*260+45), crop)
            d.text((col*450+30,row*260+12), ('骨架底图' if col == 0 else '衣褶候选') + f' · 第 {frame} 帧', font=font, fill='#263e32')
            if col == 1:
                d.text((col*450+210,row*260+120), f"局部改动 {item['changedPixels']} 像素", font=font, fill='#52634d')
    sheet.save(OUT / 'actor-v04-knee-comparison.png')
    print(json.dumps({'review': str(OUT/'review.json'), 'changedFrames': sum(bool(c['changedPixels']) for c in checks)}, ensure_ascii=False))


if __name__ == '__main__':
    if '--package-only' not in sys.argv:
        author()
    package()
