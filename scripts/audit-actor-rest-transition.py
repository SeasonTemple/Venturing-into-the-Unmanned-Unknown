"""Internal diagnosis of the rejected v06 rig; never packages release frames.

Compare the authored rest with the first exported stance, then try the other
planar IK branch on the same saved mesh. This isolates a solver defect from
the separate art/hidden-cloth/weighting problems. No source file is modified.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'prototypes/visual-direction/actor-rig-v06'
OUT = ROOT / '.lab/actor-structure-audit'
OUT.mkdir(parents=True, exist_ok=True)
report = json.loads((BASE / 'actor-v06.json').read_text(encoding='utf-8'))
spec_path = BASE / report['specification']
spec = json.loads(spec_path.read_text(encoding='utf-8'))
bones = {item[0]: item for item in spec['bones']}
samples = {s['frame']: s for s in report['motionSamples']}

def coord(point):
    return Vector((point[0] - 78, 0, 348 - point[1]))

def signed_knee_distance(hip, ankle, knee):
    delta = ankle - hip
    direction = delta.normalized()
    return (knee - hip).dot(Vector((-direction.y, direction.x)))

def source_branch(side, frame):
    sample = samples[frame]
    leg = sample['legs'][side]
    hip, ankle = Vector(leg['hip']), Vector(leg['ankle'])
    source_hip = Vector(bones['thigh_' + side][1])
    source_knee = Vector(bones['shin_' + side][1])
    source_ankle = Vector(bones['foot_' + side][1])
    sign = math.copysign(1, signed_knee_distance(source_hip, source_ankle, source_knee))
    a, b = leg['lengths']
    delta = ankle - hip
    distance = delta.length
    along = (a*a - b*b + distance*distance) / (2*distance)
    offset = math.sqrt(max(0, a*a - along*along))
    direction = delta.normalized()
    knee = hip + along*direction + sign*offset*Vector((-direction.y, direction.x))
    return hip, knee, ankle

bpy.ops.wm.open_mainfile(filepath=str(BASE / 'actor-v06-editable.blend'), load_ui=False, use_scripts=False)
rig = bpy.data.objects[report['rigName']]
scene = bpy.context.scene

def orient(name, start, end):
    rest = rig.data.bones[name].matrix_local.copy()
    desired = coord(end) - coord(start)
    matrix = rest.to_3x3().col[1].rotation_difference(desired).to_matrix().to_4x4() @ rest
    matrix.translation = coord(start)
    rig.pose.bones[name].matrix = matrix
    bpy.context.view_layer.update()

records = []
for side in ['R', 'L']:
    h, k, a = [Vector(bones[n + side][1]) for n in ['thigh_', 'shin_', 'foot_']]
    old = samples[1]['legs'][side]
    old_sign = signed_knee_distance(Vector(old['hip']), Vector(old['ankle']), Vector(old['knee']))
    original_sign = signed_knee_distance(h, a, k)
    assert original_sign * old_sign < 0, 'The source/first-frame branch flip is no longer reproducible'
    records.append({'side': side, 'sourceKneeSignedOffsetPx': original_sign,
                    'firstFrameSignedOffsetPx': old_sign, 'branchFlipsOnFirstFrame': True,
                    'sourceKnee': list(k), 'firstFrameKnee': old['knee']})

def render(frame, branch):
    scene.frame_set(frame)
    action = rig.animation_data.action
    # Rendering re-evaluates animation. Detach the sampled action while posing
    # the diagnostic, otherwise its keyframes silently undo these overrides.
    rig.animation_data.action = None
    expected = {}
    if branch == 'source' and frame:
        for side in ['R', 'L']:
            hip, knee, ankle = source_branch(side, frame)
            expected[side] = knee
            orient('thigh_' + side, hip, knee)
            orient('shin_' + side, knee, ankle)
            toe = Vector(bones['foot_' + side][2]) - Vector(bones['foot_' + side][1])
            orient('foot_' + side, ankle, ankle + toe)
    path = OUT / f'{branch}-{frame:03}.png'
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for side, knee in expected.items():
        assert (rig.pose.bones['shin_' + side].head - coord(knee)).length < 1e-3
    rig.animation_data.action = action
    return path

images = [(0, 'original'), (1, 'legacy'), (1, 'source'),
          (8, 'source'), (13, 'source'), (18, 'source'), (23, 'source'), (31, 'source')]
sheet = Image.new('RGB', (1200, 860), '#dce1d1')
draw = ImageDraw.Draw(sheet)
for index, (frame, branch) in enumerate(images):
    path = render(frame, branch)
    x, y = index % 4 * 300, index // 4 * 430
    draw.text((x+8, y+6), f'INTERNAL ONLY / {branch} / frame {frame}', fill='#1e332b')
    actor = Image.open(path).convert('RGBA')
    sheet.paste(actor, (x, y+26), actor)
sheet.save(OUT / 'internal-contact-sheet.png')
(OUT / 'diagnosis.json').write_text(json.dumps({
    'status': 'internal-diagnosis-not-art-approved',
    'sourceSpecificationSha256': hashlib.sha256(spec_path.read_bytes()).hexdigest(),
    'sourceRigSha256': hashlib.sha256((BASE / 'actor-v06-editable.blend').read_bytes()).hexdigest(),
    'finding': 'The first posed frame switches both knees to the opposite planar IK branch from the source rest.',
    'diagnostics': records,
    'limits': ['Alternative branch is a diagnostic, not an authored gait.',
               'Neither branch resolves hidden clothing, projected anatomy, or leg crossing.',
               'No source, release atlas, or homepage assets modified.'],
    'artApproved': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Internal diagnosis saved to ' + str(OUT))
