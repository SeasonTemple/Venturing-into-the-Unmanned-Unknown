"""Reproduce a pinned COA sample using its original sprites, mesh, weights and clips.

Run with the local Blender Python environment. Download sources with the research
fetcher first. No original sample scripts or legacy add-on code are executed.
This is a pipeline experiment using a third-party character, not homepage art.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / '.lab/pipeline-reproduction/coa-source/Sample Files/stip.blend')
parser.add_argument('--out', type=Path, default=ROOT / '.lab/pipeline-reproduction/baked')
parser.add_argument('--frames', default='0', help='Comma-separated source frame numbers')
parser.add_argument('--edit-frame', type=int, default=8)
parser.add_argument('--edit-degrees', type=float, default=0)
parser.add_argument('--inspect-only', action='store_true')
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
frames = [int(value) for value in args.frames.split(',')]
if not args.source.is_file():
    raise SystemExit('Source blend is missing; fetch the pinned sample first.')

bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()), load_ui=False, use_scripts=False)
scene = bpy.context.scene
rig = bpy.data.objects['Armature']
sprite_root = bpy.data.objects['stip']

def plain(value):
    if isinstance(value, bpy.types.ID):
        return {'idName': value.name, 'idType': value.bl_rna.identifier}
    if hasattr(value, 'to_dict'):
        return {key: plain(item) for key, item in value.to_dict().items()}
    if hasattr(value, 'to_list'):
        return [plain(item) for item in value.to_list()]
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    if isinstance(value, dict):
        return {key: plain(item) for key, item in value.items()}
    return value

report = {
    'purpose': 'Reproduce editable cutout asset -> original rig/action -> PNG frames. Not final homepage art.',
    'source': str(args.source), 'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
    'blender': bpy.app.version_string, 'sourceBlenderVersion': list(bpy.data.version),
    'sourceScriptsEnabled': False, 'legacyAddonInstalled': False,
    'animationCollections': plain(sprite_root.get('coa_anim_collections', [])),
    'sprites': [], 'action': 'Run_Armature', 'renderFrames': frames,
    'artApproved': False, 'homepageIntegrated': False,
}
for obj in scene.objects:
    if obj.type == 'MESH':
        report['sprites'].append({'name': obj.name, 'slots': plain(obj.get('coa_slot', [])),
            'activeSlot': obj.get('coa_slot_index'), 'dimensions': list(obj.dimensions),
            'uvBounds': [[min(item.uv[axis] for item in obj.data.uv_layers.active.data),
                          max(item.uv[axis] for item in obj.data.uv_layers.active.data)] for axis in [0, 1]]
                         if obj.data.uv_layers.active else None})
if args.inspect_only:
    (args.out / 'inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report['animationCollections'], ensure_ascii=False))
    raise SystemExit(0)

# Reconnect source PNGs and replace discontinued Blender Internal materials with
# unlit RGBA nodes. Preserve the original UVs, source artwork and geometry.
sprites_dir = args.source.parent / 'sprites'
for image in list(bpy.data.images):
    source_path = sprites_dir / image.name
    if source_path.is_file():
        image.filepath = str(source_path.resolve())
        image.reload()

missing = []
for material in bpy.data.materials:
    path = sprites_dir / material.name
    if not path.is_file():
        continue
    image = bpy.data.images.get(material.name) or bpy.data.images.load(str(path.resolve()))
    material.use_nodes = True
    material.node_tree.nodes.clear()
    nodes, links = material.node_tree.nodes, material.node_tree.links
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    texture.interpolation = 'Linear'
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(texture.outputs['Color'], emission.inputs['Color'])
    links.new(texture.outputs['Alpha'], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])

for obj in scene.objects:
    if obj.type != 'MESH':
        continue
    for slot in obj.material_slots:
        if slot.material and not slot.material.use_nodes:
            missing.append({'object': obj.name, 'material': slot.material.name})
if missing:
    raise RuntimeError('Unconverted visible materials: ' + json.dumps(missing))

action = bpy.data.actions['Run_Armature']
rig.animation_data.action = action
for track in rig.animation_data.nla_tracks:
    track.mute = True

if args.edit_degrees:
    action = action.copy()
    action.name = 'Run_pipeline_forearm_edit'
    rig.animation_data.action = action
    scene.frame_set(args.edit_frame)
    bone = rig.pose.bones['Forearm_L']
    original = bone.rotation_quaternion.copy()
    # Sprites lie in world XZ. The hinge normal must be transformed into the
    # bone's rest-local coordinates; local Y is generally the bone's length.
    local_axis = (bone.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))).normalized()
    bone.rotation_quaternion = Quaternion(local_axis, math.radians(args.edit_degrees)) @ original
    bone.keyframe_insert(data_path='rotation_quaternion', frame=args.edit_frame, group=bone.name)
    report['edit'] = {'bone': bone.name, 'sourceFrame': args.edit_frame,
                      'planeHingeDegrees': args.edit_degrees, 'boneLocalAxis': list(local_axis), 'action': action.name,
                      'originalQuaternion': list(original), 'editedQuaternion': list(bone.rotation_quaternion)}

# Freeze a camera envelope across the whole source cycle; no per-frame recentering.
active_action = rig.animation_data.action
rig.animation_data.action = bpy.data.actions['Run_Armature']
points = []
for frame in range(0, 21, 2):
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in scene.objects:
        if obj.type == 'MESH' and not obj.hide_render:
            evaluated = obj.evaluated_get(graph)
            points.extend(evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices)
rig.animation_data.action = active_action
minimum = Vector((min(point[axis] for point in points) for axis in range(3)))
maximum = Vector((max(point[axis] for point in points) for axis in range(3)))
center = (minimum + maximum) / 2
camera = scene.camera or bpy.data.objects.get('Camera')
if camera is None:
    camera = bpy.data.objects.new('PipelineCamera', bpy.data.cameras.new('PipelineCamera'))
    scene.collection.objects.link(camera)
scene.camera = camera
camera.location = (center.x, -25, center.z)
camera.rotation_euler = (math.pi / 2, 0, 0)
camera.data.type = 'ORTHO'
camera.data.ortho_scale = max((maximum.z - minimum.z), (maximum.x - minimum.x) / .75) * 1.16
camera.data.clip_start, camera.data.clip_end = .01, 100
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.cycles.use_denoising = False
scene.cycles.seed = 0
scene.cycles.use_animated_seed = False
scene.render.resolution_x, scene.render.resolution_y = 384, 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure, scene.view_settings.gamma = 0, 1
scene.render.fps = 30
scene.frame_start, scene.frame_end = 0, 20
scene.render.use_sequencer = False
scene.render.use_compositing = False
report['camera'] = {'location': list(camera.location), 'orthoScale': camera.data.ortho_scale,
                     'cycleBounds': [list(minimum), list(maximum)]}
report['outputSize'] = [384, 512]

# Include only used sprite textures, avoiding unrelated painter brush paths.
used_images = {node.image for material in bpy.data.materials if material.use_nodes
               for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
for image in used_images:
    image.pack()
report['packedSpriteImages'] = len(used_images)
scene.frame_set(frames[0])
master_path = args.out / 'editable-cutout.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(master_path.resolve()), compress=True)
report['editableMaster'] = master_path.name
report['frames'] = []
for frame in frames:
    scene.frame_set(frame)
    destination = args.out / ('frame-%03d.png' % frame)
    scene.render.filepath = str(destination.resolve())
    bpy.ops.render.render(write_still=True)
    report['frames'].append({'sourceFrame': frame, 'file': destination.name,
                            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
(args.out / 'bake.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'editableMaster': str(master_path), 'framesRendered': len(frames),
                  'packedTextures': len(used_images), 'artApproved': False}))
