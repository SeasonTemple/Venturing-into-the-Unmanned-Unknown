"""Reopen the two editable cutout projects and verify their actual renders."""
import hashlib
import json
import sys
from pathlib import Path

import bpy
from PIL import Image, ImageChops

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / '.lab/pipeline-reproduction'
report = {'scope': 'Reopen, packed textures, actual renders, and a persisted pose edit; not art approval.',
          'artApproved': False, 'variants': {}, 'checks': {}}
for variant in ['base', 'edited']:
    directory = LAB / variant
    bake = json.loads((directory / 'bake.json').read_text(encoding='utf-8'))
    master = directory / 'editable-cutout.blend'
    bpy.ops.wm.open_mainfile(filepath=str(master.resolve()), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    used_images = {node.image for material in bpy.data.materials if material.use_nodes
                   for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
    assert len(used_images) == 22 and all(image.packed_file for image in used_images)
    rig = bpy.data.objects['Armature']
    result = {'masterSha256': hashlib.sha256(master.read_bytes()).hexdigest(),
              'bones': len(rig.data.bones), 'packedTextures': len(used_images), 'rerenders': []}
    for frame in [0, 8]:
        scene.frame_set(frame)
        target = directory / ('reopened-%03d.png' % frame)
        scene.render.filepath = str(target.resolve())
        bpy.ops.render.render(write_still=True)
        expected = Image.open(directory / ('frame-%03d.png' % frame)).convert('RGBA')
        actual = Image.open(target).convert('RGBA')
        identical = ImageChops.difference(expected, actual).getbbox(alpha_only=False) is None
        assert identical, (variant, frame, 'Reopened project pixels changed')
        result['rerenders'].append({'frame': frame, 'rgbaPixelsIdentical': identical})
    report['variants'][variant] = result

base = json.loads((LAB / 'base/bake.json').read_text(encoding='utf-8'))
edited = json.loads((LAB / 'edited/bake.json').read_text(encoding='utf-8'))
assert base['camera'] == edited['camera']
changes = []
for frame in base['renderFrames']:
    first = Image.open(LAB / 'base' / ('frame-%03d.png' % frame)).convert('RGBA')
    second = Image.open(LAB / 'edited' / ('frame-%03d.png' % frame)).convert('RGBA')
    assert first.size == second.size == (384, 512)
    difference = ImageChops.difference(first, second).getbbox(alpha_only=False)
    if difference:
        changes.append({'frame': frame, 'differenceBounds': list(difference)})
assert any(item['frame'] == 8 for item in changes)
assert not any(item['frame'] in [0, 19] for item in changes)
report['checks'] = {'sameFixedCamera': True, 'sameFrameDimensions': True,
                    'poseEditChangesActualFrame8': True,
                    'unchangedEndpointFrames': [0, 19], 'changedFrames': changes,
                    'frameCountPerVariant': len(base['renderFrames'])}
destination = ROOT / 'docs/research/homepage-cutout-reproduction-validation.json'
destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
