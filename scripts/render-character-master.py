"""Offline Blender 4.5 trial. A single editable CC0 body/rig, no raster limb patching.

Run with E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe.
This is a style experiment, not an approved production character.
"""
import json
import math
import hashlib
import argparse
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

parser=argparse.ArgumentParser()
parser.add_argument('--revision',choices=['v01','v02'],default='v01')
args=parser.parse_args()
REV=args.revision
REFINED=REV=='v02'

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.lab/character-master/source'
PACK = ROOT / '.lab/character-master/system-assets'
OUT = ROOT / 'prototypes/visual-direction/character-master-media'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0

def obj_data(path):
    vertices, faces, groups = [], [], []
    group = ''
    for line in path.read_text().splitlines():
        parts = line.split()
        if not parts: continue
        if parts[0] == 'v': vertices.append(Vector(map(float, parts[1:4])))
        elif parts[0] == 'g': group = parts[1]
        elif parts[0] == 'f':
            faces.append(tuple(int(p.split('/')[0])-1 for p in parts[1:])); groups.append(group)
    return vertices, faces, groups

base, faces, groups = obj_data(SOURCE / 'base.obj')
for filename in ['male-young.target', 'male-build.target']:
    for line in (SOURCE / filename).read_text().splitlines():
        if line and not line.startswith('#'):
            p = line.split(); base[int(p[0])] += Vector(map(float, p[1:4]))

# MakeHuman: +Y up, +Z front. Blender: +Z up, -Y front.
bottom = min(v.y for v in base)
def convert(v): return Vector((v.x*.106, -v.z*.106, (v.y-bottom)*.106))
vertices = [convert(v) for v in base]
spec = json.loads((SOURCE / 'default.mhskel').read_text())
weights = json.loads((SOURCE / 'default_weights.mhw').read_text())['weights']
vertex_weights = [{} for _ in base]
for bone, entries in weights.items():
    for i, weight in entries: vertex_weights[i][bone] = weight

def joint(name):
    indices = spec['joints'][name]
    return sum((vertices[i] for i in indices), Vector()) / len(indices)

armature = bpy.data.armatures.new('MakeHuman_CC0_full_rig')
rig = bpy.data.objects.new('Fieldworker_master_rig', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, definition in spec['bones'].items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = joint(definition['head']), joint(definition['tail'])
    if (bone.tail-bone.head).length < .0001: bone.tail.z += .002
for name, definition in spec['bones'].items():
    if definition['parent']: armature.edit_bones[name].parent = armature.edit_bones[definition['parent']]
bpy.ops.object.mode_set(mode='OBJECT')

def material(name, colors):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nodes = mat.node_tree.nodes; nodes.clear(); links = mat.node_tree.links
    out = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission'); links.new(emission.outputs[0], out.inputs['Surface'])
    normal = nodes.new('ShaderNodeNewGeometry')
    dot = nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = Vector((-.5,-.7,1)).normalized()
    links.new(normal.outputs['Normal'], dot.inputs[0])
    remap = nodes.new('ShaderNodeMapRange'); remap.inputs['From Min'].default_value = -1
    links.new(dot.outputs['Value'], remap.inputs['Value'])
    ramp = nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    def rgba(hex):
        c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
        return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)+(1,)
    for i, color in enumerate(colors):
        el = ramp.color_ramp.elements[i] if i < 2 else ramp.color_ramp.elements.new(i/(len(colors)-1))
        el.position = .17+i*.7/(len(colors)-1); el.color = rgba(color)
    links.new(remap.outputs['Result'],ramp.inputs[0])
    ao = nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value = .065
    mix = nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.28 if REFINED else .5
    links.new(ramp.outputs['Color'],mix.inputs[1]);links.new(ao.outputs['Color'],mix.inputs[2])
    links.new(mix.outputs[0],emission.inputs['Color'])
    return mat

