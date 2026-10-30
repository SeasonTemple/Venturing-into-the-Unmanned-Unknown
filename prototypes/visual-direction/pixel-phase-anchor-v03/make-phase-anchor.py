"""Rebuild one native pixel phase candidate from the approved source layers.

This is a static authoring study. It does not create an animation, use a
generator, or claim that a rigid segment transform is a finished walk frame.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'prototypes/visual-direction/actor-keypose-art/source-layers'
OUT = Path(__file__).resolve().parent
W, H = 156, 348
layers = {p.stem: Image.open(p).convert('RGBA') for p in SRC.glob('*.png')}

upper = Image.new('RGBA', (W, H))
for name in ['pelvis', 'upper_body', 'arm_R', 'arm_L', 'toolbox_R', 'glove_R', 'recorder_L']:
    upper.alpha_composite(layers[name])

support = layers['leg_R'].copy()
swing = layers['leg_L'].copy()
upper_leg = Image.new('RGBA', (W, H))
lower_leg = Image.new('RGBA', (W, H))
for y in range(H):
    for x in range(W):
        pixel = swing.getpixel((x, y))
        if not pixel[3]:
            continue
        if y <= 264:
            upper_leg.putpixel((x, y), pixel)
        if y >= 250:
            lower_leg.putpixel((x, y), pixel)

# Both arms and carried objects stay in one group. The two-pixel lead is the
# authored body response to the planted right foot, not an independent head
# or chest animation.
upper_pose = Image.new('RGBA', (W, H))
upper_pose.alpha_composite(upper, (-2, -1))

# A restrained passing phase: bend around the visible knee, raise the shoe,
# and keep the source pixels on a nearest-neighbour grid.
turned_lower = lower_leg.rotate(14, resample=Image.Resampling.NEAREST,
                                center=(93, 258), expand=False)
raised_lower = Image.new('RGBA', (W, H))
raised_lower.alpha_composite(turned_lower, (-1, -7))
turned_upper = Image.new('RGBA', (W, H))
turned_upper.alpha_composite(upper_leg, (-2, -1))

result = Image.new('RGBA', (W, H))
for name in ['pelvis', 'upper_body']:
    result.alpha_composite(layers[name], (-2, -1))
result.alpha_composite(support)
result.alpha_composite(turned_upper)
result.alpha_composite(raised_lower)
for name in ['arm_R', 'arm_L', 'toolbox_R', 'glove_R', 'recorder_L']:
    result.alpha_composite(layers[name], (-2, -1))

# Three source-colour pixels close the authored knee overlap. This is a small
# local paint correction, not a rectangular body replacement.
draw = ImageDraw.Draw(result)
for point, colour in [
    ((88, 256), (31, 49, 47, 255)),
    ((89, 257), (47, 67, 55, 255)),
    ((90, 258), (63, 82, 60, 255)),
]:
    draw.point(point, fill=colour)

result.save(OUT / 'phase-anchor.png')

def preview(background):
    canvas = Image.new('RGBA', (W, H), background)
    canvas.alpha_composite(result)
    return canvas

dark = preview((25, 46, 41, 255))
light = preview((226, 217, 187, 255))
contact = Image.new('RGB', (W * 2, H))
contact.paste(dark.convert('RGB'), (0, 0))
contact.paste(light.convert('RGB'), (W, 0))
contact.resize((W * 8, H * 8), Image.Resampling.NEAREST).save(OUT / 'phase-anchor-diagnostic.png')

original = Image.open(ROOT / 'prototypes/visual-direction/art-pack-media/actor-front.png').convert('RGBA')
reference = preview((25, 46, 41, 255))
source = Image.new('RGBA', (W, H), (25, 46, 41, 255))
source.alpha_composite(original)
comparison = Image.new('RGB', (W * 2, H))
comparison.paste(source.convert('RGB'), (0, 0))
comparison.paste(reference.convert('RGB'), (W, 0))
comparison.resize((W * 8, H * 8), Image.Resampling.NEAREST).save(OUT / 'comparison.png')
