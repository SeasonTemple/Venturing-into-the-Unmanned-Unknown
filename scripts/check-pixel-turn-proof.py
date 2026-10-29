"""Validate the complete-frame turn proof without judging its art quality."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'prototypes/visual-direction/pixel-turn-proof-v01'
manifest = json.loads((STUDY / 'turn.json').read_text(encoding='utf8'))
if manifest['canvas'] != [128, 196] or manifest['baseline'] != 183:
    raise SystemExit('TURN_CANVAS_CONTRACT_FAILED')
if len(manifest['frames']) != 7:
    raise SystemExit('TURN_FRAME_COUNT_FAILED')
for expected, frame in enumerate(manifest['frames']):
    if frame['index'] != expected:
        raise SystemExit('TURN_ORDER_FAILED')
    source = ROOT / frame['source']
    if hashlib.sha256(source.read_bytes()).hexdigest() != frame['sourceSha256']:
        raise SystemExit(f'SOURCE_CHANGED:{frame["view"]}')
    image_path = STUDY / frame['file']
    image = Image.open(image_path).convert('RGBA')
    if image.size != tuple(manifest['canvas']):
        raise SystemExit(f'FRAME_SIZE_FAILED:{frame["index"]}')
    if hashlib.sha256(image_path.read_bytes()).hexdigest() != frame['frameSha256']:
        raise SystemExit(f'FRAME_CHANGED:{frame["index"]}')
print(json.dumps({
    'status': 'ok',
    'frames': len(manifest['frames']),
    'canvas': manifest['canvas'],
    'baseline': manifest['baseline'],
    'method': manifest['method'],
}, ensure_ascii=False))
