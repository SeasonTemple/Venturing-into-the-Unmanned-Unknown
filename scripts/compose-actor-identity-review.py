"""Compare the selected illustration and two source renders at full-body height.

Only the illustration is resampled to body height. Source renders use an exact
2x nearest-neighbor scale; this is identity review, not matched-camera tracing.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path)
out = parser.parse_args().directory.resolve()
root = Path(__file__).resolve().parents[1]
study = json.loads((out/'study.json').read_text(encoding='utf-8'))
reference = Image.open(root/study['identityReference']).convert('RGBA')
reference.save(out/'reference-original.png')
reference = reference.crop(reference.getbbox())
old = Image.open(out/'before-front-quarter.png').convert('RGBA')
new = Image.open(out/'front-quarter.png').convert('RGBA')
height = (new.getbbox()[3]-new.getbbox()[1])*2
reference = reference.resize((round(reference.width*height/reference.height), height), Image.Resampling.NEAREST)
board = Image.new('RGB', (1050, 660), '#e1e5d7')
draw = ImageDraw.Draw(board)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 20)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
for i, (sprite, title) in enumerate([(reference, '原画身份参照（仅等高）'),
                                    (old, '上一版：衣装修订后'),
                                    (new, '本轮：屈肘持物与光照色块')]):
    if i:
        sprite = sprite.resize((320, 448), Image.Resampling.NEAREST)
    bounds = sprite.getbbox()
    board.paste(sprite, (i*350+(350-sprite.width)//2, 510-bounds[3]), sprite)
    draw.text((i*350+12, 22), title, font=font, fill='#244238')
draw.text((20, 550), '源模型修改：下颌 / 发型 / 裤腿 / 屈肘握持 / 直接光照映射', font=font, fill='#244238')
draw.text((20, 588), '模型使用同一相机；原画只作身份参照，镜头和姿态未精确复刻。', font=small, fill='#536855')
draw.text((20, 616), '像素画风仍在验收；新旧模型均为原生输出的2倍整数放大。', font=small, fill='#536855')
board.save(out/'identity-comparison.png')
print('Saved identity comparison:', out/'identity-comparison.png')
