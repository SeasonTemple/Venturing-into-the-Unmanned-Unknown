"""Render independent front/side/quarter views of the evaluated saved poses."""
import argparse,json,math
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image,ImageDraw,ImageFont

parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);parser.add_argument('--out-dir',type=Path,required=True);args=parser.parse_args()
src=args.source_dir.resolve();out=args.out_dir.resolve();out.mkdir(parents=True,exist_ok=True)
doc=json.loads((src/'reference.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(src/'motion-reference.blend'))
scene=bpy.context.scene;main=scene.camera;rig=bpy.data.objects['Fieldworker_master_rig']
# Derive overlays from the saved evaluated geometry and its actual camera.
# An ankle's projection is not the shoe's ground-contact patch.
boot_object=bpy.data.objects['Ankle_boots']
indices={s:[v.index for v in boot_object.data.vertices if (v.co.x<0)==(s=='R')] for s in ['R','L']}
for frame in doc['frames']:
    scene.frame_set(frame['frame']+1);d=frame['diagnostics'];shoe=boot_object.evaluated_get(bpy.context.evaluated_depsgraph_get())
    def pixel(v):
        p=world_to_camera_view(scene,main,Vector(v));return [p.x*180,(1-p.y)*240]
    com=Vector(d['estimatedCom']);ground=Vector((com.x,com.y,0));centres={};heights={}
    for side in ['R','L']:
        pts=[shoe.matrix_world@shoe.data.vertices[n].co for n in indices[side]];floor=min(p.z for p in pts);heights[side]=floor
        if side in d['contactFeet']:
            patch=[p for p in pts if p.z<=floor+.0012];centre=sum(patch,Vector())/len(patch);centre.z=0;centres[side]=pixel(centre)
    frame['balanceOverlay']={'com':pixel(com),'ground':pixel(ground),'contacts':centres}
    d['evaluatedSoleHeights']=heights
(src/'reference.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
scene.render.resolution_x=360;scene.render.resolution_y=480;scene.render.resolution_percentage=100
data=bpy.data.cameras.new('Independent_balance_review');camera=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(camera);data.type='ORTHO';data.ortho_scale=1.99;scene.camera=camera
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
sheet=Image.new('RGB',(1080,4*560),'#e1e5d7')
views=[('正面',(0,-4,1.65)),('提箱侧',(-4,0,1.65)),('三分之四',(2.7,-3.5,2.25))]
for row,f in enumerate([0,6,12,18]):
    scene.frame_set(f+1);track_y=main.location.y+3.5
    diag=doc['frames'][f]['diagnostics'];com=Vector(diag['estimatedCom']);ground=Vector((com.x,com.y,0));ankle=Vector(diag['ankleTargets'][diag['supportFoot']]);ankle.z=0
    for col,(name,position) in enumerate(views):
        camera.location=Vector(position)+Vector((0,track_y,0));target=Vector((0,track_y,.93));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        image_path=out/f'pose-{f:02}-{col}.png';scene.render.filepath=str(image_path);bpy.ops.render.render(write_still=True)
        im=Image.open(image_path).convert('RGBA');panel=Image.new('RGB',(360,560),'#e1e5d7');d=ImageDraw.Draw(panel)
        def xy(v):
            p=world_to_camera_view(scene,camera,Vector(v));return (p.x*360,40+(1-p.y)*480)
        for x in [-.4,-.2,0,.2,.4]:d.line([xy((x,track_y-1,0)),xy((x,track_y+1,0))],fill='#c1cbb8')
        for y in [-1,-.5,0,.5,1]:d.line([xy((-.5,track_y+y,0)),xy((.5,track_y+y,0))],fill='#c1cbb8')
        panel.paste(im,(0,40),im);a,b=xy(com),xy(ground)
        for t in range(0,20,2):
            p=(a[0]+(b[0]-a[0])*t/20,a[1]+(b[1]-a[1])*t/20);q=(a[0]+(b[0]-a[0])*(t+1)/20,a[1]+(b[1]-a[1])*(t+1)/20);d.line([p,q],fill='#b15e29',width=2)
        d.ellipse((a[0]-4,a[1]-4,a[0]+4,a[1]+4),fill='#b15e29');d.line([(b[0]-6,b[1]),(b[0]+6,b[1])],fill='#b15e29',width=2)
        p=xy(ankle);d.ellipse((p[0]-7,p[1]-3,p[0]+7,p[1]+3),outline='#356d5a',width=2)
        # Draw the anatomical right shoulder-elbow-wrist from actual evaluated
        # joints, not from the requested IK targets.
        positions=[rig.matrix_world@rig.pose.bones[n].head for n in ['upperarm01.R','lowerarm01.R','wrist.R']]
        d.line([xy(v) for v in positions],fill='#56766b',width=2)
        for v in positions:
            x,y=xy(v);d.ellipse((x-3,y-3,x+3,y+3),fill='#356d5a')
        d.text((12,8),f'{name} / 导出帧 {f+1}',font=font,fill='#244238')
        d.text((12,520),f'右肘屈曲 {diag["elbowFlexDegrees"]["R"]:.1f}° · 支撑 {diag["supportFoot"]}',font=small,fill='#244238')
        panel.save(out/f'review-{f:02}-{col}.png');sheet.paste(panel,(col*360,row*560))
sheet.save(out/'three-view-review.png')
print(out/'three-view-review.png')