mats = {
    'skin':material('Skin_warm_light_cool_turns',['655344','9c7452','c79d6e','e6c491','f3d6a5']),
    'coat':material('Ochre_field_coat',['4b4132','7e4b2b','b46c32','d69243','f1ba61']),
    'pants':material('Olive_work_trousers',['202b28','303a2d','465139','616b43','818759']),
    'boots':material('Dark_ankle_boots',['192521','27312b','394035','4f5543','65684e']),
    'hair':material('Short_black_hair',['182422','202b26','2e382a','46513a','66704c']),
    'metal':material('Brushed_silver_toolbox',['394d49','647671','92a29a','bcc8b8','e1e6d1']),
    'recorder':material('Green_field_recorder',['1e3932','315144','52705a','829477','b8c39e']),
    'dark':material('Small_dark_details',['1b2926','243530','30423c','40554a','53685a']),
    'eye':material('Eyes_warm_white',['8c967e','b5bca0','d8d9ba','e7e3c7','f2ecd6']),
    'stubble':material('Short_stubble',['414032','65533c','8b7151','ab916a','c8af83']),
}
if REFINED:
    palettes={
      'skin':['664d3a','9a704c','c79a6b','e9bd8a','f5d49e'],
      'coat':['583d2d','89502b','c7792e','eda342','ffd170'],
      'pants':['172d2b','293f32','435838','697b48','9ba363'],
      'boots':['13231f','22332a','334332','45553e','59664b'],
      'hair':['101b1e','162725','20312a','334133','506044'],
      'stubble':['4f4938','6a6047','927e59','b7a278','d4bf91'],
    }
    for key,colors in palettes.items():
        mats[key]=material('Refined_'+key,colors)
    # Soft face planes retain the nose/cheek volume. Fabric keeps discrete
    # steps. The sprite palette pass is separate from the authoring shader.
    for key in ['skin','stubble']:
        for node in mats[key].node_tree.nodes:
            if node.type=='VALTORGB':node.color_ramp.interpolation='LINEAR'
    mats['brow']=material('Untextured_dark_eyebrow',palettes['hair'])

