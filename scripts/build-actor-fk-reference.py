"""Produce a source / calibrated target / deformed mesh FK comparison."""
import argparse
import json
import math
import subprocess
import sys
import numpy as np
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image, ImageDraw, ImageFont
from retarget_actor_fk import CalibratedFK

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--out-dir', type=Path, required=True)
parser.add_argument('--calibrate-floor', action='store_true')
parser.add_argument('--hands', choices=['source', 'relaxed'], default='source')
parser.add_argument('--foot-mode', choices=['source', 'relative'], default='source')
args = parser.parse_args()
out = args.out_dir.resolve()
if (out/'reference.json').exists():
    raise ValueError('Keep prior exports; choose a new directory')
(out/'frames').mkdir(parents=True, exist_ok=True)
source = json.loads((ROOT/'.lab/whole-walk/cmu-sampled/world-joints.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'prototypes/visual-direction/character-master-media/character-master-v02.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Fieldworker_master_rig']
rig.animation_data_clear()
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
for ob in scene.objects:
    if ob.name.startswith(('RIGHT_silver_toolbox', 'Toolbox_', 'LEFT_green_recorder', 'Recorder_')):
        ob.hide_render = True
fk = CalibratedFK(rig, source['frames'], hand_mode=args.hands, foot_mode=args.foot_mode)
indices = list(range(0, 240, 5))
records = []
for f, i in enumerate(indices, 1):
    scene.frame_set(f)
    record = fk.build(i)
    for pb in rig.pose.bones:
        pb.keyframe_insert('location', frame=f)
        pb.keyframe_insert('rotation_quaternion', frame=f)
        pb.keyframe_insert('scale', frame=f)
    rig.keyframe_insert('location', frame=f)
    records.append(record)

# ONE studio-floor placement for the whole take. Never move individual poses
# or solve a knee again to make a shoe touch the floor. Retain residuals.
boot = bpy.data.objects['Ankle_boots']
boot_ids = {s: [v.index for v in boot.data.vertices if (v.co.x < 0) == (s == 'R')] for s in ['R', 'L']}
heights = []
contact_samples = []
for f, r in enumerate(records, 1):
    scene.frame_set(f)
    evaluated = boot.evaluated_get(bpy.context.evaluated_depsgraph_get())
    floor = {s: min((evaluated.matrix_world@evaluated.data.vertices[n].co).z for n in ids) for s, ids in boot_ids.items()}
    r['soleHeightsBeforeFloorPlacement'] = floor
    heights.append(min(floor.values()))
    i = r['sourceFrame']-1
    for side in ['R', 'L']:
        name = side.lower()+'toes'
        before = Vector(source['frames'][max(0, i-2)]['joints'][name])
        after = Vector(source['frames'][min(len(source['frames'])-1, i+2)]['joints'][name])
        velocity = (after-before)*30*fk.scale
        if math.hypot(velocity.x, velocity.z) <= .3:
            point = min((evaluated.matrix_world@evaluated.data.vertices[n].co for n in boot_ids[side]), key=lambda v: v.z)
            contact_samples.append({'frame': f, 'side': side, 'point': list(point)})
floor_z = sorted(heights)[len(heights)//2]
calibration = {'method': 'Single height placement; no rotation', 'floorZ': floor_z}
if args.calibrate_floor:
    # A single rigid studio calibration, shared by the entire capture. Fit a
    # plane to low-speed stance soles, then rotate/translate the whole take.
    # No per-frame root correction or joint changes can enter through this.
    pts = np.array([r['point'] for r in contact_samples])
    design = np.column_stack([pts[:, 0], pts[:, 1], np.ones(len(pts))])
    a, b, c = np.linalg.lstsq(design, pts[:, 2], rcond=None)[0]
    normal = Vector((-float(a), -float(b), 1))
    rotation = normal.normalized().rotation_difference(Vector((0, 0, 1))).to_matrix()
    shift = Vector((0, 0, -float(c)/normal.length))
    transform = Matrix.Translation(shift)@rotation.to_4x4()
    parent = bpy.data.objects.new('Static_capture_to_studio_calibration', None)
    bpy.context.collection.objects.link(parent)
    parent.matrix_world = transform
    rig.parent = parent
    rig.matrix_parent_inverse = Matrix.Identity(4)
    residuals = (pts[:, 2]-design@np.array([a, b, c]))*1000
    calibration = {'method': 'One rigid transform for the complete capture; no per-frame adjustment',
                   'matrix': [list(row) for row in transform], 'planeBeforeRotation': [float(a), float(b), float(c)],
                   'contactSamples': len(contact_samples), 'fitRmsMm': float(np.sqrt(np.mean(residuals**2))),
                   'allJointAnglesUnchangedByCalibration': True}
    floor_z = 0.
    for f, r in enumerate(records, 1):
        scene.frame_set(f)
        r['joints'] = {n: list(transform@Vector(v)) for n, v in r['joints'].items()}
        r['sourceJoints'] = {n: list(transform@Vector(v)) for n, v in r['sourceJoints'].items()}
        for key in ['sourceKneeAxes', 'sourceElbowAxes']:
            r[key] = {n: list(rotation@Vector(v)) for n, v in r[key].items()}
        for hand in r['hands'].values():
            for key in ['palmDirection', 'thumbSide']:
                hand[key] = list(rotation@Vector(hand[key]))
            hand['fingerTip'] = list(transform@Vector(hand['fingerTip']))
        evaluated = boot.evaluated_get(bpy.context.evaluated_depsgraph_get())
        r['soleHeightsAfterCalibration'] = {s: min((evaluated.matrix_world@evaluated.data.vertices[n].co).z for n in ids) for s, ids in boot_ids.items()}
for r in records:
    r['soleClearanceFromFixedFloor'] = {s: z-floor_z for s, z in r.get('soleHeightsAfterCalibration', r['soleHeightsBeforeFloorPlacement']).items()}

# Neutral clay and a REAL fixed floor reveal surface collapse/contact instead
# of masking the silhouette with palette ramps or diagnostic circles.
clay = bpy.data.materials.new('Neutral_clay_FK_review')
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.43, .46, .43, 1)
bsdf.inputs['Roughness'].default_value = .85
for ob in scene.objects:
    if ob.type == 'MESH' and not ob.hide_render and ob.name != 'Short_hair':
        ob.data.materials.clear()
        ob.data.materials.append(clay)
        for face in ob.data.polygons:
            face.material_index = 0
            face.use_smooth = True
floor_material = bpy.data.materials.new('Fixed_studio_floor')
floor_material.use_nodes = True
floor_material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.57, .61, .55, 1)
floor_material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, floor_z))
bpy.context.object.name = 'Fixed_floor_not_a_contact_constraint'
bpy.context.object.data.materials.append(floor_material)
light_data = bpy.data.lights.new('Studio_key', 'AREA')
light_data.energy = 300
light_data.shape = 'DISK'
light_data.size = 4
light = bpy.data.objects.new(light_data.name, light_data)
bpy.context.collection.objects.link(light)
light.location = (-3, -4, 6)
light.rotation_euler = (Vector((0, 1, 0))-light.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.seed = 0
scene.cycles.use_denoising = True
scene.render.resolution_x = 180
scene.render.resolution_y = 240
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filter_size = .01
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = len(indices)
scene.camera.animation_data_clear()
scene.camera.data.ortho_scale = 2.05
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 13)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 11)
edges_source = [('root', 'lowerback'), ('lowerback', 'upperback'), ('upperback', 'thorax'), ('thorax', 'lowerneck'), ('lowerneck', 'upperneck'), ('upperneck', 'head')]
for s in ['r', 'l']:
    edges_source += [('root', s+'hipjoint'), (s+'hipjoint', s+'femur'), (s+'femur', s+'tibia'), (s+'tibia', s+'foot'), (s+'foot', s+'toes'), ('thorax', s+'clavicle'), (s+'clavicle', s+'humerus'), (s+'humerus', s+'wrist'), (s+'wrist', s+'hand')]
