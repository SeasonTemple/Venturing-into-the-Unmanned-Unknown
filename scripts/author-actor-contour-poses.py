"""Author discrete complete-pose studies from explicit trouser contours.

This is source-cloth sampling on authored silhouettes plus pose-local paint,
not a new generative character, not planar IK, and not a finished walk cycle.
Upper-body/equipment artwork stays continuous under one rigid pose transform. Each
output has a full-canvas OpenRaster paint source for further editing.
"""
import argparse
import hashlib
import io
import json
import math
import zipfile
from types import SimpleNamespace
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, fromstring, tostring

from PIL import Image, ImageDraw
from actor_pose_review import write_review_sheet

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--recipe', type=Path, required=True)
parser.add_argument('--out-dir', type=Path, required=True)
parser.add_argument('--cloth-master', type=Path, help='Reimport a separately edited working-cloth.ora')
args = parser.parse_args()
recipe = json.loads(args.recipe.read_text(encoding='utf-8'))
OUT = args.out_dir.resolve()
if (OUT / 'authoring.json').exists():
    raise ValueError('Keep prior renders and paint edits intact; export into a new directory')
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / recipe['source']
original = Image.open(SOURCE).convert('RGBA')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == recipe['sourceSha256']
SIZE = tuple(recipe['canvas'])
OX, OY = recipe['sourceOffset']
SOURCE_LAYERS = ROOT / recipe['layerSource']
layers = {p.stem: Image.open(p).convert('RGBA') for p in SOURCE_LAYERS.glob('*.png')}

def new_layer():
    return Image.new('RGBA', SIZE)

def composite(stack):
    result = Image.new('RGBA', stack[0][1].size)
    for _, im in stack:
        result.alpha_composite(im)
    return result

def write_ora(path, stack):
    width, height = stack[0][1].size
    root = Element('image', {'w': str(width), 'h': str(height), 'version': '0.0.3'})
    tree = SubElement(root, 'stack')
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
        for index, (name, im) in reversed(list(enumerate(stack))):
            target = f'data/layer-{index:02}.png'
            data = io.BytesIO()
            im.save(data, format='PNG')
            archive.writestr(target, data.getvalue())
            SubElement(tree, 'layer', {'name': name, 'src': target, 'x': '0', 'y': '0',
                                      'opacity': '1', 'visibility': 'visible', 'composite-op': 'svg:src-over'})
        archive.writestr('stack.xml', tostring(root, encoding='utf-8'))
        data = io.BytesIO()
        composite(stack).save(data, format='PNG')
        archive.writestr('mergedimage.png', data.getvalue())

def read_cloth_master(path):
    with zipfile.ZipFile(path) as archive:
        root = fromstring(archive.read('stack.xml'))
        if (int(root.get('w')), int(root.get('h'))) != original.size:
            raise ValueError('Keep the shared cloth canvas at the original source size')
        tree = root.find('stack')
        if any(node.tag != 'layer' for node in tree):
            raise ValueError('Keep the three normal-blend layers flat')
        result = {}
        for node in tree:
            if (node.get('composite-op', 'svg:src-over') != 'svg:src-over'
                    or float(node.get('opacity', '1')) != 1
                    or node.get('visibility', 'visible') != 'visible'):
                raise ValueError('Keep layers visible at normal blend and full opacity')
            im = Image.new('RGBA', original.size)
            part = Image.open(io.BytesIO(archive.read(node.get('src')))).convert('RGBA')
            im.alpha_composite(part, (int(node.get('x', '0')), int(node.get('y', '0'))))
            result[node.get('name')] = im
        if set(result) != {'cloth_R', 'cloth_L', 'upper_reference'}:
            raise ValueError('Keep cloth_R, cloth_L, upper_reference layer names')
        if result['upper_reference'].tobytes() != foreground.tobytes():
            raise ValueError('This trial edits trousers and boots; preserve the upper reference')
        return {side: result['cloth_' + side] for side in ['R', 'L']}

def spline(nodes, y):
    # Explicit contour guides use a smooth centerline, not blended bone strips.
    for i in range(len(nodes) - 1):
        if nodes[i][0] <= y <= nodes[i+1][0]:
            y0, x0 = nodes[i]
            y1, x1 = nodes[i+1]
            t = (y-y0)/(y1-y0)
            left = nodes[max(0, i-1)]
            right = nodes[min(len(nodes)-1, i+2)]
            m0 = (x1-left[1])/(y1-left[0])
            m1 = (right[1]-x0)/(right[0]-y0)
            return ((2*t**3-3*t*t+1)*x0 + (t**3-2*t*t+t)*(y1-y0)*m0
                    + (-2*t**3+3*t*t)*x1 + (t**3-t*t)*(y1-y0)*m1)
    return nodes[0][1] if y < nodes[0][0] else nodes[-1][1]

