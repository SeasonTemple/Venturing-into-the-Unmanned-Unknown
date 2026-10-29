"""Render palm and dorsal close views of a real held-device keypose."""
import argparse
import json
from pathlib import Path

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
args = parser.parse_args()
out = args.directory.resolve()
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=str(out/'inspect-gesture.blend'))
scene = bpy.context.scene
scene.frame_set(11)
bpy.context.view_layer.update()
camera = scene.camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = .36
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
bar = bpy.data.objects['Recorder_grip_bar'].matrix_world.translation
body = bpy.data.objects['LEFT_green_recorder'].matrix_world.translation
target = (bar+body)*.5
views = [('palm', '掌侧 / 实体屏幕', Vector((-.46, -.26, 1.64))),
         ('dorsal', '手背 / 背部握杆', target+Vector((.48, -.62, .12)))]
positions = []
for name, label, position in views:
    camera.location = position
    camera.rotation_euler = (target-position).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out/('grip-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
    positions.append({'name': name, 'camera': list(position), 'target': list(target)})
board = Image.new('RGB', (1060, 600), '#e1e5d7')
draw = ImageDraw.Draw(board)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 21)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
for i, (name, label, _) in enumerate(views):
    picture = Image.open(out/('grip-'+name+'.png')).convert('RGBA')
    board.paste(picture, (i*530+9, 45), picture)
    draw.text((i*530+16, 12), label+'（检查镜头）', font=font, fill='#244238')
draw.text((16, 572), '同一帧、同一手与机体；仅改变检查相机。设备全程固定在手中，无独立翻转。', font=small, fill='#536855')
board.save(out/'grip-contact-review.png')
(out/'grip-review-cameras.json').write_text(json.dumps({'frame': 11, 'views': positions,
    'scope': 'Diagnostic cameras only; primary scene camera and saved source unchanged.'}, indent=2)+'\n', encoding='utf-8')
print('Rendered actual palm and dorsal grip close views.')
