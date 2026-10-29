"""Replace the invented top-carry loop with an actual palm-side rear grip.

The unchanged curled hand grasps the rear bar; screen and housing sit on the
palm side. Device top follows finger longitudinal direction for lifted use.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, required=True)
args = parser.parse_args()
out = args.out_dir.resolve()
if out.exists():
    raise ValueError('Choose a new output directory')
out.mkdir(parents=True)
base = ROOT/'prototypes/visual-direction/actor-reference-pose-v02'
shutil.copytree(base/'source', out/'source')
for label in ['front-quarter', 'turned']:
    shutil.copy2(base/(label+'.png'), out/('before-'+label+'.png'))
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.open_mainfile(filepath=str(base/'representation-study.blend'))
scene = bpy.context.scene
scene.frame_set(1)
rig = bpy.data.objects['Fieldworker_master_rig']
rig.animation_data_clear()
rig.rotation_euler.z = 0
bpy.context.view_layer.update()
p = rig.pose.bones
wrist = p['wrist.L'].head
index = p['finger2-1.L'].head
little = p['finger5-1.L'].head
up = ((index+little)*.5-wrist).normalized()
normal = up.cross((index-little).normalized()).normalized()
width = up.cross(normal).normalized()
up = normal.cross(width).normalized()
bar = bpy.data.objects['Recorder_grip_bar']
pivot = bar.matrix_world.translation.copy()
# These points are in rig space; the rig has only its saved ground offset.
world_normal = (rig.matrix_world.to_3x3() @ normal).normalized()
world_up = (rig.matrix_world.to_3x3() @ up).normalized()
world_width = world_up.cross(world_normal).normalized()
orientation = Matrix((world_normal, world_width, world_up)).transposed()
housing = bpy.data.objects['LEFT_green_recorder']
old_frame = housing.matrix_world.copy()
new_frame = orientation.to_4x4()
new_frame.translation = pivot+world_normal*.048
# Keep the original height/width but make a handheld instrument rather than a
# 65mm-thick brick. Housing, display and buttons share the same depth change.
depth = Matrix.Diagonal((.58, 1, 1, 1))
move = new_frame @ depth @ old_frame.inverted()
names = [o.name for o in scene.objects if o.parent == rig and o.parent_type == 'BONE'
         and o.parent_bone == 'wrist.L' and o.name != 'Recorder_grip_bar'
         and not o.name.startswith('Recorder_top_handle_support')]
matrices = {name: bpy.data.objects[name].matrix_world.copy() for name in names}
for name, matrix in matrices.items():
    bpy.data.objects[name].matrix_world = move @ matrix
bar.data.materials.clear()
bar.data.materials.append(bpy.data.materials['Field_Brown_Webbing'])
for ob in list(scene.objects):
    if ob.name.startswith('Recorder_top_handle_support'):
        bpy.data.objects.remove(ob, do_unlink=True)


def strut(name, start, end):
    direction = end-start
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.005, depth=direction.length,
                                      location=(start+end)*.5)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    ob.data.materials.append(bpy.data.materials['Study_NPR_metal'])
    world = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = 'wrist.L'
    ob.matrix_world = world


# Two physical mounts, replacing the old unsupported rotating top-handle story.
axis = bar.matrix_world.to_3x3().col[1].normalized()
for sign, label in [(-1, 'A'), (1, 'B')]:
    start = pivot+axis*.037*sign
    strut('Recorder_rear_grip_mount.'+label, start, start+world_normal*.030)
bpy.context.view_layer.update()
records = []
for frame, angle, label in [(1, 0, 'front-quarter'), (2, -35, 'turned')]:
    rig.rotation_euler.z = math.radians(angle)
    rig.keyframe_insert('rotation_euler', frame=frame)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    anchor = world_to_camera_view(scene, scene.camera, Vector((0, 0, 0)))
    records.append({'frame': frame, 'pose': label, 'rootAngleDegrees': angle,
                    'anchor': [anchor.x*160, (1-anchor.y)*224], 'sameCamera': True,
                    'sourceJointPoseUnchanged': True})
for curve in rig.animation_data.action.fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'CONSTANT'
scene.frame_set(1)
scene.render.filepath = '//front-quarter.png'
scene['study_status'] = 'Rear-grip ergonomic revision; screen on palm side. Not final art.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'), compress=True)
for record in records:
    scene.frame_set(record['frame'])
    scene.render.filepath = str(out/(record['pose']+'.png'))
    bpy.ops.render.render(write_still=True)
study = json.loads((base/'study.json').read_text(encoding='utf-8'))
study.update({'parentStudy': str(base.relative_to(ROOT)),
              'parentBlendSha256': hashlib.sha256((base/'representation-study.blend').read_bytes()).hexdigest(),
              'frames': records, 'method': 'Source ergonomic revision: palm-side housing and fixed rear grip.',
              'gripValidation': 'full-matrix',
              'gripDesign': {'type': 'rear-bar', 'screenOnPalmSide': True,
                             'palmNormalRigSpace': list(normal), 'palmLongitudinalRigSpace': list(up),
                             'housingCenterOffsetFromBarMeters': .048,
                             'housingDepthMeters': .065*.58,
                             'relativeDeviceAndHandMotionAllowed': False},
              'comparisonTitle': '掌侧背握设备',
              'comparisonFooter': '修改设备与手的实际关系；携带时屏幕朝内，抬起时由前臂带到眼前。',
              'designChanges': ['Housing on palm side; rear mounts physically join the curled-finger bar.',
                                'Device top follows finger longitudinal axis; no invented top-loop hinge.'],
              'sourceLimitations': ['Face and painterly cloth grouping remain under art review.',
                                    'Changed instrument grip from top carry to rear grip for usable inspection.'],
              'artApproved': False, 'walkingApproved': False, 'homepageIntegrated': False})
(out/'study.json').write_text(json.dumps(study, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Saved actual palm-side rear grip and two source views.', flush=True)
