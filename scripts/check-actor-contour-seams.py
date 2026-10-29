"""Audit enclosed transparent gaps in the loaded sleeve of this finite study.

Intentionally excludes the bent-arm opening. This is a narrow seam regression
check, not an anatomy or animation-quality evaluation.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
base = args.directory
motion = json.loads((base / 'motion.json').read_text(encoding='utf-8'))
spec = json.loads((base / 'motion.spec.json').read_text(encoding='utf-8'))
issues = []
for record in motion['frames']:
    alpha = Image.open(base / record['file']).getchannel('A')
    # Source-space loaded sleeve, translated with the head's whole-pixel shift.
    x0 = 130 + record['headRasterShift'][0] + 25
    y0 = 26 + record['headRasterShift'][1] + 70
    mask = alpha.crop((x0, y0, x0 + 65, y0 + 80)).point(lambda a: 255 if a else 0)
    edges = ([(x, 0) for x in range(65)] + [(x, 79) for x in range(65)]
             + [(0, y) for y in range(80)] + [(64, y) for y in range(80)])
    for point in edges:
        if mask.getpixel(point) == 0:
            ImageDraw.floodfill(mask, point, 128)
    if 0 in mask.get_flattened_data():
        issues.append(record['frame'])

hold_start = spec['motion']['keys'][-2]['frame']
hold_frames = [Image.open(base / r['file']).convert('RGBA').tobytes()
               for r in motion['frames'] if r['frame'] >= hold_start]
result = {
    'framesChecked': len(motion['frames']),
    'enclosedLoadedSleeveGaps': issues,
    'finalHoldPixelIdentical': len(set(hold_frames)) == 1,
    'artApprovalImplied': False,
}
(base / 'seam-checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
assert not issues, issues
assert result['finalHoldPixelIdentical'], 'Stopped hold changed'
