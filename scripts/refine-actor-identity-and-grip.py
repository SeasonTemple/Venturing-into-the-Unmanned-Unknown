"""Refine the complete editable character: face, fieldwear and actual grips.

Keeps the corrected standing skeleton, original camera and two root facings.
Hand curls are authored around the anatomical palm plane, not arbitrary local X.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', required=True, type=Path)
args = parser.parse_args()
out = args.out_dir.resolve()
if out.exists():
    raise ValueError('Use a new output directory')
out.mkdir(parents=True)
base = ROOT/'prototypes/visual-direction/actor-representation-study-v02'
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
pose = rig.pose.bones
bpy.context.view_layer.update()


def update():
    bpy.context.view_layer.update()


def rgba(color):
    c = [int(color[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)


def recolor(name, colors, copy=None):
    material = bpy.data.materials[name].copy() if copy else bpy.data.materials[name]
    if copy:
        material.name = copy
    for element, color in zip(material.node_tree.nodes['Color Ramp'].color_ramp.elements, colors):
        element.color = rgba(color)
    return material


def opaque_material(material):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    output = nodes['Material Output']
    for link in list(output.inputs['Surface'].links):
        links.remove(link)
    links.new(nodes['Emission'].outputs[0], output.inputs['Surface'])


recolor('Study_NPR_coat', ['453f32', '6e4c2e', 'a66c31', 'c68b43', 'e7bb77'])
recolor('Study_NPR_pants', ['1b2928', '2c3b31', '45513b', '65714e', '94a06f'])
recolor('Study_NPR_skin', ['564331', '8e6549', 'bd8f65', 'dfb887', 'f0d2a3'])
recolor('Study_NPR_hair', ['111b1d', '182424', '25322d', '38443a', '57614a'])
recolor('Study_NPR_stubble', ['152123', '202d2b', '303c32', '46503c', '62664a'])
glove = recolor('Study_NPR_dark', ['101c1d', '172725', '263832', '3c4b3c', '5c6850'], copy='Field_Glove_opaque')
opaque_material(glove)
brow = recolor('Study_NPR_hair', ['10191b', '152122', '202e29', '303d31', '4a543e'], copy='Field_Eyebrows_opaque')
opaque_material(brow)
for side in ['L', 'R']:
    ob = bpy.data.objects['Surface_eyebrow.'+side]
    ob.data.materials.clear()
    ob.data.materials.append(brow)
    for polygon in ob.data.polygons:
        polygon.material_index = 0

# A short beard is a region on the actual jaw surface; no floating beard card.
body = bpy.data.objects['Continuous_human_body']
skin_index = next(i for i,m in enumerate(body.data.materials) if m.name == 'Study_NPR_skin')
beard_index = next(i for i,m in enumerate(body.data.materials) if m.name == 'Study_NPR_stubble')
body.data.materials.append(glove)
glove_index = len(body.data.materials)-1
for poly in body.data.polygons:
    points = [body.data.vertices[i].co for i in poly.vertices]
    center = sum(points, Vector())/len(points)
    if 1.50 < center.z < 1.69:
        poly.material_index = skin_index
        cheek_line = 1.578+.64*abs(center.x)
        if (center.z < cheek_line and center.z > 1.518 and center.y < -.065 and abs(center.x) < .087):
            poly.material_index = beard_index
    amount = sum(sum(g.weight for g in body.data.vertices[i].groups
                     if body.vertex_groups[g.group].name.startswith(('finger', 'wrist', 'metacarpal')))
                 for i in poly.vertices)/len(poly.vertices)
    if amount > .25:
        poly.material_index = glove_index

# Eye iris/pupil use rest-space coordinates stored with the eyeball mesh, so
# turning the head or root cannot slide the eye pattern across the surface.
eye = bpy.data.objects['Fitted_eyes']
attribute = eye.data.attributes.get('Eye_Rest_Position') or eye.data.attributes.new('Eye_Rest_Position', 'FLOAT_VECTOR', 'POINT')
for v in eye.data.vertices:
    attribute.data[v.index].vector = v.co
eye_material = recolor('Study_NPR_eye', ['818c78', 'a5b098', 'c9cfb2', 'e0dec0', 'eeead1'], copy='Field_Eyes_With_Iris')
opaque_material(eye_material)
nodes, links = eye_material.node_tree.nodes, eye_material.node_tree.links
attr = nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'Eye_Rest_Position'
split = nodes.new('ShaderNodeSeparateXYZ'); links.new(attr.outputs['Vector'], split.inputs[0])


def mathnode(operation, a, b):
    node = nodes.new('ShaderNodeMath'); node.operation = operation
    for socket, value in zip(node.inputs, [a, b]):
        if hasattr(value, 'node'):
            links.new(value, socket)
        else:
            socket.default_value = value
    return node.outputs[0]


x = mathnode('SUBTRACT', mathnode('ABSOLUTE', split.outputs['X'], 0), .032)
z = mathnode('SUBTRACT', split.outputs['Z'], 1.6398)
radius2 = mathnode('ADD', mathnode('MULTIPLY', x, x), mathnode('MULTIPLY', z, z))
iris = mathnode('MULTIPLY', mathnode('LESS_THAN', radius2, .0065**2), mathnode('LESS_THAN', split.outputs['Y'], -.132))
mix = nodes.new('ShaderNodeMixRGB'); mix.blend_type = 'MIX'
links.new(iris, mix.inputs[0])
links.new(nodes['Color Ramp'].outputs['Color'], mix.inputs[1])
mix.inputs[2].default_value = rgba('23312d')
links.new(mix.outputs[0], nodes['Emission'].inputs['Color'])
eye.data.materials.clear(); eye.data.materials.append(eye_material)
for poly in eye.data.polygons:
    poly.material_index = 0

# A face mask interpolated across the actual skin surface avoids the stepped
# beard boundary created by assigning entire large cheek polygons.
face = bpy.data.materials['Study_NPR_skin'].copy();face.name='Field_Face_Surface'
face.node_tree.nodes['Color Ramp'].color_ramp.interpolation='LINEAR'
attribute=body.data.attributes.get('Body_Rest_Position') or body.data.attributes.new('Body_Rest_Position','FLOAT_VECTOR','POINT')
for v in body.data.vertices:attribute.data[v.index].vector=v.co
nodes,links=face.node_tree.nodes,face.node_tree.links
attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='Body_Rest_Position'
split=nodes.new('ShaderNodeSeparateXYZ');links.new(attr.outputs['Vector'],split.inputs[0])
absx=mathnode('ABSOLUTE',split.outputs['X'],0)
cheek=mathnode('ADD',1.585,mathnode('MULTIPLY',absx,.52))
beard=mathnode('MULTIPLY',mathnode('LESS_THAN',split.outputs['Z'],cheek),mathnode('GREATER_THAN',split.outputs['Z'],1.518))
beard=mathnode('MULTIPLY',beard,mathnode('LESS_THAN',absx,.09))
beard=mathnode('MULTIPLY',beard,mathnode('LESS_THAN',split.outputs['Y'],-.058))
moustache=mathnode('MULTIPLY',mathnode('LESS_THAN',split.outputs['Z'],1.607),mathnode('GREATER_THAN',split.outputs['Z'],1.582))
moustache=mathnode('MULTIPLY',moustache,mathnode('LESS_THAN',absx,.034))
moustache=mathnode('MULTIPLY',moustache,mathnode('LESS_THAN',split.outputs['Y'],-.14))
beard=mathnode('MAXIMUM',beard,moustache)
beard_ramp=nodes.new('ShaderNodeValToRGB');beard_ramp.color_ramp.interpolation='LINEAR'
src=bpy.data.materials['Study_NPR_stubble'].node_tree.nodes['Color Ramp'].color_ramp
for i,el in enumerate(src.elements):
    dst=beard_ramp.color_ramp.elements[i] if i<2 else beard_ramp.color_ramp.elements.new(el.position)
    dst.position=el.position;dst.color=el.color
links.new(nodes['Color Ramp'].inputs[0].links[0].from_socket,beard_ramp.inputs[0])
mix=nodes.new('ShaderNodeMixRGB');links.new(beard,mix.inputs[0])
links.new(nodes['Color Ramp'].outputs['Color'],mix.inputs[1]);links.new(beard_ramp.outputs['Color'],mix.inputs[2])
links.new(mix.outputs[0],nodes['Emission'].inputs['Color'])
body.data.materials.append(face);face_index=len(body.data.materials)-1
for poly in body.data.polygons:
    if sum(body.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)>1.49:
        poly.material_index=face_index

# Smooth the old suit's small crease bulges on its torso shell only. Keep the
# jacket boundaries and shoulder edits; re-fit towards a minimum body clearance.
coat = bpy.data.objects['Editable_coat_and_trousers']
# The stock inner shirt intersects the fitted closed jacket near the collar.
# This outfit is closed: remove the hidden shirt component rather than leaving
# unexplained dark patches on the visible chest or painting over the symptoms.
bm=bmesh.new();bm.from_mesh(coat.data)
shirt_faces=[f for f in bm.faces if coat.material_slots[f.material_index].material.name=='Study_NPR_dark']
bmesh.ops.delete(bm,geom=shirt_faces,context='FACES_ONLY')
bm.to_mesh(coat.data);bm.free()
original = {v.index:v.co.copy() for v in coat.data.vertices}
shell = {i for p in coat.data.polygons
         if 'coat' in coat.material_slots[p.material_index].material.name for i in p.vertices}
bm = bmesh.new(); bm.from_mesh(coat.data); bm.verts.ensure_lookup_table()
selected = [bm.verts[i] for i in shell if not bm.verts[i].is_boundary
            and abs(bm.verts[i].co.x) < .18 and .99 < bm.verts[i].co.z < 1.42]
for _ in range(6):
    bmesh.ops.smooth_vert(bm, verts=selected, factor=.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bm.to_mesh(coat.data); bm.free()
surface = BVHTree.FromPolygons([v.co for v in body.data.vertices], [list(p.vertices) for p in body.data.polygons])
for i in shell:
    v = coat.data.vertices[i]
    delta = v.co-original[i]
    if delta.length > .015:
        v.co = original[i]+delta.normalized()*.015
    if abs(v.co.x)<.18 and .99<v.co.z<1.42:
        point, normal, _, distance = surface.find_nearest(v.co)
        if point is not None and (v.co-point).dot(normal) < .012:
            v.co = point+normal*.012
coat.data.update()
# Refit the closed placket and zipper to the revised shell. The old y offsets
# cannot be reused after smoothing; otherwise a seam alternates in/out of cloth.
coat_surface=BVHTree.FromPolygons([v.co for v in coat.data.vertices],
                                [list(p.vertices) for p in coat.data.polygons])
for name,offset in [('Closed_raincoat_placket',.0015),('Center_zipper_seam',.0022)]:
    ob=bpy.data.objects[name]
    for v in ob.data.vertices:
        if name=='Center_zipper_seam':v.co.x=math.copysign(.0025,v.co.x)
        # A center ray passes through the jacket opening and can hit its BACK.
        # Only front-facing negative-y hits are valid; sample beside the opening
        # and retain the authored front contour if the neckline has no shell.
        hits=[]
        for x in [v.co.x,-.012,.012,-.025,.025,-.04,.04,-.06,.06]:
            point,normal,_,_=coat_surface.ray_cast(Vector((x,-1,v.co.z)),Vector((0,1,0)))
            if point is not None and point.y<-.04 and normal.y<-.1:
                hits.append((abs(x),point.y))
        if hits:
            nearest=min(x for x,y in hits)
            v.co.y=sum(y for x,y in hits if x<=nearest+.001)/sum(1 for x,y in hits if x<=nearest+.001)-offset
    ob.data.update()

# The source clothes define which covered body faces must be hidden. The prior
# importer applied the shoe mask only; uncovered skin slivers beside a glove
# were actually thigh/forearm surfaces protruding through their clothes.
mask_path=ROOT/'.lab/character-master/system-assets/clothes/male_casualsuit05/male_casualsuit05.mhclo'
shutil.copy2(mask_path,out/'source/fieldwear-source.mhclo')
mask_lines=mask_path.read_text().splitlines()
start=next(i for i,line in enumerate(mask_lines) if line.strip()=='delete_verts')
tokens=' '.join(line for line in mask_lines[start+1:] if not line.startswith('#')).split()
hidden=set();i=0
while i<len(tokens):
    a=int(tokens[i])
    if i+1<len(tokens) and tokens[i+1]=='-':
        hidden.update(range(a,int(tokens[i+2])+1));i+=3
    else:
        hidden.add(a);i+=1
bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table()
faces_to_hide=[f for f in bm.faces if any(v.index in hidden for v in f.verts)]
hidden_face_count=len(faces_to_hide)
bmesh.ops.delete(bm,geom=faces_to_hide,context='FACES_ONLY')
assert len(bm.verts)==len(body.data.vertices)
bm.to_mesh(body.data);bm.free();body.data.update()


def aim(name, direction):
    update(); bone = pose[name]
    matrix = bone.matrix.copy()
    current = matrix.to_3x3() @ Vector((0,1,0))
    rotation = current.rotation_difference(Vector(direction).normalized())
    bone.matrix = Matrix.Translation(matrix.translation) @ rotation.to_matrix().to_4x4() @ matrix.to_3x3().to_4x4()
    update()


def rotate_global(name, axis, angle):
    update(); bone = pose[name]
    bone.matrix = Matrix.Translation(bone.head) @ Matrix.Rotation(angle,4,axis) @ bone.matrix.to_3x3().to_4x4()
    update()


grips = {}
for side, sign in [('R',-1), ('L',1)]:
    # Remove the previous uncalibrated finger Euler curls, retaining the wrist.
    for bone in pose:
        if bone.name.startswith('finger') and bone.name.endswith('.'+side):
            bone.matrix_basis = Matrix.Identity(4)
    update()
    # Source palm plane: distal metacarpal direction and index/pinky width.
    wrist = pose['wrist.'+side]
    knuckles = [pose[f'finger{d}-1.{side}'].head.copy() for d in range(2,6)]
    distal = (sum(knuckles,Vector())/4-wrist.head).normalized()
    width = (knuckles[0]-knuckles[-1]).normalized()
    palm_normal = distal.cross(width).normalized()
    desired = Vector((-sign,0,0))
    if palm_normal.dot(desired)<0:
        palm_normal = -palm_normal
    # Rotate the wrist around its actual longitudinal axis until the palm
    # faces the inner side. Equipment will be repositioned only afterwards.
    angle = math.atan2(distal.dot(palm_normal.cross(desired)), palm_normal.dot(desired))
    rotate_global(wrist.name, distal, angle)
    knuckles = [pose[f'finger{d}-1.{side}'].head.copy() for d in range(2,6)]
    distal = (sum(knuckles,Vector())/4-wrist.head).normalized()
    flex_axis = distal.cross(desired).normalized()
    for digit in range(2,6):
        for segment, degrees in [(1,38), (2,68), (3,42)]:
            rotate_global(f'finger{digit}-{segment}.{side}', flex_axis, math.radians(degrees))
    points = [pose['finger3-1.'+side].head.copy(), pose['finger3-1.'+side].tail.copy(),
              pose['finger3-2.'+side].tail.copy(), pose['finger3-3.'+side].tail.copy()]
    bar = sum(points,Vector())/4
    # Thumb opposes the curled fingers. Targets are in the same actual palm
    # plane and follow the whole wrist, rather than applying mirrored Euler X.
    for segment, target in [(1,bar+Vector((0,-.035,.045))),
                            (2,bar+Vector((0,-.035,.013))),
                            (3,bar+Vector((sign*.009,-.026,.004)))]:
        aim(f'finger1-{segment}.{side}', target-pose[f'finger1-{segment}.{side}'].head)
    grips[side] = {'bar':list(bar), 'palmNormalTarget':list(desired), 'curlAxis':list(flex_axis)}

update()
# Translate each complete equipment assembly to the actual curled fingers.
# Keep orientation upright; preserve original wrist parent, scale and left/right.
right_bar = rig.matrix_world @ Vector(grips['R']['bar'])
handle = bpy.data.objects['Toolbox_handle_in_right_palm']
delta = right_bar-handle.matrix_world.translation
for ob in scene.objects:
    if ob.name.startswith(('RIGHT_', 'Toolbox')):
        matrix = ob.matrix_world.copy(); matrix.translation += delta; ob.matrix_world = matrix

left_bar = rig.matrix_world @ Vector(grips['L']['bar'])
recorder = bpy.data.objects['LEFT_green_recorder']
old_center = recorder.matrix_world.translation.copy()
new_center = left_bar+Vector((0,0,-.112))
delta = new_center-old_center
for ob in scene.objects:
    if ob.name.startswith(('LEFT_', 'Recorder')):
        matrix = ob.matrix_world.copy(); matrix.translation += delta; ob.matrix_world = matrix


def cube(name, center, dims, material, bone):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    ob=bpy.context.object; ob.name=name; ob.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material)
    bevel=ob.modifiers.new('Small edge radii','BEVEL');bevel.width=.003;bevel.segments=2
    ob.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    world=ob.matrix_world.copy();ob.parent=rig;ob.parent_type='BONE';ob.parent_bone=bone;ob.matrix_world=world
    return ob


# The recorder now has a real top loop: four curled fingers can carry it.
for offset in [-.039,.039]:
    cube('Recorder_top_handle_support',left_bar+Vector((0,offset,-.018)),(.016,.012,.038),glove,'wrist.L')
cube('Recorder_grip_bar',left_bar,(.020,.090,.019),glove,'wrist.L')
display=recolor('Study_NPR_dark',['101e1c','152923','203b2d','36503a','526e47'],copy='Recorder_LCD_Glass')
opaque_material(display)
screen=bpy.data.objects['Recorder_physical_screen'];screen.data.materials.clear();screen.data.materials.append(display)
for poly in screen.data.polygons:poly.material_index=0
pixel_material=bpy.data.materials.new('Recorder_LCD_Readout');pixel_material.use_nodes=True
pixel_material.node_tree.nodes.clear()
output=pixel_material.node_tree.nodes.new('ShaderNodeOutputMaterial')
emission=pixel_material.node_tree.nodes.new('ShaderNodeEmission');emission.inputs['Color'].default_value=rgba('b7bf85')
pixel_material.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
for dz,width in [(.009,.041),(-.006,.027)]:
    center=screen.matrix_world.translation+Vector((.006,0,dz))
    cube('Recorder_display_line',center,(.002,width,.004),pixel_material,'wrist.L')

# Face and hand closeups use actual geometry/materials, not sprite enlargement.
original_camera = scene.camera
original_resolution = (scene.render.resolution_x,scene.render.resolution_y)
camera = original_camera.copy(); camera.data = original_camera.data.copy()
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.resolution_x=384;scene.render.resolution_y=384
scene.frame_set(1)
update()
diagnostics = [('face',rig.matrix_world@pose['head'].head+Vector((0,-.02,.055)),Vector((2,-5,1)),.32),
               ('right-grip',right_bar,Vector((-3,-4,2)),.32),
               ('left-grip',left_bar,Vector((3,-4,2)),.32)]
for label,target,view,scale in diagnostics:
    camera.data.ortho_scale=scale;camera.location=target+view.normalized()*3
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/('detail-'+label+'.png'))
    bpy.ops.render.render(write_still=True)
scene.camera=original_camera
bpy.data.objects.remove(camera,do_unlink=True)
scene.render.resolution_x,scene.render.resolution_y=original_resolution
records=[]
for frame,angle,label in [(1,0,'front-quarter'),(2,-35,'turned')]:
    rig.rotation_euler.z=math.radians(angle);rig.keyframe_insert('rotation_euler',frame=frame)
    scene.frame_set(frame);update()
    ground=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
    records.append({'frame':frame,'pose':label,'rootAngleDegrees':angle,'anchor':[ground.x*160,(1-ground.y)*224],
                    'sameCamera':True,'sourceJointPoseUnchanged':False})
for curve in rig.animation_data.action.fcurves:
    for point in curve.keyframe_points:point.interpolation='CONSTANT'
scene.frame_set(1);scene.render.filepath='//front-quarter.png'
scene['study_status']='Full character appearance and grip refinement; under visual review, not walking.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'),compress=True)
for record in records:
    scene.frame_set(record['frame']);scene.render.filepath=str(out/(record['pose']+'.png'))
    bpy.ops.render.render(write_still=True)
study=json.loads((base/'study.json').read_text(encoding='utf-8'))
study.update({'frames':records,'parentStudy':str(base.relative_to(ROOT)),
              'parentBlendSha256':hashlib.sha256((base/'representation-study.blend').read_bytes()).hexdigest(),
              'appearanceChanges':['Opaque eyebrows independent from hair alpha.','Rest-space iris/pupil and short jaw beard.',
                                   'Ochre jacket palette; bounded torso-shell smoothing with boundaries preserved.',
                                   f'Applied authored clothing body-occlusion mask: {hidden_face_count} covered faces hidden.',
                                   'Palm-plane finger curl and opposing thumbs.','Equipment positioned at curled fingers; physical recorder top handle.'],
              'grips':grips,'artApproved':False,'walkingApproved':False,'homepageIntegrated':False})
(out/'study.json').write_text(json.dumps(study,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Saved complete character revision, grip closeups and two orientations.',flush=True)