edges_target = [('root', 'spine05'), ('spine05', 'spine03'), ('spine03', 'spine01'), ('spine01', 'neck01'), ('neck01', 'head')]
for s in ['R', 'L']:
    edges_target += [('root', 'upperleg01.'+s), ('upperleg01.'+s, 'lowerleg01.'+s), ('lowerleg01.'+s, 'foot.'+s), ('foot.'+s, 'toe1-1.'+s), ('spine01', 'upperarm01.'+s), ('upperarm01.'+s, 'lowerarm01.'+s), ('lowerarm01.'+s, 'wrist.'+s)]


def panel(r, kind):
    page = Image.new('RGB', (180, 280), '#e1e5d7')
    draw = ImageDraw.Draw(page)
    def xy(value):
        p = world_to_camera_view(scene, scene.camera, Vector(value))
        return p.x*180, 24+(1-p.y)*240
    centre = Vector(r['joints']['root'])
    for x in [-.4, -.2, 0, .2, .4]:
        draw.line([xy((centre.x+x, centre.y-1, floor_z)), xy((centre.x+x, centre.y+1, floor_z))], fill='#bdc8b7')
    for y in [-1, -.5, 0, .5, 1]:
        draw.line([xy((centre.x-.5, centre.y+y, floor_z)), xy((centre.x+.5, centre.y+y, floor_z))], fill='#bdc8b7')
    positions = r['sourceJoints'] if kind == 'source' else r['joints']
    edges = edges_source if kind == 'source' else edges_target
    for a, b in edges:
        if a not in positions or b not in positions:
            continue
        color = '#b76b39' if (a.startswith('r') if kind == 'source' else a.endswith('.R')) else '#376a60'
        draw.line([xy(positions[a]), xy(positions[b])], fill=color, width=3)
    for a in set(n for e in edges for n in e):
        if a in positions:
            x, y = xy(positions[a]); draw.ellipse((x-2, y-2, x+2, y+2), fill='#263f38')
    return page