def mesh(name, coords, polygons, skinweights, material_for_face):
    data = bpy.data.meshes.new(name); data.from_pydata(coords,[],polygons);data.update()
    ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob)
    for m in mats.values():data.materials.append(m)
    material_names=list(mats)
    for p in data.polygons:p.material_index=material_names.index(material_for_face(p));p.use_smooth=True
    if skinweights:
        bone_names=set(n for w in skinweights for n in w)
        for n in bone_names:
            group=ob.vertex_groups.new(name=n)
            for i,w in enumerate(skinweights):
                if w.get(n,0)>0:group.add([i],w[n],'REPLACE')
        mod=ob.modifiers.new('Shared_skeleton','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
        ob.parent=rig
    return ob

body_faces=[f for f,g in zip(faces,groups) if g=='body']
if REFINED:
    # Official shoes provide an explicit body occlusion mask. Without it the
    # foot skin protrudes through the shoe upper even in the rest pose.
    lines=(PACK/'clothes/shoes03/shoes03.mhclo').read_text().splitlines()
    start=next(i for i,line in enumerate(lines) if line.strip()=='delete_verts')
    tokens=' '.join(line for line in lines[start+1:] if not line.startswith('#')).split()
    hidden=set();i=0
    while i<len(tokens):
        a=int(tokens[i])
        if i+1<len(tokens) and tokens[i+1]=='-':hidden.update(range(a,int(tokens[i+2])+1));i+=3
        else:hidden.add(a);i+=1
    body_faces=[f for f in body_faces if not any(i in hidden for i in f)]
def skin_material(p):
    center=sum((vertices[i] for i in p.vertices),Vector())/len(p.vertices)
    # Fine stubble is on the continuous jaw surface, not a separate beard object.
    beard_low,beard_high=(1.525+.17*abs(center.x),1.546+.35*abs(center.x)) if REFINED else (1.565,1.615)
    return 'stubble' if beard_low<center.z<beard_high and center.y<-.070 and abs(center.x)<.075 else 'skin'
body=mesh('Continuous_human_body',vertices,body_faces,vertex_weights,skin_material)

def fitted_asset(folder, stem, label, classifier):
    path=PACK/folder/stem
    cv,cf,cg=obj_data(path/(stem+'.obj'))
    lines=(path/(stem+'.mhclo')).read_text().splitlines(); fitting=[];active=False;scale=Vector((1,1,1))
    for line in lines:
        p=line.split()
        if not p or p[0].startswith('#'):continue
        if p[0] in ('x_scale','y_scale','z_scale'):
            axis={'x_scale':0,'y_scale':1,'z_scale':2}[p[0]]
            scale[axis]=abs(base[int(p[1])][axis]-base[int(p[2])][axis])/float(p[3])
        elif p[0]=='verts':active=True
        elif active:
            if p[0][0].isalpha():
                if fitting:break
                continue
            if len(p)==1:fitting.append(([int(p[0])],[1.0],Vector()))
            else:fitting.append((list(map(int,p[:3])),list(map(float,p[3:6])),Vector(map(float,p[6:9]))))
    assert len(fitting)==len(cv),(stem,len(fitting),len(cv))
    output=[];cw=[]
    for ids, factors, offset in fitting:
        point=sum((base[i]*w for i,w in zip(ids,factors)),Vector())
        point+=Vector((offset.x*scale.x,offset.y*scale.y,offset.z*scale.z));output.append(convert(point))
        wts={}
        for idx,factor in zip(ids,factors):
            for n,w in vertex_weights[idx].items():wts[n]=wts.get(n,0)+w*max(0,factor)
        total=sum(wts.values());cw.append({n:w/total for n,w in wts.items()} if total else {'head':1})
    if REFINED:
        weight_header=next((line.split()[1] for line in lines if line.startswith('vertexboneweights_file ')),None)
        if weight_header:
            authored=json.loads((path/weight_header).read_text())['weights']
            cw=[{} for _ in output]
            for name,entries in authored.items():
                if not entries:continue
                assert name in spec['bones'],('Unmapped source bone',name)
                for index,value in entries:cw[index][name]=value
            for wts in cw:
                total=sum(wts.values())
                assert total>0,('Missing source skin weight',stem)
                for name in wts:wts[name]/=total
    # Classify complete connected garments; a horizontal threshold would paint
    # the bottom of a hip-length jacket green along with the trousers.
    parent=list(range(len(output)))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for f in cf:
        for i in f[1:]:parent[find(i)]=find(f[0])
    heights={}
    for i,v in enumerate(output):heights[find(i)]=max(heights.get(find(i),0),v.z)
    if REFINED and stem=='male_casualsuit05':
        # Component 0 is the folded blazer lapel, 1 the shell, 2 the shirt,
        # 3 the trousers (inspected in the private garment component renders).
        ordered=list(dict.fromkeys(find(i) for i in range(len(output))))
        removed=ordered[0];shell=ordered[1];shirt=ordered[2]
        cf=[f for f in cf if find(f[0])!=removed]
        from collections import Counter
        edges=Counter(tuple(sorted((f[i],f[(i+1)%len(f)]))) for f in cf if find(f[0])==shell for i in range(len(f)))
        boundary={i for e,count in edges.items() if count==1 for i in e}
        for i,v in enumerate(output):
            if find(i)!=shell:continue
            if abs(v.x)<.22 and v.z<1.08:
                t=max(0,min(1,(1.08-v.z)/.21));v.z+=.080*t*t*(3-2*t)
            # Close the existing front opening below the neck. Alter the
            # continuous garment edge; do not paste a rectangular front image.
            if i in boundary and abs(v.x)<.061 and v.y<-.085 and .94<v.z<1.44:
                v.x=math.copysign(.006,v.x)
        heights={}
        for i,v in enumerate(output):heights[find(i)]=max(heights.get(find(i),0),v.z)
    def choose(p):
        if stem=='male_casualsuit05':return 'coat' if heights[find(p.vertices[0])]>1.3 else 'pants'
        return classifier(p,output)
    ob=mesh(label,output,cf,cw,choose)
    if REFINED and stem=='male_casualsuit05':
        for p in ob.data.polygons:
            if find(p.vertices[0])==shirt:p.material_index=list(mats).index('dark')
    if REFINED and stem=='short04':
        # Preserve the source hair-card alpha, with the same UV loop order.
        # Only alpha is read; color still comes from the shared hair palette.
        texture=path/'short04_diffuse.png'
        image=bpy.data.images.load(str(texture));image.pack()
        uvs=[];face_uvs=[]
        for line in (path/(stem+'.obj')).read_text().splitlines():
            p=line.split()
            if p and p[0]=='vt':uvs.append(tuple(map(float,p[1:3])))
            elif p and p[0]=='f':face_uvs.append([int(x.split('/')[1])-1 for x in p[1:]])
        layer=ob.data.uv_layers.new(name='Source_hair_UV')
        for poly,indices in zip(ob.data.polygons,face_uvs):
            for loop,uv in zip(poly.loop_indices,indices):layer.data[loop].uv=uvs[uv]
        mat=mats['hair'];nodes=mat.node_tree.nodes;links=mat.node_tree.links
        out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        colored=out.inputs['Surface'].links[0].from_socket
        sample=nodes.new('ShaderNodeTexImage');sample.image=image;sample.interpolation='Linear'
        transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
        links.new(sample.outputs['Alpha'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(colored,mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    if REFINED and stem=='low-poly':
        front={sign:min(v.y for v in output if v.x*sign>0) for sign in [-1,1]}
        for p in ob.data.polygons:
            c=sum((output[i] for i in p.vertices),Vector())/len(p.vertices)
            p.material_index=list(mats).index('dark' if c.y<front[1 if c.x>0 else -1]+.0032 else 'eye')
    return ob

suit=fitted_asset('clothes','male_casualsuit05','Editable_coat_and_trousers',
                   lambda p,vs:'coat' if sum(vs[i].z for i in p.vertices)/len(p.vertices)>1.0 else 'pants')
hair=fitted_asset('hair','short04' if REFINED else 'short01','Short_hair',lambda p,vs:'hair')
shoes=fitted_asset('clothes','shoes03' if REFINED else 'shoes01','Ankle_boots',lambda p,vs:'boots')
if REFINED:
    eyes=fitted_asset('eyes','low-poly','Fitted_eyes',lambda p,vs:'eye')

    def weighted_cloth(name,coords,polygons,material_key):
        from mathutils.kdtree import KDTree
        tree=KDTree(len(suit.data.vertices))
        for v in suit.data.vertices:tree.insert(v.co,v.index)
        tree.balance();cw=[]
        for point in coords:
            _,index,_=tree.find(point)
            cw.append({suit.vertex_groups[g.group].name:g.weight for g in suit.data.vertices[index].groups})
        return mesh(name,coords,polygons,cw,lambda p:material_key)

    # A closed center placket follows the chest contour and meets a small
    # upright collar. Both are actual skinned garment surfaces.
    contour=[(.96,-.156),(1.06,-.162),(1.16,-.164),(1.24,-.167),(1.32,-.153),(1.39,-.129),(1.44,-.105),(1.48,-.084)]
    panel=[];polys=[]
    for z,y in contour:
        panel.extend([Vector((-.010,y,z)),Vector((.010,y,z))])
    for i in range(len(contour)-1):polys.append((i*2,i*2+1,i*2+3,i*2+2))
    weighted_cloth('Closed_raincoat_placket',panel,polys,'coat')
    zipper=[Vector((math.copysign(.0012,v.x),v.y-.0008,v.z)) for v in panel]
    weighted_cloth('Center_zipper_seam',zipper,polys,'dark')
    collar=[];collar_polys=[];segments=24
    for height in [1.475,1.513]:
        for i in range(segments):
            t=2*math.pi*i/segments
            collar.append(Vector((.071*math.cos(t),-.024+.070*math.sin(t),height)))
    for i in range(segments):collar_polys.append((i,(i+1)%segments,(i+1)%segments+segments,i+segments))
    weighted_cloth('Low_standing_raincoat_collar',collar,collar_polys,'coat')

def sphere(name,location,radius,mat,scale=(1,1,1),bone='head'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=radius,location=location)
    ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(mats[mat])
    for p in ob.data.polygons:p.use_smooth=True
    world=ob.matrix_world.copy();ob.parent=rig;ob.parent_type='BONE';ob.parent_bone=bone;ob.matrix_world=world
    return ob

for side in ([] if REFINED else ['L','R']):
    center=joint(spec['bones']['eye.'+side]['head'])
    # The stock helper eye joint is inside the neutral socket and does not
    # follow this ethnic facial morph's visible lid surface. Author the eye
    # shell at the morphed socket, keep it bound to the same head bone.
    center+=Vector((.015 if side=='L' else -.015,-.012,.032))
    sphere('Eye_white.'+side,center,.0105,'eye')
    sphere('Forward_iris.'+side,center+Vector((0,-.0108,.0003)),.0057,'dark',(1,.30,1))
    brow=center+Vector((0,-.008,.015))
    sphere('Short_eyebrow.'+side,brow,.009,'hair',(1.6,.35,.25))

if REFINED:
    # Eyebrows hug the actual morphed face instead of floating over the eye.
    from mathutils.bvhtree import BVHTree
    surface=BVHTree.FromPolygons(vertices,body_faces)
    for sign,side in [(1,'L'),(-1,'R')]:
        eye=joint(spec['bones']['eye.'+side]['head'])
        coords=[]
        for i in range(5):
            x=eye.x+sign*(-.014+i*.008);z=eye.z+.026+.003*math.sin(i*math.pi/4)
            for dz in [-.003,.003]:
                point,normal,_,_=surface.ray_cast(Vector((x,-1,z+dz)),Vector((0,1,0)))
                coords.append(point+normal*.0007)
        polys=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(4)]
        mesh('Surface_eyebrow.'+side,coords,polys,[{'head':1} for _ in coords],lambda p:'brow')

# The pose uses full skeletal transforms. No rescaling or pasted head/leg regions.
def aim(name,direction):
    bpy.context.view_layer.update()
    pb=rig.pose.bones[name]; matrix=pb.matrix.copy()
    current=matrix.to_3x3()@Vector((0,1,0))
    rotation=current.rotation_difference(Vector(direction).normalized())
    pb.matrix=Matrix.Translation(matrix.translation)@rotation.to_matrix().to_4x4()@matrix.to_3x3().to_4x4()
    bpy.context.view_layer.update()

for side,sign in [('R',-1),('L',1)]:
    aim('upperarm01.'+side,(sign*.12,-.04,-1))
    aim('lowerarm01.'+side,(sign*.035,-.10,-1))
    aim('wrist.'+side,(0,-.08,-1))
    for digit in range(1,6):
        for segment in range(1,4):
            name=f'finger{digit}-{segment}.{side}'
            if name in rig.pose.bones:
                pb=rig.pose.bones[name];pb.rotation_mode='XYZ';pb.rotation_euler.x=math.radians(45 if digit>1 else 20)
bpy.context.view_layer.update()

def cube(name,location,dimensions,mat,bone=None,bevel=.005):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    ob=bpy.context.object;ob.name=name;ob.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(mats[mat])
    if bevel:
        b=ob.modifiers.new('Small_edge_bevel','BEVEL');b.width=bevel;b.segments=1
        ob.modifiers.new('Corner_normals','WEIGHTED_NORMAL')
    if bone:
        world=ob.matrix_world.copy();ob.parent=rig;ob.parent_type='BONE';ob.parent_bone=bone;ob.matrix_world=world
    return ob

def hand_position(side):
    pb=rig.pose.bones['wrist.'+side]
    return pb.tail.copy()+Vector((0,0,-.035))

right=hand_position('R');left=hand_position('L')
# Grip crosses the handle; case follows the right hand as a rigid bone attachment.
case_center=right+Vector((0,-.005,-.165))
cube('RIGHT_silver_toolbox',case_center,(.12,.30,.22),'metal','wrist.R',.012)
for y in [-.062,.052]:
    cube('Toolbox_handle_support',right+Vector((0,y,-.032)),(.021,.018,.07),'dark','wrist.R',.004)
cube('Toolbox_handle_in_right_palm',right+Vector((0,-.005,.002)),(.025,.13,.022),'dark','wrist.R')
for y in [-.10,.09]:
    cube('Toolbox_metal_latch',case_center+Vector((-.064,y,.04)),(.012,.025,.05),'metal','wrist.R',.002)
device=left+Vector((.02,-.035,-.04))
cube('LEFT_green_recorder',device,(.065,.11,.17),'recorder','wrist.L',.006)
cube('Recorder_physical_screen',device+Vector((.035,-.005,.025)),(.009,.07,.045),'metal','wrist.L',.001)
for z in [-.04,-.065]:cube('Recorder_button',device+Vector((.035,-.012,z)),(.012,.015,.012),'dark','wrist.L',.002)

if REFINED:
    # The boot sole extends below the bare foot. Lift the complete rig onto
    # z=0 once; don't rescale or offset the shoes independently of the body.
    bpy.context.view_layer.update()
    evaluated=shoes.evaluated_get(bpy.context.evaluated_depsgraph_get())
    floor=min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)
    rig.location.z-=floor
    bpy.context.view_layer.update()

scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.cycles.seed=0
scene.render.resolution_x=128;scene.render.resolution_y=196;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.view_settings.view_transform='Standard'
scene.render.filter_size=.01
world=bpy.data.worlds.new('Neutral_world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.43,.38,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
camera_data=bpy.data.cameras.new('Fixed_orthographic_camera');camera=bpy.data.objects.new('Fixed_orthographic_camera',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(4,-1.7,2.25);target=Vector((0,0,.93));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=1.99;scene.camera=camera
rig['status']='Structural and style trial; art not approved'
rig['equipment']='anatomical RIGHT: silver toolbox; anatomical LEFT: green recorder'
rig['source_commit']=json.loads((SOURCE/'manifest.json').read_text())['commit']
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'character-master-{REV}.blend'),compress=True)
scene.render.filepath=str(OUT/f'left-master-{REV}.png');bpy.ops.render.render(write_still=True)
# A separate, explicitly labelled palette experiment. No dithering, sharpening,
# per-body-part resizing or frame-dependent painting.
from PIL import Image
import numpy as np
raw=Image.open(OUT/f'left-master-{REV}.png').convert('RGBA')
palette_hex=['182422','202b26','2e382a','46513a','66704c',
 '655344','9c7452','c79d6e','e6c491','f3d6a5','414032','65533c','8b7151','ab916a','c8af83',
 '4b4132','7e4b2b','b46c32','d69243','f1ba61',
 '202b28','303a2d','465139','616b43','818759',
 '192521','27312b','394035','4f5543','65684e',
 '394d49','647671','92a29a','bcc8b8','e1e6d1',
 '1e3932','315144','52705a','829477','b8c39e',
 '1b2926','243530','30423c','40554a','53685a',
 '8c967e','b5bca0','d8d9ba','e7e3c7','f2ecd6']
if REFINED:
    # Keep the authored warm face and orange coat grades; no global dithering.
    palette_hex=[h for colors in palettes.values() for h in colors]+['394d49','647671','92a29a','bcc8b8','e1e6d1','1e3932','315144','52705a','829477','b8c39e','1b2926','243530','30423c','40554a','53685a','8c967e','b5bca0','d8d9ba','e7e3c7','f2ecd6']
palette=np.array([[int(h[i:i+2],16) for i in (0,2,4)] for h in palette_hex],dtype=np.float32)
pixels=np.array(raw)
dist=((pixels[:,:,:3].astype(np.float32)[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=-1)
pixels[:,:,:3]=palette[dist.argmin(axis=-1)].astype(np.uint8)
pixels[:,:,3]=np.where(pixels[:,:,3]>=128,255,0)
Image.fromarray(pixels).save(OUT/f'left-palette-{REV}.png')
if REFINED:
    raw.resize((384,588),Image.Resampling.NEAREST).save(OUT/f'left-master-{REV}-3x.png')
    Image.fromarray(pixels).resize((384,588),Image.Resampling.NEAREST).save(OUT/f'left-palette-{REV}-3x.png')
    saved_location=camera.location.copy();saved_rotation=camera.rotation_euler.copy()
    camera.location=(2.7,-3.5,2.25)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'front-quarter-master-{REV}.png');bpy.ops.render.render(write_still=True)
    camera.location=saved_location;camera.rotation_euler=saved_rotation
reference=Image.open(ROOT/'prototypes/visual-direction/art-pack-media/actor-front.png').convert('RGBA')
# Reference file is an exact 2x presentation of the 78x174 native sprite.
reference=reference.resize((78,174),Image.Resampling.NEAREST)
reference_canvas=Image.new('RGBA',(128,196));reference_canvas.alpha_composite(reference,((128-reference.width)//2,18))
reference_canvas.save(OUT/'identity-reference-v01.png')
source_manifest=json.loads((SOURCE/'manifest.json').read_text())
source_manifest['assetPackUrl']='https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip'
asset_names=['short04','shoes03','low-poly','male_casualsuit05'] if REFINED else ['short01','shoes01','male_casualsuit05']
source_manifest['packFiles']=[{'file':str(p.relative_to(PACK)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in PACK.rglob('*') if p.is_file() and p.parent.name in asset_names]
(OUT/f'source-manifest-{REV}.json').write_text(json.dumps(source_manifest,indent=2),encoding='utf8')
(OUT/'LICENSE-MakeHuman-CC0.txt').write_text((SOURCE/'LICENSE.ASSETS.md').read_text(),encoding='utf8')
(OUT/f'master-{REV}.json').write_text(json.dumps({
    'status':'unreviewed offline style proof', 'artApproved':False,
    'blender':bpy.app.version_string,'resolution':[128,196],
    'sourceCommit':rig['source_commit'],'baseLicense':'CC0',
    'camera':{'location':list(camera.location),'target':list(target),'orthoScale':camera_data.ortho_scale},
    'method':'CC0 MakeHuman mesh and rig; source-fitted clothing, eyes, hair and closed boots; skeletal garment tailoring and rigid props; fixed normal-ramp/AO materials; offline Cycles CPU render' if REFINED else 'CC0 MakeHuman mesh, source rig and weights; fitted source clothing; authored rigid props; fixed material normal ramps plus AO; offline Cycles CPU render',
    'runtimeIntegration':False,'bodyPatchTransforms':False,
    'paletteExperiment':{'colors':len(palette_hex),'dither':False,'wholeImage':True,'file':f'left-palette-{REV}.png'},
    'refinements':{'removedBlazerLapel':True,'closedFrontAndStandingCollar':True,'sourceBootOcclusionApplied':True,'sourceBootWeightsApplied':True,'sourceEyeSocketFit':True,'hairAlphaPacked':True,'groundedWholeRigZ':rig.location.z,'secondViewCamera':[2.7,-3.5,2.25]} if REFINED else None,
    'limitations':['Character identity, grip and painterly cloth blocks remain under art review.','Body deformation and loaded gait are not approved.','The second view changes the camera only; it is not another animated facing direction.'] if REFINED else ['Source clothing is an approximate jacket, not final tailored raincoat.','Face, hair silhouette, finger grip and painterly pixel clusters require visual review.','No walk sequence or animation has been approved.']
},indent=2),encoding='utf8')
print('Saved complete editable master and left-facing render',flush=True)
