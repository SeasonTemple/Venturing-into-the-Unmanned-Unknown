"""Whole-character reference pose and lit-surface revision, from shared source.

No raster deformation, generated media, runtime shader or walking claims.
Arm split bones share a rigid segment transform; grip stays in wrist space.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, required=True)
parser.add_argument('--samples', type=int, default=32)
args = parser.parse_args()
out = args.out_dir.resolve()
if out.exists():
    raise ValueError('Use a new directory')
out.mkdir(parents=True)
base = ROOT / 'prototypes/visual-direction/actor-fieldwear-design-v01'
shutil.copytree(base / 'source', out / 'source')
for label in ['front-quarter', 'turned']:
    shutil.copy2(base / (label + '.png'), out / ('before-' + label + '.png'))
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.open_mainfile(filepath=str(base / 'representation-study.blend'))
scene = bpy.context.scene
scene.frame_set(1)
rig = bpy.data.objects['Fieldworker_master_rig']
rig.animation_data_clear()
rig.rotation_euler.z = 0
pose = rig.pose.bones


def update():
    bpy.context.view_layer.update()


def smooth(a, b, value):
    t = min(1, max(0, (value - a) / (b - a)))
    return t*t*(3-2*t)


def rgba(color):
    values = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)


def palette(name, colors):
    material = bpy.data.materials[name]
    for element, color in zip(material.node_tree.nodes['Color Ramp'].color_ramp.elements, colors):
        element.color = rgba(color)


update()
# Physical bent arm: solve one elbow on a chosen outward plane, then apply the
# same segment rotation to both twist/deform bones. Finger bases remain intact.
old = {name: pose[name].matrix.copy() for name in
       ['upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L', 'wrist.L']}
equipment = {o.name: o.matrix_world.copy() for o in scene.objects
             if o.parent == rig and o.parent_type == 'BONE' and o.parent_bone == 'wrist.L'}
bar = bpy.data.objects['Recorder_grip_bar']
bar_before = bar.matrix_world.translation.copy()
bar_axis = bar.matrix_world.to_3x3().col[1].normalized()
shoulder = pose['upperarm01.L'].head.copy()
upper_length = sum(pose[n].length for n in ['upperarm01.L', 'upperarm02.L'])
lower_length = sum(pose[n].length for n in ['lowerarm01.L', 'lowerarm02.L'])
wrist = Vector((.240, -.190, 1.106))
axis = (wrist - shoulder).normalized()
distance = (wrist - shoulder).length
along = (upper_length**2 - lower_length**2 + distance**2)/(2*distance)
radius = math.sqrt(max(0, upper_length**2 - along**2))
pole = Vector((.62, -.01, 1.19)) - shoulder
pole = (pole - axis*pole.dot(axis)).normalized()
elbow = shoulder + along*axis + radius*pole


def segment(names, start, end):
    direction = (end-start).normalized()
    offset = 0
    for name in names:
        p = pose[name]
        original = old[name].to_3x3()
        delta = original.col[1].normalized().rotation_difference(direction).to_matrix()
        p.matrix = Matrix.Translation(start + offset*direction) @ (delta @ original).to_4x4()
        offset += p.length
        update()


segment(['upperarm01.L', 'upperarm02.L'], shoulder, elbow)
segment(['lowerarm01.L', 'lowerarm02.L'], elbow, wrist)
hand_rotation = Quaternion(bar_axis, math.radians(35)).to_matrix()
pose['wrist.L'].matrix = Matrix.Translation(wrist) @ (hand_rotation @ old['wrist.L'].to_3x3()).to_4x4()
update()
# The palm turns around the round top bar. The carried recorder remains under
# gravity, translating to the new curled-finger grip point as a complete unit.
# All components share this rigid move; bar center stays in the same palm spot.
bar_shift = bar.matrix_world.translation - bar_before
for name, matrix in equipment.items():
    matrix.translation += bar_shift
    bpy.data.objects[name].matrix_world = matrix
update()
# Turn the connected head, not an image card. Preserve cervical placement.
head = pose['head']
head.matrix = Matrix.Translation(head.head) @ Matrix.Rotation(math.radians(-10), 4, 'Z') @ head.matrix.to_3x3().to_4x4()
update()

# Bounded head/jaw shaping, applied to source skin. Rest-space attributes are
# updated too, so beard regions remain on skin after the source sculpt.
body = bpy.data.objects['Continuous_human_body']
for v in body.data.vertices:
    z = v.co.z
    jaw = smooth(1.515, 1.55, z)*(1-smooth(1.59, 1.625, z))
    v.co.x *= 1+.075*jaw
    nose = (1-smooth(.008, .026, abs(v.co.x)))*smooth(1.60, 1.625, z)*(1-smooth(1.65, 1.665, z))*smooth(.12, .15, -v.co.y)
    v.co.y -= .006*nose
attribute = body.data.attributes['Body_Rest_Position']
for v in body.data.vertices:
    attribute.data[v.index].vector = v.co
body.data.update()

# Remove the round scalp dome: sweep the upper hair mass towards the forehead.
# This is source geometry, visible in both actual orientations.
hair = bpy.data.objects['Short_hair']
for v in hair.data.vertices:
    top = smooth(1.69, 1.75, v.co.z)
    v.co.y -= .012*top
    v.co.z += .009*top*(1-smooth(-.07, .06, v.co.y))
hair.data.update()

# Fitted field trousers; keep hems, crotch and garment/body occlusion intact.
coat = bpy.data.objects['Editable_coat_and_trousers']
pants = {i for p in coat.data.polygons if 'pants' in coat.material_slots[p.material_index].material.name for i in p.vertices}
for i in pants:
    v = coat.data.vertices[i]
    amount = smooth(.22, .38, v.co.z)*(1-smooth(.80, .96, v.co.z))
    center = math.copysign(.112, v.co.x)
    v.co.x = center + (v.co.x-center)*(1-.075*amount)
coat.data.update()

# Use actual Eevee irradiance with a small readable palette, avoiding the
# previous blue-channel/chromatic feedback into the lighting ramp.
for material in list(bpy.data.materials):
    if not material.use_nodes:
        continue
    nodes, links = material.node_tree.nodes, material.node_tree.links
    if not nodes.get('Color Ramp') or not nodes.get('Shader to RGB'):
        continue
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.name = 'Field_Surface_Diffuse'
    diffuse.inputs['Color'].default_value = (.8, .8, .8, 1)
    diffuse.inputs['Roughness'].default_value = 1
    rgb = nodes['Shader to RGB']
    for link in list(rgb.inputs[0].links):
        links.remove(link)
    links.new(diffuse.outputs[0], rgb.inputs[0])
    luminance = nodes.new('ShaderNodeRGBToBW')
    luminance.name = 'Field_Incident_Luminance'
    links.new(rgb.outputs['Color'], luminance.inputs[0])
    for ramp in [n for n in nodes if n.type == 'VALTORGB']:
        for link in list(ramp.inputs[0].links):
            links.remove(link)
        links.new(luminance.outputs[0], ramp.inputs[0])
        for el, position in zip(ramp.color_ramp.elements, [0, .075, .18, .34, .58]):
            el.position = position
        ramp.color_ramp.interpolation = 'CONSTANT' if material.name != 'Field_Face_Surface' else 'LINEAR'

palette('Study_NPR_coat', ['38302b', '703c29', 'ad5225', 'de852d', 'ffcd66'])
palette('Study_NPR_pants', ['142022', '252e26', '3d492c', '697548', 'a6ac6c'])
palette('Study_NPR_boots', ['101b20', '202a29', '35403a', '58634e', '8e9870'])
palette('Field_Face_Surface', ['443831', '795540', 'b3855c', 'e2b77d', 'ffe0a1'])
palette('Study_NPR_hair', ['10161c', '192024', '29302f', '40473b', '656d4e'])
palette('Field_Brown_Webbing', ['151c1c', '272b25', '413d2c', '65593d', '92815c'])
face = bpy.data.materials['Field_Face_Surface']
for el, color in zip(face.node_tree.nodes['Color Ramp.001'].color_ramp.elements,
                     ['11191f', '20272a', '343a34', '4b5041', '707054']):
    el.color = rgba(color)
# Separate a short beard from exposed cheek without expanding it into a mask.
face.node_tree.nodes['Math.019'].inputs[0].default_value = 1.558
face.node_tree.nodes['Math.018'].inputs[1].default_value = .40

sun = bpy.data.objects['Meadow_warm_sun']
sun.location = (-4, -2, 5)
sun.rotation_euler = (Vector((0, 0, .9))-sun.location).to_track_quat('-Z', 'Y').to_euler()
sun.data.energy = 2.3
sun.data.angle = math.radians(7)
bpy.data.objects['Cool_sky_fill'].data.energy = 65
bpy.data.objects['Grass_bounce'].data.energy = 20
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .10
scene.eevee.taa_render_samples = args.samples
records = []
for frame, angle, label in [(1, 0, 'front-quarter'), (2, -35, 'turned')]:
    rig.rotation_euler.z = math.radians(angle)
    rig.keyframe_insert('rotation_euler', frame=frame)
    scene.frame_set(frame)
    update()
    anchor = world_to_camera_view(scene, scene.camera, Vector((0, 0, 0)))
    records.append({'frame': frame, 'pose': label, 'rootAngleDegrees': angle,
                    'anchor': [anchor.x*160, (1-anchor.y)*224], 'sameCamera': True,
                    'sourceJointPoseUnchanged': False})
for curve in rig.animation_data.action.fcurves:
    for key in curve.keyframe_points:
        key.interpolation = 'CONSTANT'
scene.frame_set(1)
scene.render.filepath = '//front-quarter.png'
scene['study_status'] = 'Reference bent-arm pose and light-block revision; not approved walking.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'), compress=True)
for record in records:
    scene.frame_set(record['frame'])
    scene.render.filepath = str(out/(record['pose']+'.png'))
    bpy.ops.render.render(write_still=True)
study = json.loads((base/'study.json').read_text(encoding='utf-8'))
study.update({'parentStudy': str(base.relative_to(ROOT)),
              'parentBlendSha256': hashlib.sha256((base/'representation-study.blend').read_bytes()).hexdigest(),
              'frames': records, 'method': 'Source sculpt, connected bent-arm reference pose, actual irradiance palette shading.',
              'renderSamples': args.samples, 'lightDirection': list(sun.location),
              'comparisonTitle': '屈肘持物与光照色块',
              'comparisonFooter': '同相机；本轮同时调整完整姿态、源形体和光照，不作为单变量实验。',
              'poseChanges': ['Left elbow solved outward; split arm bones share segment rotation.',
                              'Palm rotated 35 degrees about round grip axis to reduce wrist bend; complete recorder retains gravity orientation at the moved grip.',
                              'Connected head yaw -10 degrees.'],
              'designChanges': ['Fitted trouser legs, stronger jaw and swept hair source geometry.',
                                'Actual light luminance feeds ramps, replacing chromatic feedback.',
                                'Warm left key, cool fill and deeper clothing shadow groups.'],
              'leftArm': {'shoulder': list(shoulder), 'elbow': list(elbow), 'wrist': list(wrist)},
              'gripValidation': 'center-and-bar-axis',
              'sourceLimitations': ['Reference alignment is interpretive, not an exact original-illustration reconstruction.',
                                    'Cloth fold design and painterly pixel grouping remain under art review.',
                                    'Static views only; no walking approved.'],
              'artApproved': False, 'walkingApproved': False, 'homepageIntegrated': False})
(out/'study.json').write_text(json.dumps(study, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Saved connected reference pose and both lit views.', flush=True)
