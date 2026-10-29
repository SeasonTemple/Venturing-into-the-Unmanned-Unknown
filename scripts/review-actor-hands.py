"""Render complete forearm/palm/finger close-ups from the saved evaluated rig."""
import argparse
import json
from pathlib import Path
import bpy
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, required=True)
args = parser.parse_args()
folder = args.source_dir.resolve()
out = folder/'hand-review'
out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(folder/'motion-reference.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Fieldworker_master_rig']
original = scene.camera
camera = original.copy()
camera.data = original.data.copy()
camera.animation_data_clear()
bpy.context.collection.objects.link(camera)
scene.camera = camera
camera.data.ortho_scale = .42
scene.render.resolution_x = 480
scene.render.resolution_y = 480
scene.cycles.samples = 48
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
sheet = Image.new('RGB', (960, 3*520), '#e1e5d7')
measurements = []
for row, frame in enumerate([1, 7, 48]):
    scene.frame_set(frame)
    for col, side in enumerate(['R', 'L']):
        p = rig.pose.bones
        wrist = rig.matrix_world@p['wrist.'+side].head
        elbow = rig.matrix_world@p['lowerarm01.'+side].head
        middle = rig.matrix_world@p['finger3-1.'+side].head
        # Place the near-side view to show thumb, palm and relaxed fingers;
        # include the cuff/forearm instead of framing a detached hand alone.
        target = wrist+(middle-wrist)*.35
        direction = Vector((-2.5 if side == 'R' else 2.5, -3.5, 1.5)).normalized()
        camera.location = target+direction*3
        camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
        path = out/f'hand-{frame:02}-{side}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        im = Image.open(path).convert('RGB')
        sheet.paste(im, (col*480, row*520+40))
        d = ImageDraw.Draw(sheet)
        d.text((col*480+12, row*520+10), f'第 {frame} 帧 · {"右手" if side == "R" else "左手"} · 前臂 / 袖口 / 掌指', font=font, fill='#244238')
sheet.save(out/'hand-contact-sheet.png')
print(out/'hand-contact-sheet.png')
