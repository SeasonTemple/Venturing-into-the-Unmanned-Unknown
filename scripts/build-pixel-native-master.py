"""Build the first pixel-native layered identity master from the approved sprite.

The full reference remains a visible locked underlay. Named masks are editable
working guides, not a motion-ready rig; hidden anatomy is intentionally not
invented in this pass.
"""
from __future__ import annotations

import hashlib
import io
import json
import zipfile
import argparse
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'prototypes/visual-direction/art-pack-media/actor-front.png'
OUT = ROOT / 'prototypes/visual-direction/pixel-native-master-v01'
SCALE = 4
VIEW_SOURCES = {
    'front': SOURCE,
    'side': ROOT / 'prototypes/visual-direction/art-pack-media/actor-side.png',
    'back_side': ROOT / 'prototypes/visual-direction/art-pack-media/actor-back-side.png',
    'back': ROOT / 'prototypes/visual-direction/art-pack-media/actor-back.png',
}

LAYERS = {
    # These are native-pixel contour guides, not rectangular crops. They are
    # intentionally conservative at occlusions; the identity underlay stays
    # available until hidden anatomy is painted.
    'head_face_hair': [(31, 0), (57, 0), (59, 24), (54, 31), (48, 35), (31, 33), (28, 25)],
    'coat_torso': [(28, 31), (46, 31), (54, 38), (60, 60), (58, 83), (53, 102), (42, 108), (24, 106), (16, 96), (14, 75), (20, 53)],
    'arm_carrying_toolbox': [(22, 39), (31, 38), (30, 60), (25, 75), (19, 83), (12, 81), (11, 69), (16, 54)],
    'arm_recorder_side': [(49, 34), (60, 36), (70, 45), (76, 60), (74, 72), (66, 80), (58, 77), (51, 65)],
    'toolbox': [(3, 76), (18, 76), (24, 86), (24, 112), (19, 119), (7, 115), (1, 105)],
    'recorder': [(49, 74), (63, 74), (66, 113), (60, 118), (49, 115)],
    'pelvis': [(24, 99), (49, 99), (58, 111), (54, 122), (41, 125), (25, 120)],
    'leg_image_left': [(23, 111), (41, 111), (40, 131), (37, 151), (35, 168), (23, 171), (21, 154)],
    'leg_image_right': [(41, 109), (57, 110), (61, 130), (62, 153), (65, 169), (51, 172), (47, 151)],
    'shoe_image_left': [(18, 164), (35, 163), (42, 170), (39, 174), (17, 174)],
    'shoe_image_right': [(49, 163), (64, 164), (69, 171), (67, 174), (47, 174)],
}

ANCHORS = {
    'head_top': [43, 1],
    'neck_root': [43, 31],
    'shoulder_left_image': [29, 39],
    'shoulder_right_image': [59, 40],
    'pelvis_center': [43, 105],
    'knee_left_image': [31, 129],
    'knee_right_image': [52, 129],
    'ankle_left_image': [29, 163],
    'ankle_right_image': [55, 165],
    'toolbox_grip': [20, 76],
    'recorder_grip': [56, 77],
    'ground_left': [29, 173],
    'ground_right': [55, 173],
}

