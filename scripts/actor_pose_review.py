"""Review every authored still at source scale and scene scale."""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def write_review_sheet(out, source, poses, canvas, columns=None):
    font_path = Path('C:/Windows/Fonts/msyh.ttc')
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default(size=17)
    small = ImageFont.truetype(str(font_path), 13) if font_path.exists() else ImageFont.load_default(size=13)
    cards = [('source-reference', '原画身份参照', '比例、衣装与装备参照', source)]
    for pose in poses:
        name = pose.get('name', pose.get('pose'))
        cards.append((name, pose.get('label', name), pose.get('support', ''),
                      Image.open(out / (name + '.png')).convert('RGBA')))
    if len({card[0] for card in cards}) != len(cards):
        raise ValueError('Review pose IDs must be unique')
    cols = columns if columns is not None else (3 if len(cards) > 4 else len(cards))
    if not isinstance(cols, int) or cols < 1:
        raise ValueError('Review columns must be a positive integer')
    card_w, card_h = canvas[0], max(630, canvas[1] + 230)
    rows = math.ceil(len(cards) / cols)
    sheet = Image.new('RGB', (card_w * cols, card_h * rows), '#e1e5d7')
    draw = ImageDraw.Draw(sheet)
    for i, (_, title, subtitle, im) in enumerate(cards):
        if im.size != tuple(canvas):
            raise ValueError('Keep review poses on the same canvas')
        x, y = (i % cols) * card_w, (i // cols) * card_h
        draw.text((x + 16, y + 12), title, font=font, fill='#244238')
        draw.text((x + 16, y + 38), subtitle, font=small, fill='#536855')
        sheet.paste(im, (x, y + 58), im)
        # Scale the shared canvas uniformly; never normalize each pose's bounds.
        reduced = im.resize((round(canvas[0] * .3), round(canvas[1] * .3)), Image.Resampling.NEAREST)
        rx = x + (card_w - reduced.width) // 2
        sheet.paste(reduced, (rx, y + canvas[1] + 85), reduced)
        draw.line((x + 16, y + canvas[1] + 70, x + card_w - 16, y + canvas[1] + 70), fill='#c1cabb')
        draw.text((x + 16, y + canvas[1] + 78), '场景尺寸', font=small, fill='#536855')
    draw.text((16, rows * card_h - 20),
              '上：原尺寸完整人物  /  下：约 104px 人物高度  /  静态制作试验，动作尚未通过',
              font=small, fill='#536855')
    sheet.save(out / 'keyposes-review.png')
    return {'file': 'keyposes-review.png', 'poseIds': [card[0] for card in cards],
            'cardCount': len(cards), 'columns': cols, 'rows': rows}
