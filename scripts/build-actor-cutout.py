"""Migrate the approved raster into an editable layered Blender pose study.

No generated new identity, video cutout, mirrored equipment or body resizing.
Layer masks/rig/pose controls are authored in actor-rig-v01.spec.json.
Hidden sleeve caps are small nearest-cloth fills under the original jacket;
they are provisional underpainting, not a complete new view of the person.
Run with the local Python containing bpy 4.5.3 and Pillow.
"""
import argparse
import hashlib
import io
import json
import math
import os
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, fromstring, tostring

import bpy
from mathutils import Matrix, Quaternion, Vector
from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'prototypes/visual-direction/actor-rig-media'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--layers-ora', type=Path, help='Reimport edited named layers from an OpenRaster master')
parser.add_argument('--out-dir', type=Path, default=BASE, help='Separate output directory for edited variants')
parser.add_argument('--spec', type=Path, default=BASE/'actor-rig-v01.spec.json', help='Versioned source, rig and pose specification')
parser.add_argument('--keys-only', action='store_true', help='Inspect authored poses before rendering a full motion study')
args = parser.parse_args()
OUT = args.out_dir.resolve()
SPEC = args.spec.resolve()
spec = json.loads(SPEC.read_text(encoding='utf-8'))
TAG = spec['version'].replace('actor-rig-', 'actor-')
if not TAG.replace('-', '').isalnum():
    raise ValueError('Version must be an alphanumeric filename tag')
LAYER_DIR = 'layers-'+TAG.removeprefix('actor-')
if args.layers_ora and (OUT == BASE.resolve() or (OUT / (TAG+'-layers.ora')) == args.layers_ora.resolve()):
    raise ValueError('Use a separate --out-dir for edited art; keep the original and input master intact')
if SPEC != (BASE/'actor-rig-v01.spec.json').resolve() and OUT == BASE.resolve():
    raise ValueError('Export a new specification to its own --out-dir')
source = (SPEC.parent / spec['source']).resolve()
original = Image.open(source).convert('RGBA')
W, H = original.size
assert [W, H] == spec['sourceSize']
OUT.mkdir(parents=True, exist_ok=True)
(OUT / LAYER_DIR).mkdir(exist_ok=True)
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()

def polygon_mask(points):
    mask = Image.new('L', (W, H))
    ImageDraw.Draw(mask).polygon([tuple(p) for p in points], fill=255)
    return mask

# Assign each original pixel exactly once. Continuous head-neck-jacket artwork
# avoids a new hard cut through the collar. Leg meshes include the actual boots.
names = ['leg_R', 'leg_L', 'pelvis', 'arm_R', 'arm_L', 'upper_body',
         'toolbox_R', 'glove_R', 'recorder_L']
ownership = {name: Image.new('L', (W, H)) for name in names}
poly = {name: polygon_mask(points) for name, points in spec['ownershipPolygons'].items()}
for y in range(H):
    for x in range(W):
        if not original.getpixel((x, y))[3]:
            continue
        name = 'upper_body' if y < 180 else ('pelvis' if y < 208 else ('leg_R' if x < 79 else 'leg_L'))
        for candidate in ['arm_R', 'arm_L', 'toolbox_R', 'glove_R', 'recorder_L']:
            if poly[candidate].getpixel((x, y)):
                name = candidate
        ownership[name].putpixel((x, y), 255)

layers = {}
for name in names:
    image = original.copy()
    image.putalpha(ImageChops.multiply(original.getchannel('A'), ownership[name]))
    layers[name] = image

# Extra hip coverage remains hidden behind the opaque original pelvis. Do not
# stretch a trouser strip down the leg; retain each actual complete leg texture.
for name, lo, hi in [('leg_R', 36, 84), ('leg_L', 75, 121)]:
    for y in range(174, 210):
        for x in range(lo, hi):
            rgba = original.getpixel((x, y))
            if rgba[3] == 255 and ownership['pelvis'].getpixel((x, y)):
                layers[name].putpixel((x, y), rgba)

