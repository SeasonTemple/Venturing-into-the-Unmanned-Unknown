"""Exercise actual v04 frame paint edits and stale-base rejection in isolation."""
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'prototypes/visual-direction/actor-rig-v04'
BASE = ROOT / 'prototypes/visual-direction/actor-rig-v03'
spec = importlib.util.spec_from_file_location('finish', ROOT / 'scripts/finish-actor-poses.py')
finish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(finish)
work = Path(tempfile.mkdtemp(prefix='v04-paint-check-', dir=ROOT / '.lab/actor-layer-study'))
candidate = work / OUT.name
candidate.mkdir()
(work / BASE.name).mkdir()
recipe_name = 'actor-v04-retouch.recipe.json'
recipe = json.loads((OUT / recipe_name).read_text(encoding='utf-8'))
shutil.copy2(OUT / recipe_name, candidate / recipe_name)
shutil.copytree(OUT / 'pose-corrections', candidate / 'pose-corrections')
for pose in recipe['poses']:
    shutil.copy2(OUT / pose['baseFile'], candidate / pose['baseFile'])
command = [sys.executable, str(ROOT / 'scripts/finish-actor-poses.py'), '--recipe', str(candidate / recipe_name)]


def export(expect_error=None):
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
    if expect_error:
        assert result.returncode != 0 and expect_error in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr


export()
for pose in recipe['poses']:
    name = 'actor-v04-' + pose['name'] + '.png'
    assert finish.rgba_hash(Image.open(candidate/'final'/name)) == finish.rgba_hash(Image.open(OUT/'final'/name))

selected = next(p for p in recipe['poses'] if p['name'] == 'frame-023')
ora = candidate / 'pose-corrections/frame-023.ora'
layers = finish.read_ora(ora, (300, 400))
paint = layers[-1][1]
point = next((x, y) for y in range(400) for x in range(300) if paint.getpixel((x, y))[3] > 0)
paint.putpixel(point, (125, 90, 67, 255))
finish.write_ora(ora, (300, 400), layers)
export()
for pose in recipe['poses']:
    name = 'actor-v04-' + pose['name'] + '.png'
    delta = ImageChops.difference(Image.open(candidate/'final'/name), Image.open(OUT/'final'/name))
    expected = (*point, point[0]+1, point[1]+1) if pose['name'] == selected['name'] else None
    assert delta.getbbox(alpha_only=False) == expected

published = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (candidate/'final').glob('*')}
base = candidate / recipe['poses'][-1]['baseFile']
image = Image.open(base).convert('RGBA')
image.putpixel((110, 280), (0, 0, 0, 255))
image.save(base)
export('STALE_BASE')
assert published == {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (candidate/'final').glob('*')}

result = {'actualEditedFrameExported': 23, 'other48FramesUnchanged': True,
          'staleLastFrameRejectedBeforeAnyOutputWrite': True, 'priorOutputsPreserved': True,
          'unmodified49FrameReimportIdentical': True, 'artApproved': False,
          'isolatedTestDirectory': str(work.relative_to(ROOT)).replace('\\', '/')}
(OUT/'actor-v04-edit-validation.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps(result))