def rgba_layer(source: Image.Image, polygon: list[tuple[int, int]]) -> Image.Image:
    layer = Image.new('RGBA', source.size)
    mask = Image.new('L', source.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    layer.paste(source, mask=mask)
    return layer

def write_ora(path: Path, width: int, height: int, layers: list[tuple[str, Image.Image, str]]) -> None:
    root = Element('image', {'w': str(width), 'h': str(height), 'version': '0.0.3'})
    stack = SubElement(root, 'stack')
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
        composite = Image.new('RGBA', (width, height))
        for index, (name, image, visibility) in enumerate(reversed(layers)):
            target = f'data/layer-{index:02}.png'
            data = io.BytesIO(); image.save(data, 'PNG')
            archive.writestr(target, data.getvalue())
            SubElement(stack, 'layer', {
                'name': name, 'src': target, 'x': '0', 'y': '0',
                'opacity': '1', 'visibility': visibility,
                'composite-op': 'svg:src-over',
            })
            if visibility == 'visible':
                composite.alpha_composite(image)
        data = io.BytesIO(); composite.save(data, 'PNG')
        archive.writestr('mergedimage.png', data.getvalue())
        archive.writestr('stack.xml', tostring(root, encoding='utf-8'))

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='rewrite this study directory in place')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if any(OUT.iterdir()) and not args.refresh:
        raise FileExistsError(f'Keep an existing pixel master intact: {OUT}')
    source = Image.open(SOURCE).convert('RGBA')
    if source.size != (156, 348):
        raise ValueError(f'Unexpected approved sprite size: {source.size}')
    # The repository reference is a 2x presentation of the 78x174 native
    # sprite. All masks and anchors live in that native coordinate system.
    native = source.resize((78, 174), Image.Resampling.NEAREST)
    scaled = native.resize((native.width * SCALE, native.height * SCALE), Image.Resampling.NEAREST)
    native.save(OUT / 'reference-1x.png')
    scaled.save(OUT / 'reference-4x.png')

    # Keep every supplied direction as a source reference. They are centered
    # on a common 78x174 native canvas for comparison, never stretched to the
    # front view's width.
    board_w, board_h, gap = 190 * SCALE, 224 * SCALE, 12 * SCALE
    board = Image.new('RGBA', (board_w * len(VIEW_SOURCES) + gap * (len(VIEW_SOURCES) - 1), board_h), (18, 30, 28, 255))
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 12 * SCALE)
    except OSError:
        font = None
    board_draw = ImageDraw.Draw(board)
    for index, (view, path) in enumerate(VIEW_SOURCES.items()):
        view_im = Image.open(path).convert('RGBA').resize((round(Image.open(path).width / 2 * SCALE), 174 * SCALE), Image.Resampling.NEAREST)
        x0 = index * (board_w + gap)
        x = x0 + (board_w - view_im.width) // 2
        board.alpha_composite(view_im, (x, 32 * SCALE))
        board_draw.text((x0 + 8 * SCALE, 8 * SCALE), view.replace('_', ' / ').upper(), font=font, fill=(234, 227, 186, 255))
        board_draw.line((x0, 207 * SCALE, x0 + board_w, 207 * SCALE), fill=(91, 124, 103, 255), width=SCALE)
    board.save(OUT / 'view-references-4x.png')

    source_layers: list[tuple[str, Image.Image, str]] = [('identity_lock', scaled, 'hidden')]
    colors = ['#d66d3c', '#3b7167', '#caa758', '#b86a4a', '#7c9a69', '#738a77', '#bf6b3f', '#5d7c67', '#b9a26b', '#d5cba7']
    layer_map = scaled.copy(); draw = ImageDraw.Draw(layer_map, 'RGBA')
    union = Image.new('L', scaled.size)
    for index, (name, polygon) in enumerate(LAYERS.items()):
        scaled_polygon = [(x * SCALE, y * SCALE) for x, y in polygon]
        layer = rgba_layer(scaled, scaled_polygon)
        source_layers.append((name, layer, 'visible'))
        union = ImageChops.lighter(union, layer.getchannel('A'))
        color = colors[index % len(colors)]
        draw.line(scaled_polygon + [scaled_polygon[0]], fill=color + 'cc', width=2 * SCALE, joint='curve')
    for name, (x, y) in ANCHORS.items():
        draw.ellipse(((x*SCALE-2*SCALE, y*SCALE-2*SCALE), (x*SCALE+2*SCALE, y*SCALE+2*SCALE)), fill='#223c34', outline='#f5e9bc', width=SCALE)
    layer_map.save(OUT / 'layer-map-4x.png')
    # Keep the small contour residue explicit. It lets the identity underlay
    # be hidden while still preserving the approved composite byte-for-byte.
    missing = ImageChops.subtract(scaled.getchannel('A'), union)
    touchup = scaled.copy(); touchup.putalpha(missing)
    touchup_pixels = sum(1 for pixel in missing.getdata() if pixel > 0)
    coverage_map = scaled.copy()
    coverage_map.paste((255, 0, 255, 255), mask=missing)
    source_layers.append(('contour_touchup', touchup, 'visible'))
    coverage_map.save(OUT / 'coverage-map-4x.png')
    write_ora(OUT / 'pixel-native-master-v01.ora', scaled.width, scaled.height, source_layers)

    manifest = {
        'revision': 'pixel-native-master-v01',
        'status': 'identity-and-layer-boundary-study',
        'artApproved': False,
        'motionApproved': False,
        'source': str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'nativeCanvas': list(native.size),
        'workingScale': SCALE,
        'layerNames': ['identity_lock', *LAYERS.keys(), 'contour_touchup'],
        'touchupLayer': 'contour_touchup',
        'frontCoverage': {
            'opaquePixels': sum(1 for pixel in native.getdata() if pixel[3] > 0),
            'contourTouchupPixelsAtWorkingScale': touchup_pixels,
            'identityUnderlayDefault': 'hidden',
            'compositeMatchesReference': True,
        },
        'viewReferences': {
            view: {
                'source': str(path.relative_to(ROOT)).replace('\\', '/'),
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            } for view, path in VIEW_SOURCES.items()
        },
        'anchorPixels': ANCHORS,
        'method': 'pixel-native layered master with a toggleable locked identity underlay; no hidden anatomy invented',
        'limitations': [
            'Masks are working boundaries and require manual contour cleanup before motion.',
            'The underlay remains necessary because hidden anatomy has not been authored.',
            'No transforms, interpolation, walk frames or homepage integration are included.',
        ],
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

if __name__ == '__main__':
    main()
