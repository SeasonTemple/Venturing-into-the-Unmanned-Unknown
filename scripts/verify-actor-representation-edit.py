"""Save, reopen and compare a local material edit in the offline character study.

Run prepare, edit and verify as separate Python processes. No source character
or formal website files are modified. Pixel equality verifies persistence only.
"""
import argparse
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('stage', choices=['prepare', 'edit', 'verify'])
parser.add_argument('directory', type=Path)
args = parser.parse_args()
out = args.directory.resolve()
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
records = json.loads((out/'study.json').read_text(encoding='utf-8'))['frames']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(prefix):
    for record in records:
        bpy.context.scene.frame_set(record['frame'])
        bpy.context.scene.render.filepath = str(out/(prefix+record['pose']+'.png'))
        bpy.ops.render.render(write_still=True)


if args.stage == 'prepare':
    bpy.ops.wm.open_mainfile(filepath=str(out/'representation-study.blend'))
    bpy.context.scene.eevee.taa_render_samples = 32
    bpy.context.scene.render.filepath = '//front-quarter.png'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'), compress=True)
    render('')
    study = json.loads((out/'study.json').read_text(encoding='utf-8'))
    study['renderSamples'] = 32
    study['shaderAdaptation'] += ['Screen-space Bayer blending disabled; mesh normals retained.',
                                  '32 Eevee samples reduce stochastic shadow speckles.']
    (out/'study.json').write_text(json.dumps(study, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
elif args.stage == 'edit':
    bpy.ops.wm.open_mainfile(filepath=str(out/'representation-study.blend'))
    screen = bpy.data.objects['Recorder_physical_screen']
    original = screen.active_material
    edited = original.copy()
    edited.name = 'Study_Local_Edit_Amber_Recorder_Screen'
    screen.active_material = edited
    ramp = edited.node_tree.nodes.get('Color Ramp')
    assert ramp is not None
    colors = ['4d3624', '9b5d2d', 'd9923f', 'f3c66b', 'fff0bd']
    for element, color in zip(ramp.color_ramp.elements, colors):
        rgb = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
        element.color = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
    bpy.context.scene['local_edit'] = 'Only recorder screen: copied material, changed to amber ramp.'
    bpy.context.scene.render.filepath = '//edited-front-quarter.png'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'revision-example.blend'), compress=True)
    render('edited-')
    (out/'edit-baseline.json').write_text(json.dumps({
        'baseBlendSha256': digest(out/'representation-study.blend'),
        'editedBlendSha256': digest(out/'revision-example.blend'),
        'object': screen.name, 'material': edited.name,
        'scope': 'Screen color only, copied material; same body, pose, camera and lights.'
    }, indent=2)+'\n', encoding='utf-8')
else:
    baseline = json.loads((out/'edit-baseline.json').read_text(encoding='utf-8'))
    assert digest(out/'representation-study.blend') == baseline['baseBlendSha256']
    assert digest(out/'revision-example.blend') == baseline['editedBlendSha256']
    bpy.ops.wm.open_mainfile(filepath=str(out/'revision-example.blend'))
    material = bpy.data.objects['Recorder_physical_screen'].active_material
    assert material.name == baseline['material']
    expected = ['4d3624', '9b5d2d', 'd9923f', 'f3c66b', 'fff0bd']
    for element, color in zip(material.node_tree.nodes['Color Ramp'].color_ramp.elements, expected):
        rgb = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]+[1]
        assert np.allclose(element.color, linear, atol=1e-6, rtol=0)
    external = [im.filepath for im in bpy.data.images if im.source == 'FILE' and not im.packed_file]
    assert not external, external
    render('reopened-')
    checks = []
    board = Image.new('RGB', (1080, 620), '#e1e5d7')
    draw = ImageDraw.Draw(board)
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 20)
    for i, record in enumerate(records):
        label = record['pose']
        before = np.array(Image.open(out/(label+'.png')).convert('RGBA'))
        after = np.array(Image.open(out/('edited-'+label+'.png')).convert('RGBA'))
        reopened = np.array(Image.open(out/('reopened-'+label+'.png')).convert('RGBA'))
        bpy.context.scene.frame_set(record['frame'])
        bpy.context.view_layer.update()
        screen = bpy.data.objects['Recorder_physical_screen']
        points = [world_to_camera_view(bpy.context.scene, bpy.context.scene.camera,
                  screen.matrix_world @ Vector(corner)) for corner in screen.bound_box]
        h, w = before.shape[:2]
        box = [max(0, int(min(p.x for p in points)*w)-1),
               max(0, int(min(1-p.y for p in points)*h)-1),
               min(w, int(max(p.x for p in points)*w)+2),
               min(h, int(max(1-p.y for p in points)*h)+2)]
        region = np.s_[box[1]:box[3], box[0]:box[2]]
        changed = np.any(before != after, axis=2)
        assert changed[region].any(), 'Screen edit must visibly change rendered pixels'
        delta = np.abs(after.astype(int)-reopened.astype(int))
        checks.append({'view': label, 'allChangedPixelsBeforeAfter': int(changed.sum()),
                       'screenChangedPixels': int(changed[region].sum()), 'screenBounds': box,
                       'reopenedScreenPixelsIdentical': bool(np.array_equal(after[region], reopened[region])),
                       'reopenedPixelsIdentical': bool(np.array_equal(after, reopened)),
                       'reopenedDifferentPixelCount': int(np.any(delta, axis=2).sum()),
                       'reopenedMaximumChannelDelta': int(delta.max())})
        for j, (pixels, title) in enumerate([(before, '原屏幕'), (after, '修改为琥珀色'),
                                           (reopened, '保存后重新打开')]):
            x, y = j*360, i*310
            draw.text((x+16, y+12), title+' · '+str(i+1), font=font, fill='#244238')
            # Whole person at native resolution; screen crop explicitly enlarged.
            person = Image.fromarray(pixels)
            board.paste(person, (x+8, y+54), person)
            cx, cy = (box[0]+box[2])//2, (box[1]+box[3])//2
            crop = person.crop((cx-16, cy-20, cx+16, cy+20)).resize((128,160), Image.Resampling.NEAREST)
            board.paste(crop, (x+190, y+70), crop)
    board.save(out/'edit-reopen-review.png')
    report = {**baseline, 'packedImagesOnly': True, 'freshProcessReopen': True,
              'savedScreenMaterialValuesPreserved': True,
              'views': checks, 'validates': 'Local material edit persists through save/reopen/render.',
              'doesNotValidate': 'Anatomy, character identity, walking, final art quality.'}
    (out/'verification.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print('Completed representation edit stage:', args.stage, flush=True)
