"""Retarget CMU walking to the existing editable 3D proxy for motion reference.

The proxy's art/identity has NOT been approved. It supplies continuous body
volume, actual occlusion and pose guides; it is not a replacement product actor.
"""
import bpy, json, math, hashlib, shutil, subprocess, argparse
from pathlib import Path
import numpy as np
from mathutils import Vector,Matrix
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--out-dir',type=Path,required=True);parser.add_argument('--balance-transfer',action='store_true');args=parser.parse_args()
OUT=args.out_dir.resolve()
OUT.mkdir(exist_ok=True)
if (OUT/'reference.json').exists():raise ValueError('Keep prior reference exports')
(OUT/'frames').mkdir(exist_ok=True)
doc=json.loads((ROOT/'.lab/whole-walk/cmu-sampled/world-joints.json').read_text())
motion=doc['frames'];indices=list(range(0,240,5))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'prototypes/visual-direction/character-master-media/character-master-v02.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');scene=bpy.context.scene
base={p.name:p.matrix_basis.copy() for p in rig.pose.bones};base_z=rig.location.z
base_grip=rig.matrix_world@rig.pose.bones['wrist.R'].tail
case_parts={o.name:o.matrix_world.copy() for o in bpy.data.objects if o.name.startswith(('RIGHT_silver_toolbox','Toolbox_'))}
rig.animation_data_clear()
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
def vector(v):return Vector((v[0],-v[2],v[1]))
def points(i):return {k:vector(v) for k,v in motion[i]['joints'].items()}
average_root=float(np.mean([motion[i]['joints']['root'][1] for i in indices]))
def aim(name,direction):
    pb=rig.pose.bones[name];matrix=pb.matrix.copy();current=matrix.to_3x3()@Vector((0,1,0))
    rotation=current.rotation_difference(direction.normalized())
    pb.matrix=Matrix.Translation(matrix.translation)@rotation.to_matrix().to_4x4()@matrix.to_3x3().to_4x4()
    bpy.context.view_layer.update()

scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.device='CPU';scene.cycles.seed=0
scene.render.resolution_x=180;scene.render.resolution_y=240;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.color_mode='RGBA';scene.render.filter_size=.01
scene.render.fps=24;scene.frame_start=1;scene.frame_end=len(indices)
scene.camera.location=(2.7,-3.5,2.25)
scene.camera.rotation_euler=(Vector((0,0,.93))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=1.99
# Grey studio materials make this unmistakably a motion proxy. Color/style are
# assessed against the approved raster in the separate panel, never inferred.
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    for node in mat.node_tree.nodes:
        if node.type=='VALTORGB':
            for n,el in enumerate(node.color_ramp.elements):
                g=.07+.66*n/max(1,len(node.color_ramp.elements)-1);el.color=(g,g*.99,g*.94,1)
camera_base=scene.camera.location.copy()
balanced=None
if args.balance_transfer:
    from retarget_actor_balance import BalancedTransfer
    balanced=BalancedTransfer(rig,motion,base,indices)
records=[]
for f,i in enumerate(indices,1):
    scene.frame_set(f)
    for p in rig.pose.bones:p.matrix_basis=base[p.name].copy()
    rig.location=(0,0,base_z+(motion[i]['joints']['root'][1]-average_root)*.055)
    bpy.context.view_layer.update();j=points(i)
    diagnostics=None
    if balanced:
        diagnostics=balanced.build(i)
        scene.camera.location=camera_base+Vector((0,(points(i)['root'].y-points(0)['root'].y)*balanced.scale,0))
        scene.camera.keyframe_insert('location',frame=f)
        boot=bpy.data.objects['Ankle_boots'];evaluated=boot.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor=min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)
    else:
        # Preserve the original spine's curvature while transferring the complete
        # measured trunk tilt. No independent horizontal chest slider or fixed face.
        trunk=(j['thorax']-j['root']).normalized();trunk_delta=Vector((0,0,1)).rotation_difference(trunk)
        for name in ['spine05','spine04','spine03','spine02','spine01']:
            rest=rig.data.bones[name].tail_local-rig.data.bones[name].head_local
            aim(name,trunk_delta@rest)
        for side in ['R','L']:
            s=side.lower();thigh=j[s+'femur']-j[s+'hipjoint'];shin=j[s+'tibia']-j[s+'femur']
            for part in ['upperleg01','upperleg02']:aim(part+'.'+side,thigh)
            for part in ['lowerleg01','lowerleg02']:aim(part+'.'+side,shin)
            # The foot direction is anatomical ankle -> ball, not a guessed sine.
            aim('foot.'+side,j[s+'foot']-j[s+'tibia'])
            # Source is an unladen walk. Occupied-arm adaptation is explicitly
            # authored and deliberately reduced; it is not called loaded mocap.
            upper=j[s+'humerus']-j[s+'clavicle'];phase=upper.y/max(upper.length,1e-5)
            swing=Matrix.Rotation(math.radians(float(np.clip(-phase*14,-7,7))),3,'X')
            for name in ['upperarm01','upperarm02']:
                bone=rig.pose.bones.get(name+'.'+side)
                if bone:aim(bone.name,swing@(bone.tail-bone.head))
            fore=Matrix.Rotation(math.radians(float(np.clip(phase*5,-2.5,2.5))),3,'X')
            for name in ['lowerarm01','lowerarm02']:
                bone=rig.pose.bones.get(name+'.'+side)
                if bone:aim(bone.name,fore@(bone.tail-bone.head))
        neck=(j['head']-j['thorax']).normalized()
        neck_delta=Vector((0,0,1)).rotation_difference(neck)
        for name in ['neck01','neck02','neck03','head']:
            rest=rig.data.bones[name].tail_local-rig.data.bones[name].head_local
            aim(name,neck_delta@rest)
        # Ground the complete proxy by its actual evaluated boot surface. The
        # source's stance-foot timing is retained; grip props remain bone children.
        boot=bpy.data.objects['Ankle_boots'];evaluated=boot.evaluated_get(bpy.context.evaluated_depsgraph_get())
        floor=min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)
        rig.location.z-=floor;bpy.context.view_layer.update()
    # Case stays vertical under the moving grip, rather than inheriting forearm
    # rotation. Its case and handle share the same corrective rotation.
    grip=rig.matrix_world@rig.pose.bones['wrist.R'].tail
    for name,rest in case_parts.items():
        ob=bpy.data.objects[name];mat=rest.copy();mat.translation=grip+(rest.translation-base_grip)
        ob.matrix_world=mat
        ob.keyframe_insert('location',frame=f);ob.keyframe_insert('rotation_euler',frame=f)
    for p in rig.pose.bones:
        p.keyframe_insert('location',frame=f);p.keyframe_insert('rotation_quaternion',frame=f);p.keyframe_insert('scale',frame=f)
    rig.keyframe_insert('location',frame=f)
    scene.render.filepath=str(OUT/'frames'/f'{f-1:03}.png');bpy.ops.render.render(write_still=True)
    from bpy_extras.object_utils import world_to_camera_view
    projected={}
    names=['root','spine01','neck03','head','upperleg01.R','lowerleg01.R','foot.R','upperleg01.L','lowerleg01.L','foot.L','upperarm01.R','lowerarm01.R','wrist.R','upperarm01.L','lowerarm01.L','wrist.L']
    for name in names:
        pos=world_to_camera_view(scene,scene.camera,rig.matrix_world@rig.pose.bones[name].head)
        projected[name]=[pos.x*180,(1-pos.y)*240]
    records.append({'frame':f-1,'sourceFrame':i+1,'floorBeforeCorrection':floor,'projected':projected,
                    'travelX':-(motion[i]['joints']['root'][2]-motion[indices[0]]['joints']['root'][2])*4.05,
                    'diagnostics':diagnostics,'rootZ':rig.location.z,'joints':{n:list(rig.matrix_world@rig.pose.bones[n].head) for n in ['root','spine01','neck03','head','upperleg01.R','lowerleg01.R','foot.R','upperleg01.L','lowerleg01.L','foot.L','upperarm01.R','lowerarm01.R','wrist.R','upperarm01.L','lowerarm01.L','wrist.L']}})
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'motion-reference.blend'),compress=True)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
sheet=Image.new('RGB',(8*180,300),'#e1e5d7');d=ImageDraw.Draw(sheet)
for col,idx in enumerate([0,6,12,18,24,30,36,42]):
    im=Image.open(OUT/'frames'/f'{idx:03}.png').convert('RGBA');sheet.paste(im,(col*180,34),im)
    d.text((col*180+10,9),f'CMU {indices[idx]+1}',font=font,fill='#244238')
