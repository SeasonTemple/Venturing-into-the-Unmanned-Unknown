"""Replay the saved v05 rig and package a synchronized full-body comparison."""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
from PIL import Image,ImageChops,ImageDraw,ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--hip',action='store_true',help='Check v06 hip correction against unchanged v05 gait')
args=parser.parse_args();tag='actor-v06' if args.hip else 'actor-v05';old_tag='actor-v05' if args.hip else 'actor-v03'
OUT=ROOT/('prototypes/visual-direction/'+tag.replace('actor-','actor-rig-'))
OLD=ROOT/('prototypes/visual-direction/'+old_tag.replace('actor-','actor-rig-'))
report=json.loads((OUT/(tag+'.json')).read_text(encoding='utf-8'))
old=json.loads((OLD/(old_tag+'.json')).read_text(encoding='utf-8'))
spec=json.loads((OUT/report['specification']).read_text(encoding='utf-8'))
frames={f['frame']:f['file'] for f in report['frames']}
old_frames={f['frame']:f['file'] for f in old['frames']}
frame_hashes={f['frame']:f['sha256'] for f in report['frames']}
assert len(frames)==50
assert hashlib.sha256((OUT/report['source']).read_bytes()).hexdigest()==report['sourceSha256']==old['sourceSha256']
lab=ROOT/('.lab/'+tag);lab.mkdir(exist_ok=True)
preview=lab/'preview';preview.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/(tag+'-editable.blend')),load_ui=False,use_scripts=False)
rig=bpy.data.objects[report['rigName']];scene=bpy.context.scene
points={}
for f in range(50):
    scene.frame_set(f)
    points[f]={'ankles':{s:[rig.pose.bones['foot_'+s].head.x+78,348-rig.pose.bones['foot_'+s].head.z] for s in ['R','L']},
               'feetMatrices':{s:[list(row) for row in rig.pose.bones['foot_'+s].matrix] for s in ['R','L']},
               'gripError':(rig.pose.bones['toolbox_R'].head-rig.pose.bones['hand_R'].tail).length,
               'headScale':list(rig.pose.bones['head'].matrix.to_scale())}
assert max(p['gripError'] for p in points.values())<1e-3
assert max(abs(v-1) for p in points.values() for v in p['headScale'])<1e-4
supports=[]
for interval in spec['motion']['supportIntervals']:
    for side in interval['legs']:
        anchor=points[interval['from']]['ankles'][side]
        max_error=max(math.dist(anchor,points[f]['ankles'][side]) for f in range(interval['from'],interval['to']+1))
        matrix=points[interval['from']]['feetMatrices'][side]
        matrix_error=max(abs(matrix[i][j]-points[f]['feetMatrices'][side][i][j])
                         for f in range(interval['from'],interval['to']+1) for i in range(4) for j in range(4))
        assert max_error<1e-3 and matrix_error<1e-3
        supports.append({**interval,'side':side,'maxAnkleErrorPx':max_error,'maxFootMatrixError':matrix_error})
# Actual lead feet alternate in screen X: source R, first landing L, next R.
leads=[]
for f in [1,13,23]:
    leads.append(min(['R','L'],key=lambda s:points[f]['ankles'][s][0]))
assert leads==['R','L','R']
samples={s['frame']:s for s in report['motionSamples']}
root=[samples[f]['rootShift'][0] for f in range(1,50)]
assert all(a>=b for a,b in zip(root,root[1:]))
travel_speeds=[root[f]-root[f+1] for f in range(3,22)]
assert min(travel_speeds)>0.5
rerenders=[]
for f in [0,8,13,18,23,31,49]:
    scene.frame_set(f);scene.render.filepath=str(lab/f'reopened-{f:03}.png')
    bpy.ops.render.render(write_still=True)
    a=Image.open(scene.render.filepath).convert('RGBA');b=Image.open(OUT/frames[f]).convert('RGBA')
    assert ImageChops.difference(a,b).getbbox(alpha_only=False) is None
    rerenders.append(f)
stopped=Image.open(OUT/frames[31]).convert('RGBA').crop((0,0,300,165))
for f in range(32,50):
    assert ImageChops.difference(stopped,Image.open(OUT/frames[f]).convert('RGBA').crop((0,0,300,165))).getbbox(alpha_only=False) is None
source=Image.open(OUT/report['source']).convert('RGBA')
source_canvas=Image.new('RGBA',(300,400));source_canvas.alpha_composite(source,(72,26))
reference_delta=ImageChops.difference(source_canvas,Image.open(OUT/frames[0]).convert('RGBA'))
assert not reference_delta.getchannel('A').getbbox()
assert max(hi for lo,hi in reference_delta.getextrema())<=4

