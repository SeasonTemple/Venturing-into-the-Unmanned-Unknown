"""Build a stopped front-to-back turn from complete pixel direction frames."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'prototypes/visual-direction/pixel-native-master-v01'
OUT = ROOT / 'prototypes/visual-direction/pixel-turn-proof-v01'
CANVAS = (128, 196)
BASELINE = 183
SEQUENCE = [
    ('front', '正面停步'),
    ('front', '正面确认'),
    ('side', '侧身开始'),
    ('side', '侧面停步'),
    ('back-side', '背侧展开'),
    ('back', '背向停步'),
    ('back', '背向确认'),
]

def source_for(view: str) -> Path:
    return SOURCE_DIR / ('reference-1x.png' if view == 'front' else f'reference-{view}-1x.png')

def frame_image(view: str) -> Image.Image:
    source = Image.open(source_for(view)).convert('RGBA')
    frame = Image.new('RGBA', CANVAS)
    frame.alpha_composite(source, ((CANVAS[0] - source.width) // 2, BASELINE - source.height + 1))
    return frame

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if any(OUT.iterdir()) and not args.refresh:
        raise FileExistsError(f'Keep existing turn proof intact: {OUT}')
    frames_dir = OUT / 'frames'; frames_dir.mkdir(exist_ok=True)
    frames = []
    for index, (view, label) in enumerate(SEQUENCE):
        frame = frame_image(view)
        filename = f'frame-{index:02d}.png'
        frame.save(frames_dir / filename)
        frames.append({
            'index': index,
            'file': f'frames/{filename}',
            'view': view,
            'label': label,
            'baseline': BASELINE,
            'source': str(source_for(view).relative_to(ROOT)).replace('\\', '/'),
            'sourceSha256': hashlib.sha256(source_for(view).read_bytes()).hexdigest(),
            'frameSha256': hashlib.sha256((frames_dir / filename).read_bytes()).hexdigest(),
        })

    scale = 3
    card = (CANVAS[0] * scale + 56, CANVAS[1] * scale + 66)
    atlas = Image.new('RGB', (card[0] * 4, card[1] * 2), '#152622')
    draw = ImageDraw.Draw(atlas)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 14 * scale)
        small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 10 * scale)
    except OSError:
        font = small = None
    for entry in frames:
        frame = Image.open(OUT / entry['file']).convert('RGBA').resize((CANVAS[0]*scale, CANVAS[1]*scale), Image.Resampling.NEAREST)
        x = (entry['index'] % 4) * card[0] + 28
        y = (entry['index'] // 4) * card[1] + 48
        atlas.paste(frame, (x, y), frame)
        draw.text((x, y - 38), f"{entry['index']:02d}  {entry['label']}", font=font, fill='#f3e9bd')
        draw.text((x, y + CANVAS[1]*scale + 8), entry['view'], font=small, fill='#a5bda0')
    atlas.save(OUT / 'turn-atlas-3x.png')

    manifest = {
        'revision': 'pixel-turn-proof-v01',
        'status': 'stopped-direction-turn-study',
        'artApproved': False,
        'motionApproved': False,
        'homepageIntegrated': False,
        'canvas': list(CANVAS),
        'baseline': BASELINE,
        'fps': 5,
        'frames': frames,
        'method': 'complete pixel frames with discrete direction changes; no mirroring, interpolation or limb deformation',
        'limitations': [
            'This is a stopped turn, not a walk cycle.',
            'The supplied direction sources are held on keyframes; intermediate turning anatomy is not invented.',
            'The source art and layer master remain under review.',
        ],
    }
    (OUT / 'turn.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

if __name__ == '__main__':
    main()
