"""Fetch, render, edit, reopen and package the pinned COA cutout example.

Run with a Python environment containing Blender bpy 4.5 and Pillow.
All third-party source material stays under .lab; its embedded scripts are disabled.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / '.lab/pipeline-reproduction'
SOURCE = LAB / 'coa-source'
OUT = ROOT / 'prototypes/visual-direction/cutout-pipeline-media'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--blender-python', default=sys.executable)
args = parser.parse_args()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def fetch(item):
    destination = SOURCE / item['repositoryPath']
    if not destination.resolve().is_relative_to(SOURCE.resolve()):
        raise ValueError('Source path escapes sample workspace')
    data = destination.read_bytes() if destination.is_file() else None
    if data is None or digest(data) != item['sha256']:
        try:
            request = urllib.request.Request(item['url'], headers={'User-Agent': 'cutout-reproduction/1.0'})
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read(item['bytes'] + 1)
        except Exception:
            url = 'https://api.github.com/repos/ndee85/coa_tools/git/blobs/' + item['gitBlobSha']
            request = urllib.request.Request(url, headers={'User-Agent': 'cutout-reproduction/1.0'})
            with urllib.request.urlopen(request, timeout=20) as response:
                blob = json.loads(response.read(item['bytes'] * 2 + 20000))
            data = base64.b64decode(blob['content'])
        if digest(data) != item['sha256']:
            raise ValueError('Source SHA256 mismatch: ' + item['repositoryPath'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    return item['repositoryPath']

manifest = json.loads((ROOT / 'docs/research/homepage-cutout-reproduction-sources.json').read_text(encoding='utf-8'))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    verified = list(pool.map(fetch, manifest['files']))
print('Verified %d pinned source files' % len(verified), flush=True)

frame_arg = ','.join(str(frame) for frame in range(20))
commands = [
    ['scripts/reproduce-cutout-pipeline.py', '--out', str(LAB / 'base'), '--frames', frame_arg],
    ['scripts/reproduce-cutout-pipeline.py', '--out', str(LAB / 'edited'), '--frames', frame_arg,
     '--edit-frame', '8', '--edit-degrees', '18'],
    ['scripts/check-cutout-reproduction.py'],
]
for index, command in enumerate(commands):
    log = LAB / ('pipeline-step-%d.log' % index)
    with log.open('w', encoding='utf-8') as stream:
        subprocess.run([args.blender_python] + command, cwd=ROOT, stdout=stream,
                       stderr=subprocess.STDOUT, check=True)
    print('Completed ' + command[0], flush=True)

OUT.mkdir(parents=True, exist_ok=True)
font_path = Path('C:/Windows/Fonts/msyh.ttc')
font = ImageFont.truetype(str(font_path), 20) if font_path.is_file() else ImageFont.load_default()
small = ImageFont.truetype(str(font_path), 15) if font_path.is_file() else ImageFont.load_default()
previews = []
for frame in range(20):
    board = Image.new('RGBA', (768, 580), '#e4e7db')
    draw = ImageDraw.Draw(board)
    draw.text((18, 8), 'COA sample · pipeline reproduction', font=font, fill='#283d34')
    draw.text((18, 38), 'Original action', font=small, fill='#283d34')
    draw.text((402, 38), 'Edited forearm key · frame 8 / +18°', font=small, fill='#283d34')
    for column, variant in enumerate(['base', 'edited']):
        image = Image.open(LAB / variant / ('frame-%03d.png' % frame)).convert('RGBA')
        board.alpha_composite(image, (column * 384, 68))
    previews.append(board.convert('RGB'))

# A shared palette is used only by this GIF preview; full RGBA frame exports are retained.
palette_source = Image.new('RGB', (768 * 5, 580 * 4))
for index, preview in enumerate(previews):
    palette_source.paste(preview, ((index % 5) * 768, (index // 5) * 580))
palette = palette_source.quantize(colors=256)
gif_frames = [preview.quantize(palette=palette, dither=Image.Dither.NONE) for preview in previews]
gif_durations = [10 * (round((i + 1) * 100 / 30) - round(i * 100 / 30)) for i in range(20)]
gif_frames[0].save(OUT / 'cutout-reproduction.gif', save_all=True, append_images=gif_frames[1:],
                   duration=gif_durations, loop=0, optimize=False, disposal=2)
previews[0].save(OUT / 'cutout-reproduction.webp', save_all=True, append_images=previews[1:],
                 duration=[round((i + 1) * 1000 / 30) - round(i * 1000 / 30) for i in range(20)],
                 lossless=True, loop=0, method=4)
previews[8].save(OUT / 'pose-edit-comparison.png')
for variant in ['base', 'edited']:
    strip = Image.new('RGBA', (384 * 20, 512))
    for frame in range(20):
        strip.paste(Image.open(LAB / variant / ('frame-%03d.png' % frame)), (frame * 384, 0))
    strip.save(OUT / (variant + '-rgba-spritesheet.png'))
    shutil.copy2(LAB / variant / 'editable-cutout.blend', OUT / (variant + '-editable.blend'))
    shutil.copy2(LAB / variant / 'bake.json', OUT / (variant + '-bake.json'))
shutil.copy2(SOURCE / 'LICENSE', OUT / 'UPSTREAM-LICENSE.txt')
(OUT / 'ATTRIBUTION.md').write_text(
    '# COA example: technical workflow reproduction\n\n'
    'Original character, sprites, meshes, rig and animation: ndee85/coa_tools, Sample Files/stip.blend.\n'
    'Repository: https://github.com/ndee85/coa_tools\n'
    'Pinned commit: ' + manifest['commit'] + '\n'
    'The upstream repository supplies GPL-3.0; its license is retained here. No CC0 claim is made.\n'
    'Local adaptations: Blender Internal -> RGBA shader conversion, packed textures, fixed camera, '
    'PNG baking and a copied-action forearm key edit. Source scripts/add-on were not executed.\n'
    'This sample is a technical test; it is not homepage character art.\n', encoding='utf-8')
summary = {'sourceCommit': manifest['commit'], 'sourceFilesVerified': len(verified),
           'renderedFramesPerVariant': 20, 'fps': 30, 'spriteSize': [384, 512],
           'spriteSheetSize': [7680, 512], 'technicalReproduction': True,
           'homepageArtApproved': False, 'homepageIntegrated': False,
           'validation': '../../../docs/research/homepage-cutout-reproduction-validation.json'}
(OUT / 'result.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary), flush=True)
