"""Check the saved loaded-motion study and package a local inspection video.

Re-evaluate all baked frames, inspect actual grip/foot transforms, rerender
selected frames, and show native pixels plus a following grip close-up.
This is an offline animation study, not homepage runtime integration.
"""
import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--directory',type=Path,default=ROOT/'prototypes/visual-direction/actor-rig-v03')
args=parser.parse_args();directory=args.directory.resolve();tag='actor-v03'
report=json.loads((directory/(tag+'.json')).read_text(encoding='utf-8'))
spec=json.loads((directory/report['specification']).read_text(encoding='utf-8'))
lab=ROOT/'.lab/actor-layer-study/v03-motion-check';lab.mkdir(parents=True,exist_ok=True)
preview_dir=lab/'preview-frames';preview_dir.mkdir(exist_ok=True)
frames={item['frame']:item for item in report['frames']}
assert len(frames)==50
assert hashlib.sha256((directory/report['source']).read_bytes()).hexdigest()==report['sourceSha256']
bpy.ops.wm.open_mainfile(filepath=str((directory/(tag+'-editable.blend')).resolve()),load_ui=False,use_scripts=False)
scene=bpy.context.scene;rig=bpy.data.objects[report['rigName']]
textures={n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
assert len(textures)==9 and all(i.packed_file for i in textures)
actual={};max_grip_error=0;max_ankle_error=0
samples={item['frame']:item for item in report['motionSamples']}
for frame in range(50):
    scene.frame_set(frame)
    feet={side:[rig.pose.bones['foot_'+side].head.x+78,348-rig.pose.bones['foot_'+side].head.z] for side in ['R','L']}
    for side in feet:
        expected=samples[frame]['actualAnkles'][side]
        max_ankle_error=max(max_ankle_error,math.dist(feet[side],expected))
    grip=rig.pose.bones['toolbox_R'].head
    max_grip_error=max(max_grip_error,(grip-rig.pose.bones['hand_R'].tail).length)
    delta=rig.pose.bones['toolbox_R'].tail-grip
    angle=math.degrees(math.atan2(-delta.x,-delta.z))
    actual[frame]={'feet':feet,'grip':[grip.x+78,348-grip.z],
        'boxWorldDegrees':angle,'headScale':list(rig.pose.bones['head'].matrix.to_scale())}
assert max_grip_error<1e-3 and max_ankle_error<1e-3
supports=[]
for interval in spec['motion']['supportIntervals']:
    for side in interval['legs']:
        anchor=actual[interval['from']]['feet'][side]
        error=max(math.dist(anchor,actual[f]['feet'][side]) for f in range(interval['from'],interval['to']+1))
        assert error<1e-3,(interval,side,error)
        supports.append({**interval,'side':side,'maxWorldPinErrorPx':error})

rerenders=[]
for frame in [0,1,11,17,23,35,49]:
    scene.frame_set(frame);target=lab/('reopened-%03d.png'%frame)
    scene.render.filepath=str(target.resolve());bpy.ops.render.render(write_still=True)
    expected=Image.open(directory/frames[frame]['file']).convert('RGBA');actual_image=Image.open(target).convert('RGBA')
    assert ImageChops.difference(expected,actual_image).getbbox(alpha_only=False) is None
    rerenders.append({'frame':frame,'rgbaPixelsIdentical':True})

source=Image.open(directory/report['source']).convert('RGBA');reference=Image.new('RGBA',tuple(report['outputSize']))
reference.alpha_composite(source,tuple(report['sourceOffset']))
diff=ImageChops.difference(reference,Image.open(directory/frames[0]['file']).convert('RGBA'))
assert not diff.getchannel('A').getbbox()
source_rgb_error=max(high for low,high in diff.getextrema())
stopped_head=Image.open(directory/frames[41]['file']).convert('RGBA').crop((0,0,300,165))
for frame in range(42,50):
    head=Image.open(directory/frames[frame]['file']).convert('RGBA').crop((0,0,300,165))
    assert ImageChops.difference(stopped_head,head).getbbox(alpha_only=False) is None
assert max(abs(scale-1) for item in actual.values() for scale in item['headScale'])<1e-4
assert max(abs(item['boxWorldDegrees']) for item in actual.values())<3
assert abs(actual[49]['boxWorldDegrees'])<1e-3

# Pixel comparison uses opaque source sole pixels within each fixed support
# interval; this is a sampling diagnostic in addition to bone pinning.
sole_results=[]
for interval in spec['motion']['supportIntervals']:
    for side in interval['legs']:
        anchor=actual[interval['from']]['feet'][side]
        offset=report['sourceOffset']
        start=Image.open(directory/frames[interval['from']]['file']).convert('RGBA')
        box=(round(anchor[0]+offset[0]-29),round(anchor[1]+offset[1]+17),round(anchor[0]+offset[0]+8),round(anchor[1]+offset[1]+21)) if side=='R' else (round(anchor[0]+offset[0]-16),round(anchor[1]+offset[1]+13),round(anchor[0]+offset[0]+14),round(anchor[1]+offset[1]+20))
        first=start.crop(box);opaque=first.getchannel('A').point(lambda a:255 if a==255 else 0)
        max_pixel_error=0
        for frame in range(interval['from'],interval['to']+1):
            current=Image.open(directory/frames[frame]['file']).convert('RGBA').crop(box)
            d=ImageChops.difference(first,current)
            for channel in d.split():
                channel=ImageChops.multiply(channel,opaque)
                max_pixel_error=max(max_pixel_error,channel.getextrema()[1])
        sole_results.append({'side':side,'from':interval['from'],'to':interval['to'],'maxOpaqueSoleChannelError':max_pixel_error})

font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
bg,ink,quiet='#dce1d2','#263e32','#5c6d5a'
keys=[p for p in spec['poses'] if p['frame']>=1]
previews=[]
for index,frame in enumerate(range(1,50)):
    image=Image.open(directory/frames[frame]['file']).convert('RGBA')
    view=Image.new('RGB',(960,600),bg);draw=ImageDraw.Draw(view)
    current=next(p for p in reversed(keys) if p['frame']<=frame)
    draw.text((22,16),'负重动作检查 / 两次换步 → 停步',font=font,fill=ink)
    draw.text((22,47),current['label'],font=small,fill=quiet)
    draw.text((22,78),'完整人物 · 原图尺度',font=small,fill=quiet)
    view.paste(image,(22,105),image)
    draw.text((390,78),'握持与箱体 · 3× 跟随放大',font=small,fill=quiet)
    gx,gy=actual[frame]['grip'];gx=round(gx+report['sourceOffset'][0]);gy=round(gy+report['sourceOffset'][1])
    close=image.crop((gx-42,gy-68,gx+48,gy+70)).resize((270,414),Image.Resampling.NEAREST)
    view.paste(close,(390,106),close)
    draw.text((727,78),'约 104px 场景尺度',font=small,fill=quiet)
    tiny=image.resize((90,120),Image.Resampling.NEAREST);view.paste(tiny,(763,245),tiny)
    draw.text((727,390),'右手银箱 / 左手记录器',font=small,fill=quiet)
    draw.text((727,418),'同一朝向；动作小样',font=small,fill=quiet)
    draw.text((22,550),'本地骨架逐帧导出；衣褶尚未逐帧精修，未接正式首页。',font=small,fill=quiet)
    draw.line((22,580,938,580),fill='#b8c4ae',width=2)
    draw.line((22,580,22+round(916*(frame-1)/48),580),fill='#52724d',width=3)
    view.save(preview_dir/('%03d.png'%index));previews.append(view)
previews[22].save(directory/'actor-v03-motion-preview.png')
durations=[round((i+1)*1000/12)-round(i*1000/12) for i in range(49)]
previews[0].save(directory/'actor-v03-motion.webp',save_all=True,append_images=previews[1:],duration=durations,loop=1,lossless=True,method=4)
ffmpeg=shutil.which('ffmpeg')
if ffmpeg:
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate','12','-i',str(preview_dir/'%03d.png'),
        '-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(directory/'actor-v03-motion.mp4')],check=True)
sheet=Image.new('RGB',(900,910),bg);draw=ImageDraw.Draw(sheet)
for index,name in enumerate(['loaded_stand','passing_R','contact_R','passing_L','contact_L','stopped']):
    pose=next(p for p in keys if p['name']==name);x=index%3*300;y=index//3*450
    image=Image.open(directory/frames[pose['frame']]['file']).convert('RGBA')
    sheet.paste(image,(x,y+35),image);draw.text((x+20,y+8),pose['label'],font=font,fill=ink)
sheet.save(directory/'actor-v03-keyposes.png')
validation={'scope':'Saved rig, sampled output, support/grip consistency and local motion preview; art unapproved',
    'renderedFrames':50,'previewFrames':49,'previewFps':12,'packedTextures':len(textures),
    'maxReplayAnkleErrorPx':max_ankle_error,'maxGripAttachmentErrorPx':max_grip_error,
    'supportIntervals':supports,'soleSamplingDiagnostics':sole_results,'rerenders':rerenders,
    'sourceReferenceAlphaIdentical':True,'sourceReferenceMaxColorDifference':source_rgb_error,
    'stoppedHeadPixelsIdentical':True,'headScaleUnchanged':True,
    'boxMaxAbsWorldDegrees':max(abs(p['boxWorldDegrees']) for p in actual.values()),
    'boxFinalWorldDegrees':actual[49]['boxWorldDegrees'],
    'animationState':'Authored short motion candidate, not a validated reusable walk cycle',
    'poseRetouchApplied':False,'artApproved':False,'homepageIntegrated':False,'newPaidMediaRequests':0}
(directory/'actor-v03-motion-validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(directory/'actor-v03-evaluated-points.json').write_text(json.dumps(actual,indent=2)+'\n',encoding='utf-8')
print(json.dumps(validation,ensure_ascii=False))