cap_counts = {}
cap_maps = {}
for name, cap in spec['hiddenCaps'].items():
    mask = polygon_mask(cap['polygon'])
    added = Image.new('L', (W, H))
    samples = [(x, y) for y in range(*cap['sampleY']) for x in range(W)
               if ownership[name].getpixel((x, y)) and original.getpixel((x, y))[3] == 255]
    for y in range(H):
        for x in range(W):
            if (mask.getpixel((x, y)) and ownership['upper_body'].getpixel((x, y))
                    and original.getpixel((x, y))[3] == 255):
                # Nearest visible sleeve colour only inside the occluded cap.
                sx, sy = min(samples, key=lambda p: (p[0]-x)**2 + (p[1]-y)**2)
                layers[name].putpixel((x, y), original.getpixel((sx, sy)))
                added.putpixel((x, y), 255)
    cap_maps[name] = added
    cap_counts[name] = sum(bool(v) for v in added.get_flattened_data())

layer_input = None
if args.layers_ora:
    input_path = args.layers_ora.resolve()
    layer_input = {'file': os.path.relpath(input_path, OUT),
                   'sha256': hashlib.sha256(input_path.read_bytes()).hexdigest()}
    with zipfile.ZipFile(input_path) as archive:
        tree = fromstring(archive.read('stack.xml'))
        if (int(tree.attrib['w']), int(tree.attrib['h'])) != (W,H):
            raise ValueError('Edited master changed the shared source canvas size')
        records = tree.findall('.//layer')
        # The layer contract keeps names, order, alpha and original canvas;
        # cropped storage used by painting programs is restored by x/y offsets.
        if [node.attrib['name'] for node in records] != list(reversed(names)):
            raise ValueError('Keep the nine layer names/order when editing the master')
        for node in records:
            if (node.get('visibility', 'visible') != 'visible' or float(node.get('opacity', '1')) != 1
                    or node.get('composite-op', 'svg:src-over') != 'svg:src-over'):
                raise ValueError('Rasterize effects; keep layers visible, normal blend, full opacity')
            restored = Image.new('RGBA', (W,H))
            part = Image.open(io.BytesIO(archive.read(node.attrib['src']))).convert('RGBA')
            restored.alpha_composite(part, (int(node.get('x','0')),int(node.get('y','0'))))
            layers[node.attrib['name']] = restored

reassembled = Image.new('RGBA', original.size)
for name in names:
    reassembled.alpha_composite(layers[name])
source_layer_identical = ImageChops.difference(original, reassembled).getbbox(alpha_only=False) is None
if not args.layers_ora:
    assert source_layer_identical, 'Layer rest pose changes original'
reassembled.save(OUT / (TAG+'-layer-rest.png'))
for name in names:
    layers[name].save(OUT / LAYER_DIR / (name + '.png'))

