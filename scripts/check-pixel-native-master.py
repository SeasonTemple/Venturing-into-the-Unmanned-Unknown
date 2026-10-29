"""Check that the pixel-native study keeps its locked identity composite."""
from __future__ import annotations

import hashlib
import io
import json
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'prototypes/visual-direction/pixel-native-master-v01'

manifest = json.loads((STUDY / 'manifest.json').read_text(encoding='utf8'))
contract = json.loads((STUDY / 'direction-contract.json').read_text(encoding='utf8'))
if contract['baseline'] != 173 or contract['nativeHeight'] != 174:
    raise SystemExit('DIRECTION_BASELINE_MISMATCH')
source = ROOT / manifest['source']
reference = Image.open(STUDY / 'reference-4x.png').convert('RGBA')
if hashlib.sha256(source.read_bytes()).hexdigest() != manifest['sourceSha256']:
    raise SystemExit('SOURCE_HASH_MISMATCH')
for view, entry in manifest['viewReferences'].items():
    path = ROOT / entry['source']
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
        raise SystemExit(f'VIEW_SOURCE_HASH_MISMATCH:{view}')
for view in contract['views']:
    if not (STUDY / view['file']).exists():
        raise SystemExit(f'MISSING_DIRECTION_REFERENCE:{view["id"]}')
with zipfile.ZipFile(STUDY / 'pixel-native-master-v01.ora') as archive:
    merged = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
    if merged.size != reference.size or merged.tobytes() != reference.tobytes():
        raise SystemExit('COMPOSITE_CHANGED')
    stack = archive.read('stack.xml').decode('utf8')
    for name in manifest['layerNames']:
        if f'name="{name}"' not in stack:
            raise SystemExit(f'MISSING_LAYER:{name}')
print(json.dumps({
    'status': 'ok',
    'sourceSha256': manifest['sourceSha256'],
    'canvas': list(reference.size),
    'layers': len(manifest['layerNames']),
    'compositeMatchesReference': True,
}, ensure_ascii=False))
