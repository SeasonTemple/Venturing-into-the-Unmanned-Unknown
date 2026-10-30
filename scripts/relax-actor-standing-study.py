"""Author a whole relaxed loaded standing pose on the editable representation study.

No raster deformation, animation retargeting or source master overwrites.
Two root orientations retain the same camera, lighting and pixel materials.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, required=True)
args = parser.parse_args()
out = args.out_dir.resolve()
if out.exists():
    raise ValueError('Choose a new output directory')
base = ROOT/'prototypes/visual-direction/actor-representation-study-v01'
out.mkdir(parents=True)
shutil.copytree(base/'source', out/'source')
for label in ['front-quarter', 'turned']:
    shutil.copy2(base/(label+'.png'), out/('before-'+label+'.png'))
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.open_mainfile(filepath=str(base/'representation-study.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Fieldworker_master_rig']
scene.frame_set(1)
rig.animation_data_clear()
rig.rotation_euler.z = 0
bpy.context.view_layer.update()
pose = rig.pose.bones
original_foot_rotations = {side: pose['foot.'+side].matrix.to_3x3().copy() for side in ['L', 'R']}
original_ankles = {side: pose['foot.'+side].head.copy() for side in ['L', 'R']}


def update():
    bpy.context.view_layer.update()


def aim(name, direction):
    """Rotate the entire bone frame, preserving its roll and connected hierarchy."""
    update()
    pb = pose[name]
    matrix = pb.matrix.copy()
    current = matrix.to_3x3() @ Vector((0, 1, 0))
    rotation = current.rotation_difference(Vector(direction).normalized())
    pb.matrix = Matrix.Translation(matrix.translation) @ rotation.to_matrix().to_4x4() @ matrix.to_3x3().to_4x4()
    update()


def chain(names, start, end):
    for name in names:
        aim(name, end-start)


def leg(side, ankle):
    upper = ['upperleg01.'+side, 'upperleg02.'+side]
    lower = ['lowerleg01.'+side, 'lowerleg02.'+side]
    hip = pose[upper[0]].head.copy()
    a, b = [sum(rig.data.bones[n].length for n in names) for names in [upper, lower]]
    delta = ankle-hip
    distance = delta.length
    assert abs(a-b)+.0001 < distance < a+b-.0001, (side, distance, a+b)
    axis = delta.normalized()
    pole = Vector((0, -1, 0))  # Knees flex forward, along the actual shoe direction.
    pole = (pole-axis*pole.dot(axis)).normalized()
    along = (a*a-b*b+distance*distance)/(2*distance)
    height = math.sqrt(max(0, a*a-along*along))
    knee = hip+axis*along+pole*height
    chain(upper, hip, knee)
    chain(lower, knee, ankle)
    foot = pose['foot.'+side]
    yaw = math.radians(-4 if side == 'L' else 4)
    foot.matrix = Matrix.Translation(foot.head) @ (Matrix.Rotation(yaw, 3, 'Z') @ original_foot_rotations[side]).to_4x4()
    update()
    assert (pose[lower[-1]].tail-ankle).length < .0001


def snapshot():
    update()
    joints = {name: [round(v, 6) for v in pose[name].head] for name in [
        'root', 'neck01', 'head', 'upperarm01.L', 'upperarm01.R',
        'upperleg01.L', 'upperleg01.R', 'lowerleg01.L', 'lowerleg01.R',
        'foot.L', 'foot.R', 'wrist.L', 'wrist.R']}
    return {'jointsRigLocal': joints,
            'ankleSpacingMeters': abs(pose['foot.L'].head.x-pose['foot.R'].head.x),
            'shoulderHeightMeters': {s: pose['upperarm01.'+s].head.z for s in ['L', 'R']}}


before = snapshot()
# The suit was authored with more shoulder padding than this field jacket.
# Fit its upper shell towards the actual continuous body, keeping 12mm of
# clearance and capping each rest-space correction at 12mm. Inner shirt and
# trousers are excluded; this is a source-mesh edit, not a rendered pixel patch.
body = bpy.data.objects['Continuous_human_body']
surface = BVHTree.FromPolygons([v.co for v in body.data.vertices],
                              [list(p.vertices) for p in body.data.polygons])
coat = bpy.data.objects['Editable_coat_and_trousers']
coat_vertices = {i for p in coat.data.polygons
                 if 'coat' in coat.material_slots[p.material_index].material.name
                 for i in p.vertices}
def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)
fitted = 0
for i in coat_vertices:
    v = coat.data.vertices[i]
    w = smooth(.065, .13, abs(v.co.x))*(1-smooth(.24, .31, abs(v.co.x)))*smooth(1.30, 1.40, v.co.z)
    if not w:
        continue
    point, normal, _, distance = surface.find_nearest(v.co)
    if point is not None and (v.co-point).dot(normal) > 0 and distance > .012:
        v.co -= (v.co-point).normalized()*min(.012, distance-.012)*w
        fitted += 1

# A small whole-body height adjustment preserves almost straight relaxed knees
# when bringing the ankle centers below the hip joints. The soles stay at their
# original height; no independent boot offsets or scaling are applied.
root_matrix = pose['root'].matrix.copy()
root_matrix.translation.z += .0065
pose['root'].matrix = root_matrix
update()
for side, sign in [('R', -1), ('L', 1)]:
    ankle = original_ankles[side].copy()
    ankle.x = sign*.112
    leg(side, ankle)

# Lower the shoulder girdle as a chain, then orient both upper-arm subdivisions
# together; rotating only the short proximal segment is not an anatomical pose.
for side, sign in [('R', -1), ('L', 1)]:
    clavicle = pose['clavicle.'+side]
    direction = clavicle.tail-clavicle.head
    direction.z -= .011
    aim(clavicle.name, direction)
    shoulder = pose['shoulder01.'+side]
    direction = shoulder.tail-shoulder.head
    direction.z -= .008
    aim(shoulder.name, direction)
    shoulder_head = pose['upperarm01.'+side].head.copy()
    upper_direction = Vector((sign*.075, -.015, -1)).normalized()
    for name in ['upperarm01.'+side, 'upperarm02.'+side]:
        aim(name, upper_direction)
    # The case-carrying right arm hangs more directly; the left arm has a small
    # natural elbow bend. Equipment keeps its actual bone-parent attachments.
    lower_direction = Vector((sign*.035, -.11 if side == 'R' else -.20, -1)).normalized()
    for name in ['lowerarm01.'+side, 'lowerarm02.'+side]:
        aim(name, lower_direction)
    aim('wrist.'+side, (0, -.08, -1))

# Recenter the cervical curve above the thorax rather than leaving the source
# head thrust forward. Retain the head's orientation and all facial geometry.
head_rotation = pose['head'].matrix.to_3x3().copy()
for name, direction in [('neck01', (0, -.04, 1)), ('neck02', (0, -.10, 1)), ('neck03', (0, -.16, 1))]:
    aim(name, direction)
pose['head'].matrix = Matrix.Translation(pose['head'].head) @ head_rotation.to_4x4()
update()

after = snapshot()
records = []
for frame, angle, label in [(1, 0, 'front-quarter'), (2, -35, 'turned')]:
    rig.rotation_euler.z = math.radians(angle)
    rig.keyframe_insert('rotation_euler', frame=frame)
    scene.frame_set(frame)
    update()
    ground = world_to_camera_view(scene, scene.camera, Vector((0, 0, 0)))
    records.append({'frame': frame, 'pose': label, 'rootAngleDegrees': angle,
                    'anchor': [ground.x*160, (1-ground.y)*224],
                    'sameCamera': True, 'sourceJointPoseUnchanged': False})
for curve in rig.animation_data.action.fcurves:
    for point in curve.keyframe_points:
        point.interpolation = 'CONSTANT'
scene.frame_set(1)
scene.render.filepath = '//front-quarter.png'
scene['study_status'] = 'Relaxed loaded standing correction. Not approved character art or walking.'
scene['pose_change'] = 'Whole leg chains, shoulder girdle and arm chains edited; no mesh scaling.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'), compress=True)
for record in records:
    scene.frame_set(record['frame'])
    scene.render.filepath = str(out/(record['pose']+'.png'))
    bpy.ops.render.render(write_still=True)
study = json.loads((base/'study.json').read_text(encoding='utf-8'))
study.update({'frames': records, 'method': 'Whole standing pose correction on an editable full 3D character.',
              'parentStudy': str(base.relative_to(ROOT)),
              'parentBlendSha256': hashlib.sha256((base/'representation-study.blend').read_bytes()).hexdigest(),
              'poseChanges': ['Ankle centers narrowed from source rest spread to 224mm.',
                             'Forward knee flex, foot orientation kept from original and yawed outward four degrees.',
                             'Whole-body height plus 6.5mm; feet retain original height.',
                             'Lowered clavicle/shoulder chain and aligned split upper/lower-arm bones.',
                             'Recentered cervical curve; retained head orientation and face geometry.',
                             f'Fitted {fitted} upper-shell vertices toward body with 12mm clearance and 12mm displacement cap.'],
              'sourceLimitations': ['Generic face and clothing still under art review.',
                                    'Static standing only; no walking or turning animation approved.']})
(out/'study.json').write_text(json.dumps(study, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(out/'pose-comparison.json').write_text(json.dumps({'before': before, 'after': after}, indent=2)+'\n', encoding='utf-8')
print('Saved corrected whole standing pose and both complete orientations.', flush=True)