def cloth_source(side):
    im = layers['leg_' + side].copy()
    # Reconstruct only the plausibly occluded trouser top behind the recorder.
    # The source equipment remains on top; the missing coverage is editable.
    if side == 'L':
        for y in range(180, 205):
            for x in range(94, 117):
                if im.getpixel((x, y))[3] == 0:
                    im.putpixel((x, y), original.getpixel((x, 205)))
        ImageDraw.Draw(im).rectangle((0, 180, 78, 207), fill=(0, 0, 0, 0))
    else:
        ImageDraw.Draw(im).rectangle((79, 180, 155, 207), fill=(0, 0, 0, 0))
    return im

def main_row_run(image, y):
    # An isolated opaque pixel in the source separation must not stretch an
    # entire scanline. Use the actual continuous cloth cross-section.
    runs = []
    start = None
    for x in range(image.width+1):
        opaque = x < image.width and image.getpixel((x, y))[3] > 0
        if opaque and start is None:
            start = x
        if not opaque and start is not None:
            runs.append((start, x-1))
            start = None
    return max(runs, key=lambda run: run[1]-run[0]) if runs else None

def draw_trouser(side, spec):
    src = cloth_by_side[side]
    result = new_layer()
    source_knee = 254 if side == 'R' else 260
    source_cuff = 314 if side == 'R' else 321
    hip_y = spec['center'][0][0]
    knee_y = spec['kneeY']
    cuff_y = spec['center'][-1][0]
    outline_mask = None
    if spec.get('outline'):
        outline_mask = Image.new('RGBA', original.size)
        ImageDraw.Draw(outline_mask).polygon([tuple(p) for p in spec['outline']], fill='white')
    for y in range(math.ceil(hip_y), math.floor(cuff_y)+1):
        if y <= knee_y:
            sy = 180 + (y-hip_y)/(knee_y-hip_y)*(source_knee-180)
        else:
            sy = source_knee + (y-knee_y)/(cuff_y-knee_y)*(source_cuff-source_knee)
        sy = round(sy)
        run = main_row_run(src, sy)
        if not run:
            continue
        lo, hi = run
        if outline_mask is not None:
            outline_run = main_row_run(outline_mask, y)
            if outline_run is None:
                continue
            left, right = outline_run
            width = right - left + 1
        else:
            cx = spline(spec['center'], y)
            width = (hi-lo+1)*spec.get('widthScale', 1)
            left = round(cx-width/2)
        for x in range(left, left+round(width)):
            sx = min(hi, max(lo, round(lo+(x-left)/max(1,width-1)*(hi-lo))))
            color = src.getpixel((sx, sy))
            if color[3]:
                result.putpixel((x+OX, y+OY), color)
    return result

def draw_boot(side, spec):
    src = cloth_by_side[side].copy()
    cut = 312 if side == 'R' else 319
    ImageDraw.Draw(src).rectangle((0, 0, src.width, cut-1), fill=(0, 0, 0, 0))
    source_ankle = [58, 319] if side == 'R' else [104, 328]
    target_x, target_y = spec['ankle']
    # Inverse rigid mapping around the source ankle; no separate shoe resize.
    angle = math.radians(spec.get('bootAngle', 0))
    c, s = math.cos(angle), math.sin(angle)
    tx, ty = target_x+OX, target_y+OY
    return src.transform(SIZE, Image.Transform.AFFINE,
        (c, s, source_ankle[0]-c*tx-s*ty,
         -s, c, source_ankle[1]+s*tx-c*ty), resample=Image.Resampling.NEAREST)

foreground = Image.new('RGBA', original.size)
for name in ['arm_R', 'arm_L', 'upper_body', 'toolbox_R', 'glove_R', 'recorder_L']:
    foreground.alpha_composite(layers[name])

if args.cloth_master and args.cloth_master.resolve() == OUT / 'working-cloth.ora':
    raise ValueError('Keep the edited input intact; export to a different directory')
cloth_by_side = read_cloth_master(args.cloth_master) if args.cloth_master else {
    side: cloth_source(side) for side in ['R', 'L']}
write_ora(OUT / 'working-cloth.ora', [
    ('cloth_R', cloth_by_side['R']), ('cloth_L', cloth_by_side['L']), ('upper_reference', foreground)])

