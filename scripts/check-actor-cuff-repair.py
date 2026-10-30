"""Reproduce the two ankle seam repairs and verify untouched layers stay untouched."""
import copy
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree.ElementTree import fromstring

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / 'prototypes/visual-direction/actor-seam-repair-study'


def read_layers(path):
    with zipfile.ZipFile(path) as z:
        return {n.get('name'): Image.open(io.BytesIO(z.read(n.get('src')))).convert('RGBA')
                for n in fromstring(z.read('stack.xml')).find('stack')}


def connected(alpha, start, end):
    seen, todo = {start}, [start]
    while todo:
        x, y = todo.pop()
        if (x, y) == end:
            return True
        for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
            if (0 <= nx < alpha.shape[1] and 0 <= ny < alpha.shape[0]
                    and alpha[ny, nx] and (nx, ny) not in seen):
                seen.add((nx, ny))
                todo.append((nx, ny))
    return False


def main():
    repaired = json.loads((STUDY / 'repair.spec.json').read_text(encoding='utf-8'))
    original = copy.deepcopy(repaired)
    for pose in original['poses']:
        pose['L'].pop('cuffFromBoot')
    # Temporary output is kept outside the study; never overwrite saved paint.
    with tempfile.TemporaryDirectory(prefix='actor-cuff-check-') as temp:
        temp = Path(temp)
        directories = {}
        for tag, recipe in [('before', original), ('after', repaired)]:
            spec = temp / (tag + '.json')
            spec.write_text(json.dumps(recipe), encoding='utf-8')
            directories[tag] = temp / tag
            subprocess.run([sys.executable, str(ROOT / 'scripts/author-actor-contour-poses.py'),
                            '--recipe', str(spec), '--out-dir', str(directories[tag])],
                           cwd=ROOT, check=True, capture_output=True)
        for pose in repaired['poses']:
            name = pose['name']
            a, b = [read_layers(directories[tag] / (name + '.ora'))
                    for tag in ['before', 'after']]
            # A common-floor repair is deliberately absent: both boots, the
            # support leg and the entire upper body must remain pixel-identical.
            for layer in a:
                if layer != 'trouser_L':
                    assert a[layer].tobytes() == b[layer].tobytes(), (name, layer)
            before = np.asarray(a['trouser_L'])[:, :, 3] > 0
            after = np.asarray(b['trouser_L'])[:, :, 3] > 0
            boot = np.asarray(b['boot_L'])[:, :, 3] > 0
            assert not (before & boot).any(), name
            assert (after & boot).any(), name
            # Check an actual 4-connected path through the repaired ankle,
            # rather than just an accidental overlap at an isolated pixel.
            top_y, top_x = np.argwhere(after)[0]
            bottom_y, bottom_x = np.argwhere(boot)[-1]
            assert connected(after | boot, (int(top_x), int(top_y)),
                             (int(bottom_x), int(bottom_y))), name
            exported = Image.open(directories['after'] / (name + '.png')).convert('RGBA')
            saved = Image.open(STUDY / (name + '.png')).convert('RGBA')
            assert exported.tobytes() == saved.tobytes(), name
            previous = Image.open(ROOT / 'prototypes/visual-direction/pixel-phase-coupled-v02'
                                  / (name + '.png')).convert('RGBA')
            regenerated = Image.open(directories['before'] / (name + '.png')).convert('RGBA')
            assert previous.tobytes() == regenerated.tobytes(), name
            print(f'{name}: seam connected, other layers unchanged, export reproducible')
    print('Connection checks only; anatomy, contact and motion remain unapproved.')


if __name__ == '__main__':
    main()
