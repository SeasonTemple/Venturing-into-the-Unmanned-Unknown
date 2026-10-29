"""Two static views from a single editable 3D character and actual Eevee lighting.

Uses the existing MakeHuman source master only as a structural test input.
It does not import any rejected retargeted walk, deform a raster person, or
claim a new approved identity. A reviewed, pinned GPL shader source is copied
with its license; its Bayer helper is replaced in memory to avoid /tmp writes.
"""
import argparse
import ast
import hashlib
import importlib.machinery
import importlib.util
import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out-dir', type=Path, required=True)
args = parser.parse_args()
OUT = args.out_dir.resolve()
if OUT.exists():
    raise ValueError('Choose a new output directory; never overwrite artwork')
OUT.mkdir(parents=True)
SOURCE = ROOT/'prototypes/visual-direction/character-master-media/character-master-v02.blend'
SHADERS = ROOT/'.lab/character-route-research-20261029/pixel-render-material-code.source'
LICENSE = ROOT/'.lab/character-route-research-20261029/pixel-render-license.source'
SHA = 'f2f52c52a1902eb5415bef59501c40aaa39590a74d5e50643afab0135decf555'
if hashlib.sha256(SHADERS.read_bytes()).hexdigest() != SHA:
    raise ValueError('Pinned reviewed upstream shader source changed')
tree = ast.parse(SHADERS.read_text(encoding='utf-8-sig'))
assert all(isinstance(n, (ast.Expr, ast.FunctionDef, ast.Import)) for n in tree.body)
assert [ast.unparse(n) for n in tree.body if isinstance(n, ast.Import)] == ['import bpy']
srcdir = OUT/'source';srcdir.mkdir()
shutil.copy2(SHADERS, srcdir/'pixel_art_addon.py')
shutil.copy2(LICENSE, srcdir/'LICENSE-pixel-shader-GPLv3.txt')
shutil.copy2(ROOT/'prototypes/visual-direction/character-master-media/LICENSE-MakeHuman-CC0.txt',srcdir/'LICENSE-character-CC0.txt')
shutil.copy2(ROOT/'prototypes/visual-direction/character-master-media/source-manifest-v02.json',srcdir/'character-source-manifest.json')

bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
rig = bpy.data.objects['Fieldworker_master_rig']
rig.animation_data_clear()
scene.frame_start=1;scene.frame_end=2
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=32
scene.render.resolution_x=160;scene.render.resolution_y=224
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.image_settings.color_depth='8'
scene.render.film_transparent=True
scene.render.filter_size=.01
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.render.fps=1
bpy.context.preferences.filepaths.save_version=0

loader=importlib.machinery.SourceFileLoader('reviewed_pixel_material', str(srcdir/'pixel_art_addon.py'))
spec=importlib.util.spec_from_loader(loader.name,loader)
upstream=importlib.util.module_from_spec(spec);loader.exec_module(upstream)


def bayer_in_memory():
    image=bpy.data.images.get('Study_Bayer_2x2') or bpy.data.images.new('Study_Bayer_2x2',2,2)
    image.pixels=[v for value in [.75,.25,0,.5] for v in [value,value,value,1]]
    image.pack()
    return image


upstream.get_bayer=bayer_in_memory


def linear(hex_color):
    c=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)


palettes={
 'skin':['594434','956746','c7915b','e9bb7f','f6d9a0'],
 'coat':['59372c','914322','c96927','e99838','f5c66a'],
 'pants':['182a29','2b4035','44583a','73845a','a8b77a'],
 'boots':['172224','25312d','424a3b','687253','a0a785'],
 'hair':['101a1c','192625','29372b','44523a','647147'],
 'metal':['334c48','617c72','92a696','becdb7','e5e9cd'],
 'recorder':['183c35','2b5946','4c7c5b','82a677','b7cc91'],
 'dark':['102324','1b302e','29413a','3b5747','63795b'],
 'eye':['838f78','aab59b','cad0b0','e2e1c0','f5efd1'],
 'stubble':['3d382d','5a4a35','7e6344','aa8a60','d1b381'],
}


def category(name):
    n=name.lower()
    if 'eyebrow' in n:return 'hair'
    for key in ['skin','coat','pants','boots','hair','stubble']:
        if key in n:return key
    if 'silver' in n:return 'metal'
    if 'recorder' in n:return 'recorder'
    if 'eyes' in n:return 'eye'
    return 'dark'