# OpenRaster is a portable paint source; the .blend is the rig/action source.
root = Element('image', {'w': str(W), 'h': str(H), 'name': TAG+' / layered migration', 'version': '0.0.3'})
stack = SubElement(root, 'stack')
with zipfile.ZipFile(OUT / (TAG+'-layers.ora'), 'w') as archive:
    archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
    for index, name in reversed(list(enumerate(names))):
        path = 'data/layer-%02d.png' % index
        stream = io.BytesIO(); layers[name].save(stream, format='PNG')
        archive.writestr(path, stream.getvalue())
        SubElement(stack, 'layer', {'name': name, 'src': path, 'x': '0', 'y': '0',
                   'opacity': '1.0', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
    archive.writestr('stack.xml', tostring(root, encoding='utf-8'))
    stream = io.BytesIO(); reassembled.save(stream, format='PNG')
    archive.writestr('mergedimage.png', stream.getvalue())

def coord(point, depth=0):
    return Vector((point[0] - W/2, depth, H - point[1]))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
arm = bpy.data.armatures.new(TAG+' / editable bones')
rig = bpy.data.objects.new('ActorRig-'+TAG.removeprefix('actor-'), arm)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, start, end, parent in spec['bones']:
    bone = arm.edit_bones.new(name)
    bone.head, bone.tail = coord(start), coord(end)
    if parent:
        bone.parent = arm.edit_bones[parent]
    bone.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True
rig['source_sha256'] = source_sha
rig['scope'] = spec['scope']
rig['equipment'] = 'Anatomical RIGHT silver toolbox; LEFT green recorder. No mirroring.'
rig['head_artwork'] = 'Head, neck and jacket remain one continuous mesh; no head resizing.'

def smoothstep(a, b, value):
    t = max(0, min(1, (value-a)/(b-a)))
    return t*t*(3-2*t)

def blend_weights(chain, switches, y):
    weights = {chain[0]: 1.0}
    for index, (lo, hi) in enumerate(switches):
        t = smoothstep(lo, hi, y)
        retained = weights.pop(chain[index], 0)
        weights[chain[index]] = retained*(1-t)
        weights[chain[index+1]] = retained*t
    return {name: weight for name, weight in weights.items() if weight > 1e-6}

def weights_at(name, x, y):
    if name == 'upper_body':
        t = smoothstep(51, 72, y)
        return {'head': 1-t, 'torso': t}
    hip_window = spec.get('skinning', {}).get('hipTransition', [186, 213])
    if spec.get('skinning', {}).get('sharedHipWeights') and (name == 'pelvis' or (name.startswith('leg_') and y <= hip_window[1])):
        t = smoothstep(*hip_window, y)
        side = smoothstep(75, 84, x)
        windows=spec.get('skinning',{}).get('hipTransitionBySide')
        if windows:
            right=smoothstep(*windows.get('R',hip_window),y)*(1-side)
            left=smoothstep(*windows.get('L',hip_window),y)*side
            return {'pelvis':1-right-left, 'thigh_R':right, 'thigh_L':left}
        return {'pelvis':1-t, 'thigh_R':t*(1-side), 'thigh_L':t*side}
    if name == 'pelvis':
        return {'pelvis': 1}
    if name.startswith('leg_'):
        side = name[-1]
        switches = [(186, 213), (244, 264), (309, 322)] if side == 'R' else [(187, 214), (251, 271), (319, 332)]
        if spec.get('skinning', {}).get('sharedHipWeights'):
            switches[0] = spec.get('skinning',{}).get('hipTransitionBySide',{}).get(side,hip_window)
        return blend_weights(['pelvis', 'thigh_'+side, 'shin_'+side, 'foot_'+side], switches, y)
    if name == 'arm_R':
        return blend_weights(['upperarm_R', 'forearm_R', 'hand_R'], [(110,128), (149,164)], y)
    if name == 'arm_L':
        # Forearm doubles back up in the image; distance along the upper arm
        # separates it from the return segment rather than a row-only split.
        if x > 128 and y > 115:
            t = smoothstep(126, 137, y)
            return {'upperarm_L': 1-t, 'forearm_L': t}
        if y > 132:
            t = smoothstep(142, 159, y)
            return {'forearm_L': 1-t, 'hand_L': t}
        return {'upperarm_L': 1}
    return {'hand_R' if name == 'glove_R' else name: 1}

mesh_records = []
for index, name in enumerate(names):
    layer = layers[name]
    x0, y0, x1, y1 = layer.getbbox()
    # Fine regular mesh only where texture exists. Source UVs never change.
    xs = sorted(set(list(range(x0, x1, 3)) + [x1]))
    ys = sorted(set(list(range(y0, y1, 3)) + [y1]))
    verts, faces, uv_coords, mapping = [], [], [], {}
    def vertex(ix, iy):
        key = (ix, iy)
        if key not in mapping:
            x, y = xs[ix], ys[iy]
            mapping[key] = len(verts)
            verts.append(coord((x, y)))
            uv_coords.append((x/W, 1-y/H))
        return mapping[key]
    alpha = layer.getchannel('A')
    for iy in range(len(ys)-1):
        for ix in range(len(xs)-1):
            if not alpha.crop((xs[ix], ys[iy], xs[ix+1], ys[iy+1])).getbbox():
                continue
            a,b,c,d = vertex(ix,iy),vertex(ix+1,iy),vertex(ix+1,iy+1),vertex(ix,iy+1)
            faces.extend([(a,b,c), (a,c,d)])
    mesh = bpy.data.meshes.new(name+' / skinned source grid')
    mesh.from_pydata(verts, [], faces); mesh.update()
    uv = mesh.uv_layers.new(name='Original pixel coordinates')
    for face in mesh.polygons:
        for li in face.loop_indices:
            uv.data[li].uv = uv_coords[mesh.loops[li].vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    # All bones deform in XZ; object depth only controls compositing order.
    obj.location.y = -index * .15
    obj.parent = rig
    groups = {}
    for vi, vertex_co in enumerate(verts):
        x, y = vertex_co.x + W/2, H - vertex_co.z
        for bone_name, weight in weights_at(name, x, y).items():
            if weight <= 1e-6:
                continue
            group = groups.get(bone_name)
            if group is None:
                group = obj.vertex_groups.new(name=bone_name); groups[bone_name] = group
            group.add([vi], weight, 'REPLACE')
    modifier = obj.modifiers.new('Editable armature deformation', 'ARMATURE')
    modifier.object = rig
    modifier.use_deform_preserve_volume = bool(spec.get('skinning', {}).get('preserveLegVolume')) and name in ['leg_R', 'leg_L', 'pelvis']
    image = bpy.data.images.load(str((OUT / LAYER_DIR / (name+'.png')).resolve()), check_existing=False)
    image.pack()
    mat = bpy.data.materials.new(name+' / original RGBA unlit')
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image; tex.interpolation = 'Closest'; tex.extension = 'CLIP'
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader'); output = nodes.new('ShaderNodeOutputMaterial')
    links.new(tex.outputs['Color'], emission.inputs['Color'])
    links.new(tex.outputs['Alpha'], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1]); links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface']); obj.data.materials.append(mat)
    mesh_records.append({'name': name, 'vertices': len(verts), 'triangles': len(faces), 'bones': list(groups),
                         'preserveVolume': modifier.use_deform_preserve_volume})

def rotate_bone(name, degrees):
    bone = rig.pose.bones[name]
    axis = bone.bone.matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
    bone.rotation_quaternion = Quaternion(axis.normalized(), math.radians(degrees))

def rotate_to(name, start, end):
    """Set a bone orientation from two screen-pixel points, in armature space."""
    rest = rig.data.bones[name].matrix_local.copy()
    desired = coord(end) - coord(start)
    rotation = rest.to_3x3().col[1].rotation_difference(desired)
    matrix = rotation.to_matrix().to_4x4() @ rest
    matrix.translation = coord(start)
    rig.pose.bones[name].matrix = matrix
    bpy.context.view_layer.update()

def solve_leg(side, shift, root_shift):
    definitions = {item[0]: item for item in spec['bones']}
    upper, lower, foot = ['thigh_'+side, 'shin_'+side, 'foot_'+side]
    rest_hip, rest_knee, rest_ankle = [Vector(definitions[n][1]) for n in [upper,lower,foot]]
    hip = rest_hip + Vector(root_shift)
    target = rest_ankle + Vector(shift)
    l1, l2 = (rest_knee-rest_hip).length, (rest_ankle-rest_knee).length
    if shift == root_shift:
        # The support leg can keep its exact original rest configuration.
        # Avoid flipping a nearly straight knee to the other IK solution.
        return {'hip': list(hip), 'knee': list(rest_knee+Vector(root_shift)),
                'ankle': list(target), 'lengths': [l1,l2], 'sourceConfigurationPreserved': True}
    delta = target-hip; distance = delta.length
    if distance > l1+l2+1e-4:
        raise ValueError('Leg target stretches bones: '+side)
    along = (l1*l1-l2*l2+distance*distance)/(2*distance)
    perpendicular = math.sqrt(max(0, l1*l1-along*along))
    direction = delta.normalized()
    # Knees project toward the character's screen-left facing direction.
    normal = Vector((-direction.y, direction.x))
    knee = hip + along*direction + perpendicular*normal
    rotate_to(upper, hip, knee)
    rotate_to(lower, knee, target)
    toe_vector = Vector(definitions[foot][2])-rest_ankle
    rotate_to(foot, target, target+toe_vector)
    return {'hip': list(hip), 'knee': list(knee), 'ankle': list(target), 'lengths': [l1,l2]}

def controls_for_frames():
    if not spec.get('motion'):
        return spec['poses']
    poses=sorted(spec['poses'],key=lambda p:p['frame'])
    def root_x_at(frame, first, second):
        # Optional monotone Hermite travel: do not stop at every passing pose.
        # A zero secant keeps authored starts/stops fixed without overshoot.
        xs=[p['frame'] for p in poses];ys=[p['pelvisShift'][0] for p in poses]
        hs=[b-a for a,b in zip(xs,xs[1:])]
        ds=[(b-a)/h for a,b,h in zip(ys,ys[1:],hs)]
        slopes=[0.0]*len(poses)
        for i in range(1,len(poses)-1):
            if ds[i-1]*ds[i]>0:
                w1=2*hs[i]+hs[i-1];w2=hs[i]+2*hs[i-1]
                slopes[i]=(w1+w2)/(w1/ds[i-1]+w2/ds[i])
        index=poses.index(first);h=second['frame']-first['frame']
        t=(frame-first['frame'])/h
        return ((2*t**3-3*t*t+1)*ys[index]+(t**3-2*t*t+t)*h*slopes[index]
                +(-2*t**3+3*t*t)*ys[index+1]+(t**3-t*t)*h*slopes[index+1])
    controls=[]
    for frame in range(poses[0]['frame'],poses[-1]['frame']+1):
        exact=next((p for p in poses if p['frame']==frame),None)
        if exact:
            controls.append(exact);continue
        first=next(p for p,q in zip(poses,poses[1:]) if p['frame']<frame<q['frame'])
        second=poses[poses.index(first)+1]
        t=(frame-first['frame'])/(second['frame']-first['frame']);t=t*t*(3-2*t)
        control={'frame':frame,'name':'transition-%03d'%frame,'label':'控制量过渡'}
        for key,value in first.items():
            if key in ['frame','name','label']:continue
            other=second.get(key,value)
            if isinstance(value,(float,int)):
                control[key]=value+(other-value)*t
            elif isinstance(value,list):
                control[key]=[a+(b-a)*t for a,b in zip(value,other)]
        if spec.get('motion',{}).get('rootTravelInterpolation')=='monotone-hermite':
            control['pelvisShift'][0]=root_x_at(frame,first,second)
        controls.append(control)
    return controls

def set_world_angle(name, degrees):
    """Keep a rigid prop's angle relative to gravity, around its grip pivot."""
    bone=rig.pose.bones[name]
    pivot=bone.head.copy()
    matrix=Quaternion(Vector((0,1,0)),math.radians(degrees)).to_matrix().to_4x4() @ bone.bone.matrix_local
    matrix.translation=pivot
    bone.matrix=matrix
    bpy.context.view_layer.update()

pose_records = []
sample_records = []
all_controls = controls_for_frames()
for pose in all_controls:
    scene.frame_set(pose['frame'])
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    shift = pose['pelvisShift']
    # root's local Y points up; local X follows world X. Use a world matrix
    # conversion to remove assumptions about bone roll.
    rig.pose.bones['root'].location = rig.data.bones['root'].matrix_local.to_3x3().inverted() @ Vector((shift[0],0,-shift[1]))
    rotate_bone('torso', pose['torsoDegrees'])
    rotate_bone('upperarm_R', pose['loadedArmDegrees'])
    rotate_bone('forearm_R', pose.get('forearmDegrees',-pose['loadedArmDegrees']*.5))
    bpy.context.view_layer.update()
    if pose.get('shoulderDropPx'):
        upper=rig.pose.bones['upperarm_R']
        matrix=upper.matrix.copy();matrix.translation.z-=pose['shoulderDropPx']
        upper.matrix=matrix;bpy.context.view_layer.update()
    if 'toolboxWorldDegrees' in pose:
        set_world_angle('toolbox_R',pose['toolboxWorldDegrees'])
    legs = {}
    if pose['name'] != 'standing':
        legs = {side: solve_leg(side, pose[key], shift)
                for side,key in [('R','rightFootShift'), ('L','leftFootShift')]}
    for bone in rig.pose.bones:
        bone.keyframe_insert(data_path='location', frame=pose['frame'], group=bone.name)
        bone.keyframe_insert(data_path='rotation_quaternion', frame=pose['frame'], group=bone.name)
        bone.keyframe_insert(data_path='scale', frame=pose['frame'], group=bone.name)
    ankle_error=max(((rig.pose.bones['foot_'+side].head-coord(record['ankle'])).length
                     for side,record in legs.items()),default=0)
    grip_error=(rig.pose.bones['toolbox_R'].head-rig.pose.bones['hand_R'].tail).length
    sample_records.append({'frame':pose['frame'],'rootShift':shift,'legs':legs,
        'actualAnkles':{side:[rig.pose.bones['foot_'+side].head.x+W/2,H-rig.pose.bones['foot_'+side].head.z] for side in ['R','L']},
        'ankleTargetError':ankle_error,'toolboxGripError':grip_error,
        'toolboxWorldAngleDegrees':math.degrees(math.atan2(-(rig.pose.bones['toolbox_R'].tail-rig.pose.bones['toolbox_R'].head).x,
                                                        -(rig.pose.bones['toolbox_R'].tail-rig.pose.bones['toolbox_R'].head).z))})
    if any(p['frame']==pose['frame'] for p in spec['poses']):
        pose_records.append({**pose, 'solvedLegs': legs})
        scene.timeline_markers.new(pose['name'], frame=pose['frame'])
rig.animation_data.action.name = spec.get('motion',{}).get('actionName','Same-view weighted poses / NOT a walk loop')

camera_data = bpy.data.cameras.new('Fixed pixel camera')
camera = bpy.data.objects.new('Fixed pixel camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -1000, H/2)
camera.rotation_euler = (math.pi/2, 0, 0)
camera_data.type = 'ORTHO'; camera_data.ortho_scale = 400
camera_data.clip_start, camera_data.clip_end = .1, 2000
scene.camera = camera
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = 4; scene.cycles.use_denoising = False
scene.cycles.seed = 0; scene.cycles.use_animated_seed = False
scene.cycles.pixel_filter_type = 'BOX'; scene.cycles.filter_width = .01
scene.render.resolution_x, scene.render.resolution_y = spec.get('outputSize',[220,400])
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.render.dither_intensity = 0
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
scene.render.fps = spec.get('motion',{}).get('fps',12)
scene.frame_start = spec.get('motion',{}).get('startFrame',min(p['frame'] for p in spec['poses']))
scene.frame_end = max(p['frame'] for p in spec['poses'])
scene.world = bpy.data.worlds.new('Transparent studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
scene.frame_set(scene.frame_start)
# Pack the actual constraints/specification into the editable file as text.
text = bpy.data.texts.new('READ-ME / pose study scope')
text.write('Original approved actor artwork, no new identity or mirrored equipment.\n'
           +spec['scope']+'\n'
           'Continuous head/neck/jacket mesh; nearest sampled original pixels.\n'
           'Only small hidden shoulder caps are filled from adjacent sleeve colours.\n'
           +'Key poses: '+', '.join(str(p['frame'])+' '+p['name'] for p in spec['poses'])+'\n')
text = bpy.data.texts.new(SPEC.name); text.write(SPEC.read_text(encoding='utf-8'))
bpy.ops.wm.save_as_mainfile(filepath=str((OUT/(TAG+'-editable.blend')).resolve()), compress=True)

frame_records = []
render_controls=spec['poses'] if args.keys_only or not spec.get('motion') else all_controls
for pose in render_controls:
    scene.frame_set(pose['frame'])
    target = OUT / (TAG+'-'+pose['name']+'.png')
    scene.render.filepath = str(target.resolve())
    bpy.ops.render.render(write_still=True)
    frame_records.append({'pose': pose['name'], 'frame': pose['frame'], 'file': target.name,
                          'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})

report = {'version': spec['version'], 'source': os.path.relpath(source, OUT).replace('\\','/'), 'sourceSha256': source_sha,
          'tag': TAG, 'rigName': rig.name, 'layersDirectory': LAYER_DIR,
          'specification': os.path.relpath(SPEC, OUT).replace('\\','/'),
          'specSha256': hashlib.sha256(SPEC.read_bytes()).hexdigest(),
          'sourceSize': [W,H], 'sourceLayerReassemblyPixelIdentical': source_layer_identical,
          'editableLayerInput': layer_input,
          'method': 'Original raster separation, limited nearest-cloth hidden caps, continuous skinned meshes and authored 2D bone poses',
          'newGeneratedImages': 0, 'newVideoRequests': 0,
          'hiddenCapPixels': cap_counts, 'meshes': mesh_records, 'bones': len(arm.bones),
          'poses': pose_records, 'frames': frame_records,
          'motionSamples': sample_records if spec.get('motion') else None,
          'outputSize': list(spec.get('outputSize',[220,400])),
          'sourceOffset': [(scene.render.resolution_x-W)//2,(400-H)//2],
          'artApproved': False, 'walkingValidated': False, 'homepageIntegrated': False,
          'limitations': ['One original view only', 'No full unseen anatomy or clothing redrawn',
                          'Deformation pixel clusters require visual review', 'Not a walk loop or turn animation']}
(OUT/(TAG+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'output': str(OUT), 'rendered': len(frame_records), 'artApproved':False}))
