"""Whole-character FK device-lift study, saved keyposes before optional clip export.

No walking/retargeting. Grip assemblies follow their anatomical wrists. A short
gesture checks the edited shared character without freezing or raster warping it.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFont

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('stage',choices=['create','render'])
parser.add_argument('--source',type=Path)
parser.add_argument('--out-dir',required=True,type=Path)
args=parser.parse_args();out=args.out_dir.resolve()
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.context.preferences.filepaths.save_version=0


def update():bpy.context.view_layer.update()


def rotate(bone,axis,degrees):
    update()
    bone.matrix=Matrix.Translation(bone.head)@Matrix.Rotation(math.radians(degrees),4,axis)@bone.matrix.to_3x3().to_4x4()
    update()


def insert(rig,frame):
    for p in rig.pose.bones:
        for channel in ['location','rotation_quaternion','scale']:
            p.keyframe_insert(channel,frame=frame)


if args.stage=='create':
    if out.exists():raise ValueError('Use a new output directory')
    out.mkdir(parents=True)
    source=args.source.resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;scene.frame_set(1)
    rig=bpy.data.objects['Fieldworker_master_rig'];rig.animation_data_clear()
    rig.rotation_euler.z=0
    for p in rig.pose.bones:
        basis=p.matrix_basis.copy();p.rotation_mode='QUATERNION';p.matrix_basis=basis
    update()
    original={p.name:p.matrix_basis.copy() for p in rig.pose.bones}
    feet_before={s:list((rig.matrix_world@rig.pose.bones['foot.'+s].head)) for s in ['L','R']}
    scene.frame_start=1;scene.frame_end=33;scene.render.fps=12
    insert(rig,1);insert(rig,5)
    scene.frame_set(13)
    rotate(rig.pose.bones['shoulder01.L'],'X',-2)
    rotate(rig.pose.bones['upperarm01.L'],'X',-6)
    rotate(rig.pose.bones['lowerarm01.L'],'X',-55)
    rotate(rig.pose.bones['wrist.L'],'X',20)
    rotate(rig.pose.bones['head'],'Z',14)
    rotate(rig.pose.bones['head'],'X',10)
    insert(rig,13);insert(rig,17)
    for p in rig.pose.bones:p.matrix_basis=original[p.name]
    update();insert(rig,29);insert(rig,33)
    for curve in rig.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation='BEZIER'
            point.handle_left_type='AUTO_CLAMPED';point.handle_right_type='AUTO_CLAMPED'
    scene.frame_set(1);scene.render.filepath='//frames/0001.png'
    scene['study_status']='FK device lift and return, not walking or an approved story interaction.'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'device-gesture.blend'),compress=True)
    for frame,label in [(1,'rest'),(13,'raised')]:
        scene.frame_set(frame);scene.render.filepath=str(out/(label+'.png'));bpy.ops.render.render(write_still=True)
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',22)
    board=Image.new('RGB',(1000,760),'#e1e5d7');draw=ImageDraw.Draw(board)
    for i,(label,title) in enumerate([('rest','持物站立'),('raised','左臂提起设备 / 转头')]):
        sprite=Image.open(out/(label+'.png')).convert('RGBA').resize((480,672),Image.Resampling.NEAREST)
        board.paste(sprite,(i*500+10,60),sprite);draw.text((i*500+18,18),title,font=font,fill='#244238')
    board.save(out/'gesture-keyposes.png')
    (out/'study.json').write_text(json.dumps({'sourceBlend':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'frameCount':33,'fps':12,'keyFrames':[1,5,13,17,29,33],
        'scope':'Left device lift and return; feet and right case remain stationary. Not walking or reading.',
        'feetBefore':feet_before,'artApproved':False,'walkingApproved':False,'homepageIntegrated':False},indent=2)+'\n',encoding='utf-8')
else:
    bpy.ops.wm.open_mainfile(filepath=str(out/'device-gesture.blend'))
    scene=bpy.context.scene;rig=bpy.data.objects['Fieldworker_master_rig']
    (out/'frames').mkdir(exist_ok=True)
    scene.render.filepath=str(out/'frames')+'/'
    bpy.ops.render.render(animation=True)
    # Export a 3x nearest-neighbor visual preview with one fixed 256-color
    # palette for all frames, avoiding independent frame palette flicker.
    sprites=[Image.open(out/'frames'/f'{frame:04}.png').convert('RGBA') for frame in range(1,34)]
    frames=[]
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
    for sprite in sprites:
        canvas=Image.new('RGB',(480,720),'#e1e5d7')
        zoom=sprite.resize((480,672),Image.Resampling.NEAREST)
        canvas.paste(zoom,(0,38),zoom)
        ImageDraw.Draw(canvas).text((12,10),'提起记录器 → 停留 → 放回',font=font,fill='#244238')
        frames.append(canvas)
    palette_sheet=Image.new('RGB',(480*len(frames),720))
    for i,frame in enumerate(frames):palette_sheet.paste(frame,(480*i,0))
    palette=palette_sheet.quantize(colors=256,dither=Image.Dither.NONE)
    indexed=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in frames]
    indexed[0].save(out/'device-lift-preview.gif',save_all=True,append_images=indexed[1:],duration=83,loop=0,optimize=False,disposal=2)
    scene.frame_set(1);update()
    reference={s:(rig.matrix_world@rig.pose.bones['foot.'+s].head).copy() for s in ['L','R']}
    right=bpy.data.objects['RIGHT_silver_toolbox'].matrix_world.copy()
    movements=[]
    maximum_foot_error=0.;maximum_case_error=0.
    for frame in range(1,34):
        scene.frame_set(frame);update()
        maximum_foot_error=max(maximum_foot_error,max(((rig.matrix_world@rig.pose.bones['foot.'+s].head)-reference[s]).length for s in ['L','R']))
        maximum_case_error=max(maximum_case_error,(bpy.data.objects['RIGHT_silver_toolbox'].matrix_world.translation-right.translation).length)
        movements.append({'frame':frame,'leftWristWorld':list(rig.matrix_world@rig.pose.bones['wrist.L'].head)})
    assert maximum_foot_error<.00001
    assert maximum_case_error<.00001
    (out/'gesture-checks.json').write_text(json.dumps({'freshProcessReopen':True,'maximumFootMovementMeters':maximum_foot_error,
        'maximumRightCaseMovementMeters':maximum_case_error,'positions':movements,
        'validates':'Stationary support and unaffected right assembly only. Gesture naturalness judged from images.'},indent=2)+'\n',encoding='utf-8')
print('Completed gesture study:',args.stage,flush=True)
