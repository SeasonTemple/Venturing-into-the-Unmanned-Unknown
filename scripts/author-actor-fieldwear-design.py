"""Redesign the shared fieldwear silhouette against the selected pixel identity.

Shoulder structure, open standing collar, backpack/webbing, fitted waist and
work-boot shafts are actual editable, rigged surfaces. Existing grips survive.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir',required=True,type=Path)
args=parser.parse_args();out=args.out_dir.resolve()
if out.exists():raise ValueError('Choose a new output directory')
out.mkdir(parents=True)
base=ROOT/'prototypes/visual-direction/actor-representation-study-v03'
shutil.copytree(base/'source',out/'source')
for label in ['front-quarter','turned']:shutil.copy2(base/(label+'.png'),out/('before-'+label+'.png'))
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.open_mainfile(filepath=str(base/'representation-study.blend'))
scene=bpy.context.scene;scene.frame_set(1)
rig=bpy.data.objects['Fieldworker_master_rig'];rig.animation_data_clear();rig.rotation_euler.z=0
pose=rig.pose.bones


def update():bpy.context.view_layer.update()


def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)


def rgba(color):
    values=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)


def palette(mat,colors):
    for el,color in zip(mat.node_tree.nodes['Color Ramp'].color_ramp.elements,colors):el.color=rgba(color)
    return mat


def variant(name,base_name,colors):
    mat=bpy.data.materials[base_name].copy();mat.name=name;palette(mat,colors)
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    output=nodes['Material Output']
    for link in list(output.inputs['Surface'].links):links.remove(link)
    links.new(nodes['Emission'].outputs[0],output.inputs['Surface'])
    return mat


# Restore the actual shoulder girdle instead of increasing/decreasing a single
# joint height until a silhouette looks right. Preserve upper-arm orientation,
# so the established wrist/finger poses and complete equipment assemblies follow.
shoulders_before={s:list(pose['upperarm01.'+s].head) for s in ['L','R']}
for side in ['L','R']:
    rotation=pose['upperarm01.'+side].matrix.to_3x3().copy()
    pose['clavicle.'+side].matrix_basis=Matrix.Identity(4)
    pose['shoulder01.'+side].matrix_basis=Matrix.Identity(4)
    update()
    upper=pose['upperarm01.'+side]
    upper.matrix=Matrix.Translation(upper.head)@rotation.to_4x4()
    update()
shoulders_after={s:list(pose['upperarm01.'+s].head) for s in ['L','R']}
coat=bpy.data.objects['Editable_coat_and_trousers']
coat_mat=bpy.data.materials['Study_NPR_coat']
palette(coat_mat,['403a2e','765034','a7612e','cd843e','edb25c'])
palette(bpy.data.materials['Study_NPR_boots'],['151e21','242e2d','3e3e30','5f503b','827052'])
web=variant('Field_Brown_Webbing','Study_NPR_dark',['211f1b','372d23','554030','795c3d','a08153'])
packmat=variant('Field_Backpack_Cloth','Study_NPR_coat',['292b24','473c2c','685037','8e6b42','b79560'])
collar_inner=variant('Field_Collar_Inner','Study_NPR_coat',['373529','5c452e','885b32','b47b3d','dba25a'])

coat_verts={i for poly in coat.data.polygons if 'coat' in coat.material_slots[poly.material_index].material.name for i in poly.vertices}
pants_verts={i for poly in coat.data.polygons if 'pants' in coat.material_slots[poly.material_index].material.name for i in poly.vertices}
for i in coat_verts:
    v=coat.data.vertices[i]
    waist=smooth(.97,1.08,v.co.z)*(1-smooth(1.21,1.35,v.co.z))*(1-smooth(.19,.25,abs(v.co.x)))
    v.co.x*=1-.055*waist
    # A supported, gently sloping yoke; do not pull the complete sleeves up.
    cap=smooth(.075,.13,abs(v.co.x))*(1-smooth(.23,.29,abs(v.co.x)))*smooth(1.40,1.47,v.co.z)
    v.co.z+=.008*cap
    v.co.x+=math.copysign(.005*cap,v.co.x)
for i in pants_verts:
    v=coat.data.vertices[i]
    v.co.z+=.072*(1-smooth(.10,.27,v.co.z))
coat.data.update()
active={i for poly in coat.data.polygons for i in poly.vertices}
tree=KDTree(len(active))
for i in active:tree.insert(coat.data.vertices[i].co,i)
tree.balance()


def cloth_weights(point):
    weights={}
    for _,index,distance in tree.find_n(point,3):
        scale=1/max(distance,.002)
        for g in coat.data.vertices[index].groups:
            name=coat.vertex_groups[g.group].name
            weights[name]=weights.get(name,0)+g.weight*scale
    total=sum(weights.values())
    return {k:v/total for k,v in weights.items() if v/total>.001}


def mesh(name,points,faces,materials,weights=None,slots=None):
    data=bpy.data.meshes.new(name);data.from_pydata(points,[],faces);data.update()
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    for mat in materials:data.materials.append(mat)
    for i,poly in enumerate(data.polygons):
        poly.material_index=slots[i] if slots else 0;poly.use_smooth=True
    weights=weights or [cloth_weights(Vector(p)) for p in points]
    for name in {name for wt in weights for name in wt}:
        group=ob.vertex_groups.new(name=name)
        for i,wt in enumerate(weights):
            if wt.get(name,0):group.add([i],wt[name],'REPLACE')
    modifier=ob.modifiers.new('Shared fieldworker skeleton','ARMATURE');modifier.object=rig;modifier.use_deform_preserve_volume=True
    ob.parent=rig
    return ob


# Replace the round low collar with an open-front, outward-folding field collar.
old=bpy.data.objects.get('Low_standing_raincoat_collar')
if old:bpy.data.objects.remove(old,do_unlink=True)
points=[];faces=[];slots=[];segments=28
for row in range(3):
    for i in range(segments+1):
        theta=math.radians(-50+280*i/segments)
        front=max(0,-math.sin(theta))
        radius_x=[.076,.091,.099][row];radius_y=[.070,.079,.086][row]
        z=[1.478,1.558,1.568][row]-.045*front*row/2
        points.append(Vector((radius_x*math.cos(theta),-.022+radius_y*math.sin(theta),z)))
for row in range(2):
    for i in range(segments):
        a=row*(segments+1)+i
        faces.append((a,a+1,a+segments+2,a+segments+1));slots.append(0 if row==0 else 1)
collar=mesh('Field_Jacket_Open_Standing_Collar',points,faces,[coat_mat,collar_inner],slots=slots)
solid=collar.modifiers.new('Folded fabric thickness','SOLIDIFY');solid.thickness=.003

# Rest-space front surface for the placket and the backpack's shoulder webbing.
surface=BVHTree.FromPolygons([v.co for v in coat.data.vertices],[list(p.vertices) for p in coat.data.polygons])


def front_y(x,z,fallback):
    hits=[]
    for xx in [x,x-.012,x+.012]:
        point,normal,_,_=surface.ray_cast(Vector((xx,-1,z)),Vector((0,1,0)))
        if point is not None and point.y<-.04 and normal.y<-.1:hits.append(point.y)
    return min(hits) if hits else fallback


for name,offset in [('Closed_raincoat_placket',.002),('Center_zipper_seam',.0035)]:
    ob=bpy.data.objects[name]
    for v in ob.data.vertices:
        if name=='Center_zipper_seam':v.co.x=math.copysign(.005,v.co.x)
        v.co.y=front_y(v.co.x,v.co.z,v.co.y)-offset
    ob.data.update()


def box(name,center,dimensions,material,bone,bevel):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    ob=bpy.context.object;ob.name=name;ob.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material)
    modifier=ob.modifiers.new('Rounded sewn edge','BEVEL');modifier.width=bevel;modifier.segments=2
    ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    world=ob.matrix_world.copy();ob.parent=rig;ob.parent_type='BONE';ob.parent_bone=bone;ob.matrix_world=world
    return ob


points=[];faces=[];segments=20
bag_rings=[(1.05,.072,.026),(1.075,.111,.048),(1.18,.131,.063),
           (1.31,.126,.058),(1.37,.103,.040),(1.397,.055,.016)]
for z,rx,ry in bag_rings:
    for i in range(segments):
        theta=2*math.pi*i/segments
        # Rounded canvas body, narrowing into its gathered base and rolled top.
        points.append(Vector((rx*math.cos(theta),.193+ry*math.sin(theta),z)))
for row in range(len(bag_rings)-1):
    for i in range(segments):
        faces.append((row*segments+i,row*segments+(i+1)%segments,(row+1)*segments+(i+1)%segments,(row+1)*segments+i))
faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(bag_rings)-1)*segments+i for i in range(segments))])
mesh('Field_Backpack_Canvas_Body',points,faces,[packmat],weights=[{'spine02':1} for _ in points])
points=[];faces=[]
for z,y,width in [(1.392,.194,.055),(1.374,.231,.100),(1.337,.255,.108),(1.302,.254,.091)]:
    points.extend([Vector((-width,y,z)),Vector((0,y+.006,z-.006)),Vector((width,y,z))])
for row in range(3):
    for i in range(2):
        a=row*3+i;faces.append((a,a+1,a+4,a+3))
flap=mesh('Field_Backpack_Folded_Flap',points,faces,[web],weights=[{'spine02':1} for _ in points])
modifier=flap.modifiers.new('Canvas flap thickness','SOLIDIFY');modifier.thickness=.004
for sign,side in [(-1,'R'),(1,'L')]:
    points=[]
    for z,x in [(1.03,.112),(1.13,.124),(1.26,.133),(1.38,.136),(1.455,.13)]:
        x*=sign;y=front_y(x,z,-.105)-.005
        points.extend([Vector((x-.012,y,z)),Vector((x+.012,y,z))])
    for z,y,x in [(1.485,-.035,.129),(1.491,.025,.126),(1.46,.10,.123),(1.395,.19,.116)]:
        x*=sign;points.extend([Vector((x-.012,y,z)),Vector((x+.012,y,z))])
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)//2-1)]
    ob=mesh('Field_Backpack_Shoulder_Strap.'+side,points,faces,[web])
    modifier=ob.modifiers.new('Webbing thickness','SOLIDIFY');modifier.thickness=.003

# Boot shafts use actual calf/ankle rest positions and the shared leg chain.
# Foot rocking can still act below the shaft; no separate shoe image is moved.
for sign,side in [(-1,'R'),(1,'L')]:
    ankle=rig.data.bones['foot.'+side].head_local.copy();points=[];weights=[];faces=[];segments=20
    for z in [.087,.115,.18,.197]:
        for i in range(segments):
            theta=2*math.pi*i/segments
            points.append(Vector((ankle.x+.046*math.cos(theta),ankle.y+.043*math.sin(theta),z)))
            calf=smooth(.10,.17,z)
            weights.append({'foot.'+side:1-calf,'lowerleg02.'+side:calf})
    for row in range(3):
        for i in range(segments):
            faces.append((row*segments+i,row*segments+(i+1)%segments,(row+1)*segments+(i+1)%segments,(row+1)*segments+i))
    mesh('Field_Workboot_Shaft.'+side,points,faces,[bpy.data.materials['Study_NPR_boots']],weights=weights)

# Restore a short, charcoal beard with an exposed upper cheek and mouth gap.
face=bpy.data.materials['Field_Face_Surface']
face.node_tree.nodes['Math.019'].inputs[0].default_value=1.563
face.node_tree.nodes['Math.018'].inputs[1].default_value=.48
face.node_tree.nodes['Math.027'].inputs[1].default_value=1.584
face.node_tree.nodes['Math.028'].inputs[1].default_value=1.568
for el,color in zip(face.node_tree.nodes['Color Ramp.001'].color_ramp.elements,['111b20','192226','28312f','3a423b','51584b']):el.color=rgba(color)
palette(bpy.data.materials['Study_NPR_hair'],['0d1419','151d23','20282d','2c3535','414a42'])
hair=bpy.data.objects['Short_hair']
for v in hair.data.vertices:
    v.co.x*=1.035;v.co.y=-.01+(v.co.y+.01)*1.025
    v.co.z+=.006*smooth(1.69,1.74,v.co.z)
hair.data.update()

update()
records=[]
for frame,angle,label in [(1,0,'front-quarter'),(2,-35,'turned')]:
    rig.rotation_euler.z=math.radians(angle);rig.keyframe_insert('rotation_euler',frame=frame)
    scene.frame_set(frame);update()
    anchor=world_to_camera_view(scene,scene.camera,Vector((0,0,0)))
    records.append({'frame':frame,'pose':label,'rootAngleDegrees':angle,'anchor':[anchor.x*160,(1-anchor.y)*224],
                    'sameCamera':True,'sourceJointPoseUnchanged':False})
for curve in rig.animation_data.action.fcurves:
    for key in curve.keyframe_points:key.interpolation='CONSTANT'
scene.frame_set(1);scene.render.filepath='//front-quarter.png'
scene['study_status']='Fieldwear identity/silhouette redesign against selected pixel art; internal candidate.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'representation-study.blend'),compress=True)
for record in records:
    scene.frame_set(record['frame']);scene.render.filepath=str(out/(record['pose']+'.png'));bpy.ops.render.render(write_still=True)
study=json.loads((base/'study.json').read_text(encoding='utf-8'))
study.update({'frames':records,'method':'Shared fieldworker source: structured fieldwear silhouette, open standing collar, backpack, work boots and short beard.',
              'parentStudy':str(base.relative_to(ROOT)),'parentBlendSha256':hashlib.sha256((base/'representation-study.blend').read_bytes()).hexdigest(),
              'identityReference':'prototypes/visual-direction/art-pack-media/actor-front.png',
              'identityReferenceScope':'Selected original standing identity; rejected art-cast-v03 is not used.',
              'comparisonTitle':'肩背与野外衣装修订',
              'comparisonFooter':'共享母版造型修订；原相机与原握持保持，原画身份对照另附。',
              'designChanges':['Restored shoulder girdle without changing hand/finger basis.','Supported garment yoke and fitted waist.',
                               'Actual open-front standing collar and backpack/webbing.','Trouser cuffs over taller work-boot shafts.',
                               'Short charcoal beard instead of full cheek mask; fuller hair silhouette.'],
              'shoulderJointsBefore':shoulders_before,'shoulderJointsAfter':shoulders_after,
              'artApproved':False,'walkingApproved':False,'homepageIntegrated':False})
(out/'study.json').write_text(json.dumps(study,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Identity comparison is not a pixel-perfect pose comparison: the selected
# illustration has a bent left arm. Only the reference is resized to full-body
# height; both rendered candidates use the same native canvas at exactly 2x.
reference=Image.open(ROOT/study['identityReference']).convert('RGBA')
reference.save(out/'reference-original.png')
reference=reference.crop(reference.getbbox())
old=Image.open(out/'before-front-quarter.png').convert('RGBA')
new=Image.open(out/'front-quarter.png').convert('RGBA')
height=(old.getbbox()[3]-old.getbbox()[1])*2
reference=reference.resize((round(reference.width*height/reference.height),height),Image.Resampling.NEAREST)
board=Image.new('RGB',(1050,650),'#e1e5d7');draw=ImageDraw.Draw(board)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',21)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
for i,(subject,title) in enumerate([(reference,'原画身份参照（姿态不同）'),(old,'上一版：圆肩与宽松上衣'),(new,'本轮：肩背与野外衣装')]):
    if i:subject=subject.resize((320,448),Image.Resampling.NEAREST)
    bounds=subject.getbbox();y=510-bounds[3];x=i*350+(350-subject.width)//2
    board.paste(subject,(x,y),subject)
    draw.text((i*350+14,20),title,font=font,fill='#244238')
draw.text((20,550),'本轮修改：外套肩背 / 立领 / 背带与软包 / 收腰 / 靴筒 / 短须',font=font,fill='#244238')
draw.text((20,593),'原画仅作全身等高的身份比较，经过重采样；旧、新母版均为原生像素2倍放大。',font=small,fill='#536855')
board.save(out/'identity-comparison.png')
print('Saved fieldwear design revision and both actual orientations.',flush=True)
