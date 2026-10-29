"""Bake a complete held-recorder inspection gesture and export actual frames.

The palm supports an actual rear grip; forearm, hand and recorder turn together.
No independent recorder rotation in the closed fist. Not a walk.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('stage', choices=['create', 'render', 'package'])
parser.add_argument('--source', type=Path)
parser.add_argument('--out-dir', required=True, type=Path)
args = parser.parse_args()
out = args.out_dir.resolve()
ROOT = Path(__file__).resolve().parents[1]
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.context.preferences.filepaths.save_version = 0


def update():
    bpy.context.view_layer.update()


def eased(a):
    a = min(1, max(0, a))
    return a*a*(3-2*a)


def amount(frame):
    if frame <= 4:
        return 0
    if frame <= 11:
        return eased((frame-4)/7)
    if frame <= 16:
        return 1
    return 1-eased((frame-16)/7)


def board(directory):
    result = Image.new('RGB', (1500, 540), '#e1e5d7')
    draw = ImageDraw.Draw(result)
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 20)
    for i, (frame, label) in enumerate([(1, '背握携带'), (7, '屈肘转掌'), (11, '掌侧查看'),
                                      (16, '查看停留'), (20, '放回'), (25, '回到原姿态')]):
        sprite = Image.open(directory/'frames'/f'{frame:04}.png').convert('RGBA')
        sprite = sprite.resize((320, 448), Image.Resampling.NEAREST)
        # Transparent margins only are cropped; all visible body pixels kept.
        sprite = sprite.crop((40, 0, 280, 448))
        result.paste(sprite, (i*250+5, 55), sprite)
        draw.text((i*250+12, 15), label, font=font, fill='#244238')
    draw.text((16, 508), '同一母版真实关节动作 · 25帧 / 12fps · 原生画布160×224 · 未接入首页', font=font, fill='#536855')
    result.save(directory/'gesture-filmstrip.png')


if args.stage == 'create':
    if out.exists():
        raise ValueError('Use a new directory')
    source = args.source.resolve()
    source_study = json.loads((source.parent/'study.json').read_text(encoding='utf-8'))
    if source_study.get('gripDesign', {}).get('type') != 'rear-bar':
        raise ValueError('Inspection requires a palm-side rear grip; old top-carry source is retired.')
    out.mkdir(parents=True)
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    scene.frame_set(1)
    rig = bpy.data.objects['Fieldworker_master_rig']
    rig.animation_data_clear()
    rig.rotation_euler.z = 0
    for p in rig.pose.bones:
        matrix = p.matrix_basis.copy()
        p.rotation_mode = 'QUATERNION'
        p.matrix_basis = matrix
    update()
    baseline = {p.name: p.matrix_basis.copy() for p in rig.pose.bones}
    gear_baseline = {o.name: o.matrix_basis.copy() for o in scene.objects
                     if o.parent == rig and o.parent_type == 'BONE' and o.parent_bone == 'wrist.L'}
    base_wrist = rig.pose.bones['wrist.L'].head.copy()
    base_wrist_rotation = rig.pose.bones['wrist.L'].matrix.to_quaternion()
    index = rig.pose.bones['finger2-1.L'].head
    little = rig.pose.bones['finger5-1.L'].head
    base_palm = ((index+little)*.5-base_wrist).normalized()
    base_normal = base_palm.cross((index-little).normalized()).normalized()
    twist_records = []
    scene.frame_start = 1
    scene.frame_end = 25
    scene.render.fps = 12
    for frame in range(1, 26):
        scene.frame_set(frame)
        for p in rig.pose.bones:
            p.matrix_basis = baseline[p.name]
        for name, matrix in gear_baseline.items():
            bpy.data.objects[name].matrix_basis = matrix
        a = amount(frame)
        torso = rig.pose.bones['spine02']
        torso.matrix_basis = baseline['spine02'] @ Matrix.Rotation(math.radians(1.5*a), 4, 'X')
        update()
        names = ['upperarm01.L', 'upperarm02.L', 'lowerarm01.L', 'lowerarm02.L']
        old = {n: rig.pose.bones[n].matrix.copy() for n in names}
        # The initial palm normal in the same slightly responding torso pose.
        before_wrist = rig.pose.bones['wrist.L'].head
        before_index = rig.pose.bones['finger2-1.L'].head
        before_little = rig.pose.bones['finger5-1.L'].head
        before_palm = ((before_index+before_little)*.5-before_wrist).normalized()
        before_normal = before_palm.cross((before_index-before_little).normalized()).normalized()
        shoulder = rig.pose.bones['upperarm01.L'].head.copy()
        wrist = base_wrist.lerp(Vector((.18, -.31, 1.275)), a)
        u = sum(rig.pose.bones[n].length for n in names[:2])
        l = sum(rig.pose.bones[n].length for n in names[2:])
        direction = (wrist-shoulder).normalized()
        d = (wrist-shoulder).length
        along = (u*u-l*l+d*d)/(2*d)
        pole = Vector((.62, -.01, 1.19)).lerp(Vector((.52, -.02, 1.10)), a)-shoulder
        pole = (pole-direction*pole.dot(direction)).normalized()
        elbow = shoulder+along*direction+math.sqrt(max(0, u*u-along*along))*pole
        for chain, start, end in [(names[:2], shoulder, elbow), (names[2:], elbow, wrist)]:
            axis = (end-start).normalized()
            offset = 0
            for name in chain:
                p = rig.pose.bones[name]
                original = old[name].to_3x3()
                delta = original.col[1].normalized().rotation_difference(axis).to_matrix()
                p.matrix = Matrix.Translation(start+offset*axis) @ (delta @ original).to_4x4()
                offset += p.length
                update()
        # Both the palm longitudinal direction and its anatomical side matter.
        # Merely aligning wrist/finger direction left the previous palm reversed.
        target_palm = (wrist-elbow).normalized()
        palm = base_palm.slerp(target_palm, a).normalized()
        swing = base_palm.rotation_difference(palm)
        transported_normal = swing @ base_normal
        eye = rig.pose.bones['head'].head
        towards_eye = (eye-wrist).normalized()
        desired_normal = (towards_eye-palm*towards_eye.dot(palm)).normalized()
        roll = a*math.atan2(palm.dot(transported_normal.cross(desired_normal)),
                            transported_normal.dot(desired_normal))
        palm_turn = Quaternion(palm, roll) @ swing
        final_normal = palm_turn @ base_normal
        rotation = palm_turn @ base_wrist_rotation
        # Pronation/supination belongs in the forearm. Carry its axial rotation
        # through both forearm deform bones, ending at the wrist orientation.
        prior_axis = old['lowerarm01.L'].to_3x3().col[1].normalized()
        carried_normal = prior_axis.rotation_difference(target_palm) @ before_normal
        carried_normal = (carried_normal-target_palm*carried_normal.dot(target_palm)).normalized()
        roll_target = (final_normal-target_palm*final_normal.dot(target_palm)).normalized()
        twist = math.atan2(target_palm.dot(carried_normal.cross(roll_target)),
                           carried_normal.dot(roll_target))
        aligned_lower = {name: rig.pose.bones[name].matrix.copy() for name in names[2:]}
        for name, fraction in [('lowerarm01.L', .45), ('lowerarm02.L', 1.0)]:
            matrix = aligned_lower[name]
            rig.pose.bones[name].matrix = (Matrix.Translation(matrix.translation)
                @ Quaternion(target_palm, twist*fraction).to_matrix().to_4x4()
                @ matrix.to_3x3().to_4x4())
            update()
        rig.pose.bones['wrist.L'].matrix = Matrix.Translation(wrist) @ rotation.to_matrix().to_4x4()
        update()
        # Gear has no animation channels. Its full transform is fixed in hand
        # space throughout the shot, including the actual display and mounts.
        twist_records.append({'frame': frame, 'forearmAxialTurnDegrees': math.degrees(twist)})
        head = rig.pose.bones['head']
        head.matrix = (Matrix.Translation(head.head) @ Matrix.Rotation(math.radians(35*a), 4, 'X')
                       @ Matrix.Rotation(math.radians(23*a), 4, 'Z') @ head.matrix.to_3x3().to_4x4())
        update()
        for p in rig.pose.bones:
            for channel in ['location', 'rotation_quaternion', 'scale']:
                p.keyframe_insert(channel, frame=frame)
    # Every output time has an authored pose; no hidden IK or later resampling.
    for ob in [rig] + [o for o in scene.objects if o.parent_type == 'BONE' and o.parent == rig]:
        if ob.animation_data and ob.animation_data.action:
            for curve in ob.animation_data.action.fcurves:
                for k in curve.keyframe_points:
                    k.interpolation = 'LINEAR'
    scene.frame_set(1)
    scene.render.filepath = '//frames/0001.png'
    scene['study_status'] = 'Held recorder inspection candidate; not walking or user-approved art.'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'inspect-gesture.blend'), compress=True)
    (out/'frames').mkdir()
    for frame in [1, 11]:
        scene.frame_set(frame)
        scene.render.filepath = str(out/'frames'/f'{frame:04}.png')
        bpy.ops.render.render(write_still=True)
    preview = Image.new('RGB', (1000, 760), '#e1e5d7')
    draw = ImageDraw.Draw(preview)
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 22)
    for i, (frame, text) in enumerate([(1, '背握携带 / 屏幕朝内'), (11, '前臂转掌 / 掌侧查看')]):
        sprite = Image.open(out/'frames'/f'{frame:04}.png').convert('RGBA').resize((480, 672), Image.Resampling.NEAREST)
        preview.paste(sprite, (i*500+10, 60), sprite)
        draw.text((i*500+18, 18), text, font=font, fill='#244238')
    preview.save(out/'gesture-keyposes.png')
    (out/'study.json').write_text(json.dumps({'sourceBlend': str(source),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'frameCount': 25, 'fps': 12,
        'scope': 'Rear grip: forearm and palm carry fixed recorder toward face, pause and lower. No independent device turn.',
        'forearmTwist': twist_records, 'gripDesign': 'fixed-palm-side-rear-grip',
        'continuousExportVerified': False, 'artApproved': False, 'walkingApproved': False,
        'homepageIntegrated': False, 'paidGenerationCalls': 0}, indent=2)+'\n', encoding='utf-8')
else:
    bpy.ops.wm.open_mainfile(filepath=str(out/'inspect-gesture.blend'))
    scene = bpy.context.scene
    if args.stage == 'render':
        scene.render.filepath = str(out/'frames')+'/'
        bpy.ops.render.render(animation=True)
    rig = bpy.data.objects['Fieldworker_master_rig']
    scene.frame_set(1)
    update()
    baseline = {s: rig.matrix_world @ rig.pose.bones['foot.'+s].head for s in ['L', 'R']}
    reference_bar = ((rig.matrix_world @ rig.pose.bones['wrist.L'].matrix).inverted()
                     @ bpy.data.objects['Recorder_grip_bar'].matrix_world.translation)
    reference_gear = {o.name: (rig.matrix_world @ rig.pose.bones['wrist.L'].matrix).inverted() @ o.matrix_world
                      for o in scene.objects if o.parent == rig and o.parent_type == 'BONE'
                      and o.parent_bone == 'wrist.L'}
    maximum_foot = 0
    maximum_grip = 0
    screen_dots = []
    wrist_angles = []
    maximum_rigid_drift = 0
    palm_screen_dots = []
    housing_palm_offsets = []
    first_bones = {p.name: p.matrix.copy() for p in rig.pose.bones}
    first_gear = {o.name: o.matrix_world.copy() for o in scene.objects
                  if o.parent == rig and o.parent_type == 'BONE' and o.parent_bone == 'wrist.L'}
    for frame in range(1, 26):
        scene.frame_set(frame)
        update()
        maximum_foot = max(maximum_foot, max(((rig.matrix_world @ rig.pose.bones['foot.'+s].head)-baseline[s]).length for s in baseline))
        bar = ((rig.matrix_world @ rig.pose.bones['wrist.L'].matrix).inverted()
               @ bpy.data.objects['Recorder_grip_bar'].matrix_world.translation)
        maximum_grip = max(maximum_grip, (bar-reference_bar).length)
        forearm = (rig.pose.bones['wrist.L'].head-rig.pose.bones['lowerarm01.L'].head).normalized()
        palm = (rig.pose.bones['metacarpal2.L'].tail-rig.pose.bones['wrist.L'].head).normalized()
        wrist_angles.append(math.degrees(forearm.angle(palm)))
        wrist_inverse = (rig.matrix_world @ rig.pose.bones['wrist.L'].matrix).inverted()
        for name, reference in reference_gear.items():
            relative = wrist_inverse @ bpy.data.objects[name].matrix_world
            maximum_rigid_drift = max(maximum_rigid_drift,
                max(abs(relative[i][j]-reference[i][j]) for i in range(4) for j in range(4)))
        wrist_pos = rig.pose.bones['wrist.L'].head
        index = rig.pose.bones['finger2-1.L'].head
        little = rig.pose.bones['finger5-1.L'].head
        palm_long = ((index+little)*.5-wrist_pos).normalized()
        palm_normal = (rig.matrix_world.to_3x3() @ palm_long.cross((index-little).normalized())).normalized()
        normal = bpy.data.objects['Recorder_physical_screen'].matrix_world.to_3x3().col[0].normalized()
        palm_screen_dots.append(palm_normal.dot(normal))
        housing_palm_offsets.append(palm_normal.dot(bpy.data.objects['LEFT_green_recorder'].matrix_world.translation
                                                     -bpy.data.objects['Recorder_grip_bar'].matrix_world.translation))
        if 11 <= frame <= 16:
            screen = bpy.data.objects['Recorder_physical_screen']
            normal = screen.matrix_world.to_3x3().col[0].normalized()
            eye = rig.matrix_world @ rig.pose.bones['head'].head
            screen_dots.append(normal.dot((eye-screen.matrix_world.translation).normalized()))
    bone_return = max(abs(p.matrix[i][j]-first_bones[p.name][i][j])
                      for p in rig.pose.bones for i in range(4) for j in range(4))
    gear_return = max(abs(bpy.data.objects[n].matrix_world[i][j]-m[i][j])
                      for n, m in first_gear.items() for i in range(4) for j in range(4))
    checks = {'freshProcessReopen': True, 'maxFootMovementMeters': maximum_foot,
              'maxGripCenterWristLocalDriftMeters': maximum_grip,
              'minimumDisplayFacingHeadDotDuringHold': min(screen_dots),
              'palmForearmAngleDegreesRange': [min(wrist_angles), max(wrist_angles)],
              'fullBodyReturnMatrixMaxDelta': bone_return,
              'completeRecorderReturnMatrixMaxDelta': gear_return,
              'maxRigidDeviceWristRelativeMatrixDrift': maximum_rigid_drift,
              'minimumPalmAndScreenNormalDot': min(palm_screen_dots),
              'minimumHousingOnPalmSideMeters': min(housing_palm_offsets),
              'noIndependentDeviceAnimation': all(not bpy.data.objects[n].animation_data
                 or not bpy.data.objects[n].animation_data.action for n in reference_gear),
              'sourceBlendUnchanged': True, 'artApproved': False,
              'scope': 'Support, full rigid grip, anatomical palm side and display facing. Does not certify natural motion.'}
    study = json.loads((out/'study.json').read_text(encoding='utf-8'))
    checks['sourceBlendUnchanged'] = hashlib.sha256(Path(study['sourceBlend']).read_bytes()).hexdigest() == study['sourceSha256']
    (out/'gesture-checks.json').write_text(json.dumps(checks, indent=2)+'\n', encoding='utf-8')
    assert maximum_foot < 1e-5 and maximum_grip < 1e-5 and min(screen_dots) > .5
    assert bone_return < 1e-5 and gear_return < 1e-5
    assert maximum_rigid_drift < 1e-5 and min(palm_screen_dots) > .99
    assert min(housing_palm_offsets) > .04 and checks['noIndependentDeviceAnimation']
    assert checks['sourceBlendUnchanged']
    sprites = [Image.open(out/'frames'/f'{frame:04}.png').convert('RGBA') for frame in range(1, 26)]
    zooms = []
    for sprite in sprites:
        canvas = Image.new('RGB', (480, 672), '#e1e5d7')
        sprite = sprite.resize((480, 672), Image.Resampling.NEAREST)
        canvas.paste(sprite, (0, 0), sprite)
        zooms.append(canvas)
    sheet = Image.new('RGB', (480*25, 672))
    for i, im in enumerate(zooms):
        sheet.paste(im, (480*i, 0))
    palette = sheet.quantize(colors=256, dither=Image.Dither.NONE)
    indexed = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in zooms]
    # GIF timing is in 10ms ticks. Alternate 80/90ms rather than truncating
    # every 83ms frame to 80ms and inadvertently playing at 12.5fps.
    durations = [round((i+1)*100/12)*10-round(i*100/12)*10 for i in range(25)]
    indexed[0].save(out/'inspect-preview.gif', save_all=True, append_images=indexed[1:], duration=durations,
                    loop=0, optimize=False, disposal=2)
    # Native scene pixels, using the identical existing plate and footprint.
    plate = Image.open(ROOT/'prototypes/visual-direction/meadow-media/walk-plate-v01.webp').convert('RGBA')
    parent_study = json.loads((Path(study['sourceBlend']).parent/'study.json').read_text(encoding='utf-8'))
    anchor = parent_study['frames'][0]['anchor']
    paste = (round(1120-anchor[0]), round(887-anchor[1]))
    shadow = Image.new('RGBA', plate.size)
    ImageDraw.Draw(shadow).ellipse((1101, 884, 1145, 892), fill=(26, 49, 39, 60))
    plate.alpha_composite(shadow)
    scenes = []
    for sprite in sprites:
        frame = plate.copy()
        frame.alpha_composite(sprite, paste)
        scenes.append(frame.crop((860, 500, 1460, 940)).convert('RGB'))
    scene_sheet = Image.new('RGB', (600*25, 440))
    for i, im in enumerate(scenes):
        scene_sheet.paste(im, (600*i, 0))
    scene_palette = scene_sheet.quantize(colors=256, dither=Image.Dither.NONE)
    scene_frames = [im.quantize(palette=scene_palette, dither=Image.Dither.NONE) for im in scenes]
    scene_frames[0].save(out/'scene-inspect-preview.gif', save_all=True, append_images=scene_frames[1:],
                         duration=durations, loop=0, optimize=False, disposal=2)
    board(out)
    all_frames = Image.new('RGB', (800, 1240), '#e1e5d7')
    draw = ImageDraw.Draw(all_frames)
    label_font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 14)
    for i, sprite in enumerate(sprites):
        x, y = (i % 5)*160, (i // 5)*248
        all_frames.paste(sprite, (x, y+24), sprite)
        draw.text((x+8, y+3), f'{i+1:02d} / 25', font=label_font, fill='#244238')
    all_frames.save(out/'all-frames-review.png')
    study['continuousExportVerified'] = True
    study['renderedFrames'] = list(range(1, 26))
    (out/'study.json').write_text(json.dumps(study, indent=2)+'\n', encoding='utf-8')
print('Completed inspection gesture:', args.stage, flush=True)