if recipe.get('motion'):
    from actor_contour_motion import build_motion
    build_motion(recipe, OUT, SimpleNamespace(
        size=SIZE, offset=(OX, OY), original=original, layers=layers, cloth=cloth_by_side,
        new_layer=new_layer, composite=composite, write_ora=write_ora,
        row_run=main_row_run, spline=spline, draw_boot=draw_boot,
        source_sha256=recipe['sourceSha256'], recipe_path=args.recipe,
        cloth_input_path=args.cloth_master,
    ))
    raise SystemExit(0)

records = []
whole_body_art = None
if any(pose.get('bodyPose') for pose in recipe['poses']):
    from actor_whole_pose import WholePoseArt
    whole_body_art = WholePoseArt(layers, SIZE, (OX, OY))
    write_ora(OUT / 'working-upper.ora', [('hidden_jacket_coverage', whole_body_art.underpaint)]
              + [(name, whole_body_art.layers[name]) for name in ['arm_R', 'arm_L', 'upper_body', 'toolbox_R', 'glove_R', 'recorder_L']])
    (OUT / 'source-layer-preparation.json').write_text(json.dumps({
        'sourceAnchors': WholePoseArt.anchors,
        'ownershipTransfers': whole_body_art.ownership_transfers,
        'purpose': 'Correct source layer ownership before motion; source image unchanged.',
    }, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
for pose in recipe['poses']:
    dx, dy = pose['upperShift']
    angle = math.radians(pose.get('upperAngle', 0))
    c, s = math.cos(angle), math.sin(angle)
    # Head, neck, collar, hands and equipment share one rigid transform. Never
    # scale individual body parts to match a crop or to conceal a connection.
    tx, ty = 78+OX+dx, 178+OY+dy
    upper = foreground.transform(SIZE, Image.Transform.AFFINE,
        (c, s, 78-c*tx-s*ty, -s, c, 178+s*tx-c*ty),
        resample=Image.Resampling.NEAREST)
    stack = []
    shadow = new_layer()
    draw = ImageDraw.Draw(shadow)
    for x, y, width in pose['shadows']:
        draw.ellipse((x-width/2+OX, y-1+OY, x+width/2+OX, y+2+OY), fill='#828b69')
    stack.append(('ground_contact', shadow))
    for side in pose.get('legOrder', ['R', 'L']):
        stack.append(('trouser_'+side, draw_trouser(side, pose[side])))
        stack.append(('boot_'+side, draw_boot(side, pose[side])))
    actual_upper = None
    if pose.get('bodyPose'):
        upper_stack, actual_upper = whole_body_art.render(pose)
        stack.extend(upper_stack)
    else:
        stack.append(('original_upper_and_equipment', upper))
    paint = new_layer()
    draw = ImageDraw.Draw(paint)
    for op in pose.get('paint', []):
        draw.polygon([(x+OX, y+OY) for x,y in op['polygon']], fill=op['color'])
    stack.append(('pose_paint', paint))
    image = composite(stack)
    image.save(OUT / (pose['name']+'.png'))
    write_ora(OUT / (pose['name']+'.ora'), stack)
    records.append({'pose': pose['name'], 'label': pose['label'], 'support': pose.get('support', ''),
                    'legOrder': pose.get('legOrder', ['R', 'L']),
                    'upperArt': ('connected body surface and articulated occupied arms' if actual_upper
                                 else 'same source, one rigid transform'),
                    'upperPose': actual_upper,
                    'upperAngle': pose.get('upperAngle', 0), 'upperShift': pose['upperShift'],
                    'png': pose['name']+'.png', 'editable': pose['name']+'.ora',
                    'baseRgbaSha256': hashlib.sha256(image.tobytes()).hexdigest(),
                    'layerNames': [name for name, _ in stack], 'artApproved': False})

source_canvas = new_layer()
source_canvas.alpha_composite(original, (OX, OY))
source_canvas.save(OUT / 'source-reference.png')
review = write_review_sheet(OUT, source_canvas, recipe['poses'], SIZE, recipe.get('reviewColumns'))
(OUT/'authoring.json').write_text(json.dumps({
    'method': __doc__, 'recipeSha256': hashlib.sha256(args.recipe.read_bytes()).hexdigest(),
    'sourceSha256': recipe['sourceSha256'], 'poses': records, 'artApproved': False,
    'layerSourceSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE_LAYERS.glob('*.png')},
    'editedClothMaster': str(args.cloth_master) if args.cloth_master else None,
    'editedClothMasterSha256': hashlib.sha256(args.cloth_master.read_bytes()).hexdigest() if args.cloth_master else None,
    'status': 'static-pose-study; no animation produced',
    'editablePoseContract': 'full-canvas-normal-layers-v1',
    'canvas': SIZE, 'reviewSheet': review,
}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(str(OUT/'keyposes-review.png'))
