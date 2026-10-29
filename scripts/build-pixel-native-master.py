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
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'prototypes/visual-direction/art-pack-media/actor-front.png'
OUT = ROOT / 'prototypes/visual-direction/pixel-native-master-v01'
SCALE = 4

LAYERS = {
    'head_face_hair': [(31, 0), (57, 0), (60, 35), (30, 35)],
    'coat_torso': [(23, 29), (61, 29), (69, 101), (23, 107)],
    'arm_carrying_toolbox': [(8, 39), (34, 38), (36, 105), (8, 105)],
    'arm_recorder_side': [(53, 35), (75, 36), (75, 101), (49, 101)],
    'toolbox': [(0, 72), (25, 72), (26, 119), (0, 119)],
    'recorder': [(47, 70), (69, 70), (69, 119), (47, 119)],
    'pelvis': [(25, 96), (62, 96), (63, 123), (24, 123)],
    'leg_image_left': [(23, 112), (45, 112), (45, 168), (22, 168)],
    'leg_image_right': [(41, 109), (64, 109), (65, 170), (40, 170)],
    'shoes_and_contact': [(19, 158), (67, 158), (68, 174), (17, 174)],
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
    OUT.mkdir(parents=True, exist_ok=True)
    if any(OUT.iterdir()):
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

    source_layers: list[tuple[str, Image.Image, str]] = [('identity_lock', scaled, 'visible')]
    colors = ['#d66d3c', '#3b7167', '#caa758', '#b86a4a', '#7c9a69', '#738a77', '#bf6b3f', '#5d7c67', '#b9a26b', '#d5cba7']
    layer_map = scaled.copy(); draw = ImageDraw.Draw(layer_map, 'RGBA')
    for index, (name, polygon) in enumerate(LAYERS.items()):
        scaled_polygon = [(x * SCALE, y * SCALE) for x, y in polygon]
        source_layers.append((name, rgba_layer(scaled, scaled_polygon), 'visible'))
        color = colors[index % len(colors)]
        draw.line(scaled_polygon + [scaled_polygon[0]], fill=color + 'cc', width=2 * SCALE, joint='curve')
    for name, (x, y) in ANCHORS.items():
        draw.ellipse(((x*SCALE-2*SCALE, y*SCALE-2*SCALE), (x*SCALE+2*SCALE, y*SCALE+2*SCALE)), fill='#223c34', outline='#f5e9bc', width=SCALE)
    layer_map.save(OUT / 'layer-map-4x.png')
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
        'layerNames': ['identity_lock', *LAYERS.keys()],
        'anchorPixels': ANCHORS,
        'method': 'pixel-native layered master with a visible locked identity underlay; no hidden anatomy invented',
        'limitations': [
            'Masks are working boundaries and require manual contour cleanup before motion.',
            'The underlay remains necessary because hidden anatomy has not been authored.',
            'No transforms, interpolation, walk frames or homepage integration are included.',
        ],
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

if __name__ == '__main__':
    main()
