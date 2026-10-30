"""Reopen the saved authoring file, repeat the render and test actual GLB export."""
import hashlib
import json
import argparse
from pathlib import Path
import bpy
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
MEDIA=ROOT/'prototypes/visual-direction/character-master-media'
TEMP=ROOT/'.lab/character-master'
parser=argparse.ArgumentParser();parser.add_argument('--revision',choices=['v01','v02'],default='v01');args=parser.parse_args();rev=args.revision
bpy.ops.wm.open_mainfile(filepath=str(MEDIA/f'character-master-{rev}.blend'))
scene=bpy.context.scene
rig=bpy.data.objects['Fieldworker_master_rig']
scene.render.filepath=str(TEMP/f'reopened-left-{rev}.png')
bpy.ops.render.render(write_still=True)
original=Image.open(MEDIA/f'left-master-{rev}.png').convert('RGBA')
reopened=Image.open(TEMP/f'reopened-left-{rev}.png').convert('RGBA')
same=ImageChops.difference(original,reopened).getbbox() is None
assert same,'Saved master does not reproduce the delivered render'
assert bpy.data.objects['RIGHT_silver_toolbox'].parent_bone=='wrist.R'
assert bpy.data.objects['LEFT_green_recorder'].parent_bone=='wrist.L'
for name in ['Continuous_human_body','Editable_coat_and_trousers','Short_hair','Ankle_boots']:
    assert any(m.type=='ARMATURE' and m.object==rig for m in bpy.data.objects[name].modifiers),name
assert not any(i.source=='FILE' and not i.packed_file for i in bpy.data.images),'Unexpected external image dependency'
occluded_faces=None
if rev=='v02':
    pack=ROOT/'.lab/character-master/system-assets'
    lines=(pack/'clothes/shoes03/shoes03.mhclo').read_text().splitlines()
    tokens=' '.join(lines[lines.index('delete_verts')+1:]).split()
    hidden=set();i=0
    while i<len(tokens):
        a=int(tokens[i])
        if i+1<len(tokens) and tokens[i+1]=='-':hidden.update(range(a,int(tokens[i+2])+1));i+=3
        else:hidden.add(a);i+=1
    body=bpy.data.objects['Continuous_human_body']
    assert not any(any(i in hidden for i in p.vertices) for p in body.data.polygons),'Official boot occlusion ignored'
    occluded_faces=True
    for name in ['Closed_raincoat_placket','Center_zipper_seam','Low_standing_raincoat_collar','Fitted_eyes']:
        assert any(m.type=='ARMATURE' and m.object==rig for m in bpy.data.objects[name].modifiers),name
target=TEMP/f'master-export-check-{rev}.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_animations=False)
assert target.read_bytes()[:4]==b'glTF'
report={
 'masterReopened':True,'repeatRenderPixelsIdentical':same,
 'bodyAlphaBounds':original.getbbox(),'visiblePixelHeight':original.getbbox()[3]-original.getbbox()[1],
 'bodyBoneCount':len(rig.data.bones),'meshObjects':sum(o.type=='MESH' for o in scene.objects),
 'sharedRigMeshes':['Continuous_human_body','Editable_coat_and_trousers','Short_hair','Ankle_boots'],
 'equipmentBones':{'silverToolbox':'wrist.R','greenRecorder':'wrist.L'},
 'externalImageDependencies':False,'glbExport':{'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},
 'sourceBootOcclusionVerified':occluded_faces,'packedImages':sum(bool(i.packed_file) for i in bpy.data.images),
 'artApproved':False,'walkingTested':False,
 'visualLimits':['Face and costume are approximate; not an identity match.','Cloth pixel clusters and footwear remain below the approved illustration.','Grip, deformation and gait require separate pose review.'],
}
destination=ROOT/('docs/research/homepage-character-master-v02-validation.json' if rev=='v02' else 'docs/research/homepage-character-master-validation.json')
destination.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2),flush=True)