def material(key, old=None):
    mat=upstream.dynamic_material(bpy.context, 'Study_NPR_'+key)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bsdf=nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value=(.8,.8,.8,1)
    bsdf.inputs['Roughness'].default_value=.85
    # The upstream source links a normal output to a numbered Principled
    # socket. Its index is not stable across Blender versions. This character
    # has no normal-map input; retain the original mesh normals instead.
    for socket in bsdf.inputs:
        for link in list(socket.links):
            if link.from_node.type=='NORMAL_MAP':links.remove(link)
    # Keep the upstream light->RGB, threshold and screen-space pattern graph,
    # but use an explicit project palette instead of default purple/red hues.
    # Screen-anchored Bayer dots are unsuitable for the approved meadow's
    # grouped paint shapes, and would crawl across a moving silhouette.
    nodes['Mix (Legacy)'].inputs[0].default_value=0
    ramp=nodes['Color Ramp'].color_ramp
    for element,color,pos in zip(ramp.elements,palettes[key],[0,.10,.24,.45,.72]):
        element.position=pos;element.color=linear(color)
    emission=nodes['Emission']
    for link in list(emission.inputs['Color'].links):links.remove(link)
    links.new(nodes['Color Ramp'].outputs['Color'],emission.inputs['Color'])
    if key=='hair' and old:
        tex=next((n.image for n in old.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None)
        if tex:
            image=nodes.new('ShaderNodeTexImage');image.image=tex;image.interpolation='Closest'
            clip=nodes.new('ShaderNodeMath');clip.operation='GREATER_THAN';clip.inputs[1].default_value=.45
            links.new(image.outputs['Alpha'],clip.inputs[0])
            transparent=nodes.new('ShaderNodeBsdfTransparent')
            mix=nodes.new('ShaderNodeMixShader');links.new(clip.outputs[0],mix.inputs[0])
            links.new(transparent.outputs[0],mix.inputs[1]);links.new(emission.outputs[0],mix.inputs[2])
            output=nodes['Material Output']
            for link in list(output.inputs['Surface'].links):links.remove(link)
            links.new(mix.outputs[0],output.inputs['Surface'])
    return mat


old_materials={s.material.name:s.material for o in scene.objects for s in o.material_slots if s.material}
new_materials={}
for name,old in old_materials.items():
    key=category(name)
    if key not in new_materials:new_materials[key]=material(key, old)
for ob in scene.objects:
    for slot in ob.material_slots:
        if slot.material and not slot.material.name.startswith('Study_NPR_'):
            slot.material=new_materials[category(slot.material.name)]

# Hands have real source hand/finger geometry. The dark glove is a material
# assignment to those surfaces, not a mitten floating on a wrist endpoint.
body=bpy.data.objects['Continuous_human_body']
body.data.materials.append(new_materials['dark'])
glove_slot=len(body.data.materials)-1
for poly in body.data.polygons:
    amount=sum(sum(g.weight for g in body.data.vertices[i].groups
                   if body.vertex_groups[g.group].name.startswith(('finger','wrist')))
               for i in poly.vertices)/len(poly.vertices)
    if amount>.62:poly.material_index=glove_slot

for ob in list(scene.objects):
    if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)


def light(name, kind, location, energy, color, target=(0,0,.8), size=None):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.location=location;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    if size is not None:data.shape='DISK';data.size=size
    return ob


sun=light('Meadow_warm_sun','SUN',(-3,-4,6),2.0,(1,.87,.68))
sun.data.angle=math.radians(8)
light('Cool_sky_fill','AREA',(3,-1,4),130,(.60,.84,1),size=5)
light('Grass_bounce','AREA',(-2,2,1.4),35,(.76,1,.63),size=4)
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.65,.65,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.15
camera=scene.camera
camera.location=(3,-6,3.4);target=Vector((0,0,.88))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.05

records=[]
for frame,angle,label in [(1,0,'front-quarter'),(2,-35,'turned')]:
    rig.rotation_mode='XYZ';rig.rotation_euler.z=math.radians(angle)
    rig.keyframe_insert('rotation_euler',frame=frame)
    scene.frame_set(frame);bpy.context.view_layer.update()
    root=world_to_camera_view(scene,camera,Vector((0,0,0)))
    records.append({'frame':frame,'pose':label,'rootAngleDegrees':angle,
                    'anchor':[root.x*160,(1-root.y)*224],
                    'sameCamera':True,'sourceJointPoseUnchanged':True})
for curve in rig.animation_data.action.fcurves:
    for point in curve.keyframe_points:point.interpolation='CONSTANT'
scene.frame_set(1)
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:image.pack()
scene['study_status']='Static appearance/representation experiment, not approved art or walking'
scene['pose_change']='Full rig root rotation, fixed camera; source standing joint pose retained'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'representation-study.blend'),compress=True)
for record in records:
    scene.frame_set(record['frame'])
    scene.render.filepath=str(OUT/(record['pose']+'.png'))
    bpy.ops.render.render(write_still=True)

(OUT/'study.json').write_text(json.dumps({
 'method':'Existing editable CC0 structural master, actual Eevee lights, pinned upstream pixel shader with explicit project ramps, two full-rig orientations.',
 'sourceMaster':str(SOURCE.relative_to(ROOT)), 'sourceMasterSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'sourceShaderCommit':'f13502c1fa71fd92e3969f35e9edeab17f4da52d','sourceShaderSha256':SHA,
 'shaderAdaptation':['Bayer helper held/packed in memory; screen-space Bayer blending disabled.','Project color ramps replace default hue outputs.','Source hair alpha retained with a deterministic threshold.','Unused upstream normal-map link removed; actual mesh normals retained.'],
 'palettes':palettes,'frames':records,'resolution':[160,224],
 'lightDirection':list(sun.location),'paidGenerationCalls':0,
 'sourceLimitations':['Generic structural master is not an approved project character.','Source finger grip and clothing remain to be judged visually.','No new walking pose, retargeting or animation interpolation.'],
 'artApproved':False,'walkingApproved':False,'homepageIntegrated':False
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Rendered two full-rig orientations and saved editable representation study.',flush=True)