font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
bg='#dce1d2';ink='#263e32';quiet='#52634d'
old_spec=json.loads((OLD/old['specification']).read_text(encoding='utf-8'))
atlas=Image.new('RGBA',(2100,2800));before_atlas=atlas.copy()
manifest={'version':'hip06' if args.hip else 'gait05','kind':'gait','fps':12,'frameCount':49,'frameSize':[300,400],'columns':7,
          'beforeAtlas':'before-motion-atlas.png' if args.hip else 'actor-v04-motion-atlas.png','afterAtlas':tag+'-atlas.png',
          'sourceRig':tag+'-editable.blend','frames':[], 'artApproved':False,'homepageIntegrated':False}
old_finished=ROOT/'prototypes/visual-direction/actor-rig-v04/final'
for f in range(1,50):
    assert hashlib.sha256((OUT/frames[f]).read_bytes()).hexdigest()==frame_hashes[f]
    im=Image.open(OUT/frames[f]).convert('RGBA')
    # Compare against the latest v04 publication, preserving its cloth patches.
    previous=Image.open(OLD/old_frames[f] if args.hip else old_finished/f'actor-v04-frame-{f:03}.png').convert('RGBA')
    if args.hip:
        assert report['motionSamples'][f]==old['motionSamples'][f]
        delta=ImageChops.difference(previous,im)
        # All changes are in the hip/upper-thigh rendering, above the knees.
        assert not delta.crop((0,0,300,216)).getbbox(alpha_only=False)
        assert not delta.crop((0,295,300,400)).getbbox(alpha_only=False)
    assert im.getbbox()[0]>0 and im.getbbox()[2]<300
    spot=((f-1)%7*300,(f-1)//7*400)
    atlas.paste(im,spot);before_atlas.paste(previous,spot)
    current=next(p for p in reversed(spec['poses']) if p['frame']<=f)
    old_pose=next(p for p in reversed(old_spec['poses']) if p['frame']<=f)
    manifest['frames'].append({'number':f,'label':current['label'],'beforeLabel':old_pose['label'],
                               'rootX':samples[f]['rootShift'][0],'beforeRootX':old['motionSamples'][f]['rootShift'][0],
                               'support':''.join(s for s in ['R','L'] if any(s in i['legs'] and i['from']<=f<=i['to'] for i in spec['motion']['supportIntervals'])),
                               'changedPixels':0,'ora':None})
    view=Image.new('RGB',(960,570),bg);draw=ImageDraw.Draw(view)
    draw.text((24,16),'负重行走 / 完整身体同步对照',font=font,fill=ink)
    titles=('05 / 原髋部权重','06 / 提箱侧髋腿联动') if args.hip else ('04 / 短步追近','05 / 后脚先迈、交替超越')
    for x,image,title,label in [(30,previous,titles[0],old_pose['label']),(470,im,titles[1],current['label'])]:
        draw.text((x+12,55),title,font=font,fill=ink)
        draw.text((x+12,84),label,font=small,fill=quiet)
        view.paste(image,(x+20,110),image)
    draw.text((24,530),f'{f} / 49 · 12fps · 同一原画、同一相机；动作候选，未接正式首页。',font=small,fill=quiet)
    view.save(preview/f'{f-1:03}.png')
    if f==18:view.save(OUT/(tag+'-comparison.png'))
sheet=Image.new('RGB',(1200,860),bg);draw=ImageDraw.Draw(sheet)
for i,f in enumerate([1,4,8,13,18,23,27,31]):
    key=next(p for p in spec['poses'] if p['frame']==f)
    image=Image.open(OUT/frames[f]).convert('RGBA');x=i%4*300;y=i//4*430
    sheet.paste(image,(x,y+28),image)
    draw.text((x+8,y+4),str(f)+' '+key['label'],font=small,fill=ink)
sheet.save(OUT/(tag+'-keyposes.png'))
atlas.save(OUT/manifest['afterAtlas'],optimize=True)
before_atlas.save(OUT/manifest['beforeAtlas'],optimize=True)
(OUT/'review.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ffmpeg=shutil.which('ffmpeg')
if ffmpeg:
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate','12','-i',str(preview/'%03d.png'),
                    '-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/(tag+'-comparison.mp4'))],check=True)
validation={'sourceIdentityAndEquipmentPreserved':True,'headScaleUnchanged':True,'sourceReferenceAlphaIdentical':True,
            'supportChecks':supports,'maxGripErrorPx':max(p['gripError'] for p in points.values()),
            'actualLeadFootSequence':leads,'rootTravelMonotone':True,'minTravelPerFrameDuringStridesPx':min(travel_speeds),
            'stoppedHeadPixelsIdenticalFrames31To49':True,'noFrameClipped':True,'savedRigRerenderIdenticalFrames':rerenders,
            'durationSeconds':49/12,'footRollImplemented':False,'poseRetouchReused':False,
            'compositeSolePixelStabilityClaimed':False,'artApproved':False,'sceneValidated':False,'newPaidMediaRequests':0}
if args.hip:validation.update({'boneMotionIdenticalToV05':True,'headHandsAndLowerLegRegionPixelsUnchanged':True,
                              'hipTransitionBySide':spec['skinning']['hipTransitionBySide']})
(OUT/(tag+'-validation.json')).write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(validation,ensure_ascii=False))