atlas = Image.new('RGB', (8*540, 6*280), '#e1e5d7')
for f, r in enumerate(records, 1):
    scene.frame_set(f)
    centre = Vector(r['joints']['root'])
    target = Vector((centre.x, centre.y, .93+floor_z))
    scene.camera.location = Vector((2.7, -3.5, 2.25+floor_z))+Vector((centre.x, centre.y, 0))
    scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.keyframe_insert('location', frame=f)
    scene.camera.keyframe_insert('rotation_euler', frame=f)
    scene.render.filepath = str(out/'frames'/f'clay-{f-1:03}.png')
    bpy.ops.render.render(write_still=True)
    panels = [panel(r, 'source'), panel(r, 'target'), Image.new('RGB', (180, 280), '#e1e5d7')]
    image = Image.open(out/'frames'/f'clay-{f-1:03}.png').convert('RGB')
    panels[2].paste(image, (0, 24))
    combined = Image.new('RGB', (540, 280), '#e1e5d7')
    for col, (im, title) in enumerate(zip(panels, ['原始骨架', '目标骨架', '实际模型'])):
        d = ImageDraw.Draw(im); d.text((8, 4), title, font=font, fill='#244238')
        if col < 2:
            key = 'sourceKnee' if col == 0 else 'targetKnee'
            values = [0. if abs(r['angles'][s][key]) < .05 else r['angles'][s][key] for s in ['R', 'L']]
            d.text((6, 264), f'膝 R {values[0]:.1f}° / L {values[1]:.1f}°', font=small, fill='#244238')
        else:
            clearance = min(r['soleClearanceFromFixedFloor'].values())*1000
            d.text((6, 264), f'最低鞋底距固定地面 {clearance:+.0f}mm', font=small, fill='#244238')
        combined.paste(im, (180*col, 0))
    combined.save(out/'frames'/f'{f-1:03}.png')
    atlas.paste(combined, (((f-1)%8)*540, ((f-1)//8)*280))
atlas.save(out/'reference-atlas.webp', lossless=True)
sheet = Image.new('RGB', (1080, 4*300), '#e1e5d7')
for row, idx in enumerate([0, 6, 12, 18]):
    im = Image.open(out/'frames'/f'{idx:03}.png').resize((1080, 560), Image.Resampling.NEAREST)
    # Four separate keyposes stay readable in a compact native-size sheet.
    small_im = im.resize((540, 280), Image.Resampling.NEAREST)
    sheet.paste(small_im, (0, row*300+20))
    ImageDraw.Draw(sheet).text((8, row*300), f'导出帧 {idx+1}', font=font, fill='#244238')
    # True side view from saved FK pose, not a mirrored image.
    scene.frame_set(idx+1)
    centre = Vector(records[idx]['joints']['root'])
    camera = scene.camera.copy(); camera.data = scene.camera.data.copy(); camera.animation_data_clear()
    bpy.context.collection.objects.link(camera); original_camera = scene.camera; scene.camera = camera
    camera.location = Vector((centre.x-4, centre.y, 1.6+floor_z))
    camera.rotation_euler = (Vector((centre.x, centre.y, .93+floor_z))-camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.resolution_x = 360; scene.render.resolution_y = 480
    scene.render.filepath = str(out/'frames'/f'side-{idx:03}.png'); bpy.ops.render.render(write_still=True)
    side = Image.open(out/'frames'/f'side-{idx:03}.png').resize((210, 280), Image.Resampling.LANCZOS)
    sheet.paste(side, (600, row*300+20))
    scene.render.resolution_x = 180; scene.render.resolution_y = 240
    scene.camera = original_camera; bpy.data.objects.remove(camera, do_unlink=True)
sheet.save(out/'keypose-review.png')
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'motion-reference.blend'), compress=True)
errors = {kind: max(abs(r['angles'][s]['target'+kind]-r['angles'][s]['source'+kind]) for r in records for s in ['R', 'L']) for kind in ['Knee', 'Elbow']}
assert max(errors.values()) < .01, errors
clearances = [min(r['soleClearanceFromFixedFloor'].values())*1000 for r in records]
doc = {'method': 'Calibrated anatomical FK; no pose-by-pose ground correction, mass fitting, IK or occupied-arm edits.',
       'source': source['source'], 'sourceFps': 120, 'fps': 24, 'cell': [540, 280], 'columns': 8,
       'frames': records, 'sourceScale': fk.scale, 'fixedFloorZ': floor_z,
       'studioCalibration': calibration,
       'handMode': args.hands,
       'footMode': args.foot_mode,
       'handPoseSource': 'Authored neutral palm and relaxed finger pose, with captured forearm pronation retained and distributed through the forearm.' if args.hands == 'relaxed' else 'Direct hand/thumb helper-point frame; target fingers in rest pose.',
       'maxAngleErrorsDegrees': errors, 'lowestSoleClearanceRangeMm': [min(clearances), max(clearances)],
       'artApproved': False, 'walkingApproved': False, 'loadedMotionProvided': False, 'productionIntegrated': False,
       'limitations': ['Unladen source. No toolbox or recorder action.', 'Fixed-floor contact residuals are exposed, not corrected.', 'Finite capture; no start, turn, stop or seamless loop.', 'Proxy face, clothes and style are not the approved character art.']}
(out/'reference.json').write_text(json.dumps(doc, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-framerate', '24', '-i', str(out/'frames/%03d.png'), '-vf', 'scale=1080:560:flags=neighbor', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out/'motion-reference.mp4')], check=True)
print(json.dumps({'out': str(out), 'angleErrors': errors, 'fixedFloorClearanceMm': doc['lowestSoleClearanceRangeMm']}, ensure_ascii=False))