sheet.save(OUT/'reference-keyposes.png')
atlas=Image.new('RGBA',(8*180,6*240))
for i in range(len(indices)):
    im=Image.open(OUT/'frames'/f'{i:03}.png').convert('RGBA');atlas.paste(im,((i%8)*180,(i//8)*240))
atlas.save(OUT/'reference-atlas.png')
pack=OUT/'video-frames';pack.mkdir(exist_ok=True)
for f in range(len(indices)):
    im=Image.open(OUT/'frames'/f'{f:03}.png').convert('RGBA');page=Image.new('RGB',(720,560),'#e1e5d7');d=ImageDraw.Draw(page)
    d.text((24,16),'运动参考 / 连续骨架与体积 / 非成品美术',font=font,fill='#244238')
    big=im.resize((360,480),Image.Resampling.NEAREST);page.paste(big,(320,64),big)
    page.paste(im,(32,80),im)
    small=im.resize((90,120),Image.Resampling.NEAREST);page.paste(small,(77,365),small)
    d.text((24,515),f'{f+1:02} / {len(indices)} · 24fps · 同一相机与模型',font=font,fill='#244238')
    page.save(pack/f'{f:03}.png')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','24','-i',str(pack/'%03d.png'),'-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'motion-reference.mp4')],check=True)
meta={'method':__doc__,'source':doc['source'],'sourceFps':120,'fps':24,'cell':[180,240],'columns':8,'frames':records,
      'balancedTransfer':args.balance_transfer,'artApproved':False,'walkingApproved':False,'productionIntegrated':False,
      'purpose':'Pose/occlusion and whole-body motion reference for later artwork.',
      'limitations':['Proxy character identity and materials are not approved art.','CMU motion is unladen; occupied-arm IK and assumed-mass COM trajectory matching are authored kinematic adaptations, not a dynamics validation.' if args.balance_transfer else 'CMU motion is unladen; occupied-arm damping is an authored adaptation.','Support-foot horizontal slip is not corrected by IK.','Finite measured walking segment; starting, turning and stopping are not supplied by this capture.']}
(OUT/'reference.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
sources=OUT/'source';sources.mkdir(exist_ok=True)
for file in ['07.asf','07_01.amc']:shutil.copy2(ROOT/'.lab/whole-walk/cmu07'/file,sources/file)
shutil.copy2(ROOT/'prototypes/visual-direction/character-master-media/LICENSE-MakeHuman-CC0.txt',sources/'LICENSE-MakeHuman-CC0.txt')
(sources/'CMU-ATTRIBUTION.txt').write_text('Motion capture data: CMU Graphics Lab Motion Capture Database, subject 07, trial 01 (walk, 120fps).\nhttps://mocap.cs.cmu.edu/subjects/07/07_01.amc\nUsage: https://mocap.cs.cmu.edu/faqs.php\nThe FAQ states: "The motion capture data may be copied, modified, or redistributed without permission."\nSource is unladen walking. This project\'s occupied-arm adaptation is not captured loaded motion.\n',encoding='utf8')
print('Reference exported',OUT,flush=True)
