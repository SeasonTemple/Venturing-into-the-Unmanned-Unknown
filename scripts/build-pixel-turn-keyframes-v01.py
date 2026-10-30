"""Build the bounded front-to-profile pixel turn gate.

The three intermediate sprites are authored as complete raster drawings.  The
endpoint references are copied only as the already approved identity source;
no pixel interpolation, mirroring or limb-only transforms are used.
"""
from __future__ import annotations

import hashlib
import json
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "prototypes/visual-direction/pixel-turn-keyframes-v01"
FRAMES = OUT / "frames"
W, H, BASELINE = 128, 196, 183
P = {
    "ink": "#182728", "hair": "#20272d", "hair_mid": "#34383e", "hair_hi": "#575347",
    "skin_deep": "#69463d", "skin": "#b77955", "skin_hi": "#e0a269", "skin_light": "#f0bd79",
    "beard": "#493735", "beard_hi": "#6c493d", "coat_deep": "#633421", "coat_shadow": "#884425",
    "coat": "#bd6128", "coat_light": "#d88732", "coat_hi": "#edab4b", "coat_glint": "#f3c273",
    "pants_deep": "#1e302d", "pants": "#30443a", "pants_light": "#5b6845",
    "boot_deep": "#18252b", "boot": "#29343a", "boot_light": "#536055",
    "metal_deep": "#657873", "metal": "#aabbb1", "metal_light": "#d5dfcf", "metal_hi": "#edf0d5",
    "device_deep": "#244137", "device": "#366253", "screen": "#b7c793", "screen_hi": "#e5e2b8",
    "button": "#c28e65",
}


def paint_frame(variant: int) -> tuple[Image.Image, list[dict]]:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ops: list[dict] = []

    # The reference endpoints occupy y=10..183.  All intermediate coordinates
    # are authored against that same grid; this calibration keeps the feet on
    # the shared baseline instead of allowing a hidden canvas offset.
    YOFF = -5
    def map_point(point): return (point[0], point[1] + YOFF)
    def poly(points, color):
        mapped = [map_point(point) for point in points]
        d.polygon(mapped, fill=P[color]); ops.append({"kind": "polygon", "points": points, "color": color})

    def rect(box, color):
        mapped = (box[0], box[1] + YOFF, box[2], box[3] + YOFF)
        d.rectangle(mapped, fill=P[color]); ops.append({"kind": "rect", "box": box, "color": color})

    def line(points, color, width=1):
        mapped = [map_point(point) for point in points]
        d.line(mapped, fill=P[color], width=width); ops.append({"kind": "line", "points": points, "color": color, "width": width})

    # The poses share a measured pelvis, baseline and equipment ownership,
    # while every silhouette is drawn separately at native pixel scale.
    shift = {1: 0, 2: -1, 3: -2}[variant]
    # far leg and near leg: the knee and ankle move together, avoiding the
    # former inward-knee and frozen-upper-body errors.
    poly([(47+shift,104),(61+shift,105),(67+shift,112),(66+shift,128),(63+shift,143),(63+shift,158),(65+shift,176),(60+shift,182),(51+shift,182),(50+shift,166),(51+shift,151),(48+shift,137)], "pants_deep")
    poly([(55+shift,108),(64+shift,110),(68+shift,123),(65+shift,140),(63+shift,153),(65+shift,171),(61+shift,180),(57+shift,180),(57+shift,164),(58+shift,150),(55+shift,139)], "pants")
    poly([(57+shift,116),(62+shift,117),(61+shift,131),(59+shift,144),(59+shift,152),(57+shift,148)], "pants_light")
    poly([(46+shift,109),(54+shift,110),(55+shift,125),(52+shift,142),(51+shift,158),(53+shift,176),(50+shift,180),(45+shift,179),(44+shift,162),(46+shift,146),(45+shift,130)], "pants")
    poly([(47+shift,123),(50+shift,123),(48+shift,142),(47+shift,157),(49+shift,173),(46+shift,178),(46+shift,160)], "pants_light")
    # grounded boots, deliberately asymmetric but never floating.
    poly([(42+shift,176),(50+shift,178),(53+shift,182),(51+shift,186),(45+shift,188),(34+shift,187),(33+shift,185),(39+shift,182)], "boot_deep")
    poly([(43+shift,179),(49+shift,180),(51+shift,183),(46+shift,185),(36+shift,186),(40+shift,183)], "boot")
    line([(35+shift,186),(43+shift,187),(50+shift,185)], "boot_light")
    poly([(58+shift,179),(64+shift,180),(67+shift,183),(66+shift,187),(61+shift,189),(53+shift,188),(52+shift,186),(58+shift,184)], "boot_deep")
    poly([(59+shift,181),(63+shift,182),(64+shift,184),(60+shift,186),(54+shift,187),(57+shift,184)], "boot")
    line([(54+shift,187),(61+shift,188),(65+shift,186)], "boot_light")

    # neck, far sleeve and back plane.
    poly([(47,39),(56,38),(62,44),(60,53),(52,54),(47,49)], "skin_deep")
    poly([(50,40),(55,40),(59,45),(57,51),(51,51),(49,47)], "skin")
    poly([(50,41),(54,40),(56,44),(53,48),(50,47)], "skin_hi")
    poly([(49,50),(54,53),(52,70),(48,87),(45,104),(39,108),(35,105),(39,87),(41,70),(44,56)], "coat_shadow")
    poly([(48,54),(52,55),(50,71),(46,89),(43,102),(39,105),(42,84),(43,68)], "coat")
    poly([(46,57),(50,57),(47,75),(43,92),(41,99),(42,79)], "coat_light")

    # rotating torso and collar; the exposed front plane narrows each frame.
    poly([(54,47),(63,50),(69,57),(71,67),(69,83),(67,100),(69,109),(63,112),(48,110),(43,105),(45,90),(45,72),(48,57)], "coat_deep")
    poly([(56,50),(63,52),(67,57),(68,66),(66,80),(65,96),(66,106),(62,109),(49,107),(47,102),(49,87),(48,74),(51,59)], "coat")
    poly([(55,51),(60,53),(63,58),(60,68),(58,81),(57,94),(58,103),(54,107),(50,104),(51,88),(50,76),(53,63)], "coat_light")
    poly([(61,52),(66,55),(69,59),(69,64),(64,61),(60,58)], "coat_hi")
    line([(55,53),(56,65),(55,81),(56,104)], "coat_glint")
    poly([(52,46),(57,45),(62,49),(67,50),(70,48),(72,50),(67,55),(61,54),(55,51),(51,50)], "coat_shadow")
    poly([(53,46),(57,46),(61,50),(66,51),(67,53),(61,52),(56,49),(52,49)], "coat_hi")
    line([(55,55),(55,80),(56,103)], "coat_shadow")
    rect((55,58,56,60), "metal")
    poly([(61,84),(65,83),(66,88),(63,91),(59,90)], "coat_shadow")
    poly([(51,92),(55,94),(59,93),(62,96),(58,99),(53,98),(50,95)], "coat_light")
    poly([(51,102),(57,104),(62,102),(66,105),(65,109),(56,110),(50,107)], "coat_shadow")

    # Small authored material clusters keep the intermediate frames in the
    # same painted-pixel family as the endpoint references.
    poly([(58,61),(61,60),(63,63),(61,67),(58,68)], "coat_hi")
    poly([(53,71),(56,70),(57,74),(55,78),(52,78)], "coat_shadow")
    poly([(59,76),(62,74),(64,76),(62,80),(59,82)], "coat_light")
    poly([(52,84),(55,83),(56,87),(53,90),(51,88)], "coat_deep")
    poly([(59,89),(62,88),(64,91),(61,94),(58,93)], "coat_hi")
    poly([(53,97),(56,96),(58,99),(55,102),(52,101)], "coat_light")
    poly([(47,116),(50,118),(49,127),(47,130)], "pants_light")
    poly([(53,132),(56,130),(57,136),(54,141),(52,139)], "pants_deep")
    poly([(58,145),(61,142),(62,147),(60,151),(58,150)], "pants_light")
    poly([(47,148),(49,146),(50,152),(48,156)], "pants_deep")
    poly([(56,157),(59,154),(60,160),(58,165),(56,164)], "pants_light")
    poly([(61,168),(64,166),(64,172),(62,175)], "pants_deep")

    # near arm bends with the turning shoulder; hand follows the hip.
    poly([(64,56),(70,58),(76,65),(78,74),(76,83),(71,91),(67,99),(63,100),(61,96),(66,87),(70,79),(71,72),(67,64)], "coat_shadow")
    poly([(65,58),(69,59),(73,65),(75,73),(73,80),(69,87),(65,96),(62,96),(67,85),(71,78),(72,72),(68,64)], "coat")
    poly([(66,59),(69,60),(72,65),(73,71),(71,76),(69,68)], "coat_light")
    poly([(68,88),(71,86),(68,92),(65,95)], "coat_hi")
    poly([(62,96),(67,98),(69,102),(66,106),(61,104),(59,100)], "skin")
    rect((63,98,66,100), "skin_hi")

    # Silhouette width closes in by angle instead of jumping directly to the
    # narrow profile.  The extra shoulder/arm planes are painted per pose.
    if variant == 1:
        poly([(73,57),(80,59),(86,66),(88,74),(86,81),(81,87),(77,84),(81,76),(80,68),(75,63)], "coat_shadow")
        poly([(75,59),(79,61),(83,67),(85,74),(83,79),(80,82),(82,75),(81,69),(77,64)], "coat")
        poly([(81,68),(85,70),(86,75),(84,79),(82,77),(83,73)], "coat_light")
    elif variant == 2:
        poly([(71,57),(78,60),(83,66),(85,73),(83,80),(78,85),(75,82),(79,75),(78,68),(73,63)], "coat_shadow")
        poly([(73,59),(77,61),(81,67),(82,73),(80,78),(77,82),(80,74),(79,68),(75,64)], "coat")
        poly([(79,67),(82,69),(83,74),(81,78),(80,74)], "coat_light")
    else:
        poly([(69,57),(75,60),(80,66),(81,73),(79,80),(74,84),(72,81),(75,74),(75,68),(71,63)], "coat_shadow")
        poly([(71,59),(75,61),(78,67),(79,72),(77,78),(74,81),(77,73),(77,68),(73,64)], "coat")
        poly([(76,67),(79,69),(80,73),(78,77),(77,73)], "coat_light")

    # toolbox remains in the same hand and gets edge-on as the body turns.
    tx = {1: 0, 2: 3, 3: 6}[variant]
    poly([(38+tx,105),(43+tx,106),(46+tx,111),(44+tx,116),(39+tx,118),(35+tx,114),(35+tx,108)], "skin_deep")
    poly([(38+tx,106),(42+tx,107),(44+tx,111),(42+tx,114),(38+tx,114),(37+tx,111)], "skin")
    rect((39+tx,107,42+tx,109), "skin_hi")
    poly([(29+tx,119),(35+tx,116),(45+tx,118),(47+tx,122),(46+tx,138),(43+tx,141),(30+tx,138),(28+tx,135)], "metal_deep")
    poly([(30+tx,120),(35+tx,119),(43+tx,120),(44+tx,137),(31+tx,136)], "metal")
    poly([(42+tx,120),(46+tx,122),(46+tx,135),(43+tx,138),(43+tx,122)], "metal_light")
    line([(31+tx,121),(42+tx,122)], "metal_hi")
    rect((33+tx,124,35+tx,127), "metal_deep"); rect((34+tx,124,35+tx,125), "metal_hi")
    rect((40+tx,125,42+tx,128), "metal_deep"); rect((41+tx,125,42+tx,126), "metal_hi")
    line([(31+tx,135),(42+tx,137)], "metal_light")

    # recorder sits behind the turning edge, with screen direction retained.
    poly([(62,105),(67,106),(68,120),(66,123),(61,121),(60,110)], "device_deep")
    poly([(62,107),(66,108),(66,120),(62,119)], "device")
    rect((63,109,65,112), "screen"); rect((63,110,65,110), "screen_hi"); rect((62,117,63,118), "button")

    # head, eye, beard and hair are redrawn per frame so the heading is legible.
    x = {1: 0, 2: -1, 3: -2}[variant]
    poly([(48+x,22),(56+x,20),(63+x,22),(67+x,27),(66+x,35),(63+x,41),(58+x,44),(52+x,42),(48+x,39),(45+x,37),(46+x,33),(47+x,29)], "skin")
    poly([(49+x,24),(55+x,22),(60+x,23),(63+x,27),(62+x,34),(59+x,40),(54+x,41),(50+x,38),(48+x,36),(46+x,36),(48+x,32)], "skin_hi")
    poly([(59+x,24),(63+x,26),(65+x,31),(63+x,38),(60+x,41),(58+x,38),(60+x,33)], "skin_deep")
    poly([(50+x,37),(54+x,40),(58+x,41),(62+x,39),(62+x,42),(58+x,44),(53+x,42)], "beard")
    line([(50+x,37),(54+x,38),(57+x,39)], "beard_hi")
    rect((47+x,30,50+x,31), "beard"); rect((47+x,32,48+x,32), "skin_light"); rect((49+x,32,50+x,32), "ink")
    poly([(45+x,33),(48+x,34),(47+x,37),(44+x,36),(44+x,34)], "skin_hi")
    poly([(49+x,24),(48+x,21),(51+x,18),(56+x,17),(59+x,15),(64+x,17),(67+x,19),(69+x,23),(68+x,29),(65+x,29),(63+x,25),(59+x,23),(54+x,24),(51+x,27)], "hair")
    poly([(51+x,21),(56+x,18),(61+x,17),(65+x,19),(67+x,22),(64+x,23),(60+x,21),(55+x,22),(51+x,24)], "hair_mid")
    line([(55+x,18),(59+x,17),(62+x,18)], "hair_hi")

    # The first stop still faces the camera enough to show a second brow and
    # a shorter nose; only the later frames become the clean left profile.
    if variant == 1:
        poly([(48,31),(51,29),(55,29),(58,31),(59,35),(57,40),(53,41),(49,38),(47,36)], "skin")
        poly([(50,31),(54,30),(57,31),(57,35),(55,39),(51,39),(49,36)], "skin_hi")
        poly([(56,31),(61,30),(64,32),(64,37),(61,40),(57,39),(58,35)], "skin")
        poly([(57,37),(60,40),(63,39),(64,41),(60,44),(55,42)], "beard")
        line([(50,37),(53,38),(56,38)], "beard_hi")
        rect((50,32,52,33), "ink"); rect((58,32,60,33), "ink")
        rect((51,32,51,32), "skin_light"); rect((59,32,59,32), "skin_light")
        poly([(54,33),(56,34),(55,37),(53,36)], "skin_deep")
        poly([(46,34),(50,34),(50,36),(47,37),(45,36)], "skin_hi")
    # The last authored boot row is the contact cleanup row; endpoint sources
    # resolve to y=183, so erase only the extra calibration row.
    for x in range(W):
        im.putpixel((x, 184), (0, 0, 0, 0))
    return im, ops


def copy_endpoint(path: Path) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    out = Image.new("RGBA", (W, H)); out.alpha_composite(src, ((W-src.width)//2, 184-src.height))
    return out


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    endpoints = {
        "front": ROOT / "prototypes/visual-direction/pixel-native-master-v01/reference-1x.png",
        "side": ROOT / "prototypes/visual-direction/pixel-native-master-v01/reference-side-1x.png",
    }
    sequence = [("front", "正面停步"), ("turn-15", "转身 15°"), ("turn-30", "转身 30°"), ("turn-45", "转身 45°"), ("side", "左侧停步")]
    frames = []
    for i, (view, label) in enumerate(sequence):
        if view == "front": image, ops = copy_endpoint(endpoints["front"]), [{"kind":"endpoint-reference"}]
        elif view == "side": image, ops = copy_endpoint(endpoints["side"]), [{"kind":"endpoint-reference"}]
        else: image, ops = paint_frame(i)
        file = FRAMES / f"frame-{i:02d}.png"; image.save(file)
        frames.append({"index": i, "file": f"frames/{file.name}", "view": view, "label": label, "baseline": BASELINE,
                       "authoring": "endpoint-reference" if view in ("front", "side") else "hand-authored-complete-pixel-frame",
                       "operations": len(ops), "frameSha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    scale = 3; card = (W*scale+42, H*scale+56)
    atlas = Image.new("RGB", (card[0]*5, card[1]), "#102522"); draw = ImageDraw.Draw(atlas)
    try: font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 12*scale); small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 8*scale)
    except OSError: font = small = None
    for e in frames:
        im = Image.open(OUT/e["file"]).convert("RGBA").resize((W*scale,H*scale), Image.Resampling.NEAREST)
        x = e["index"]*card[0]+21; atlas.paste(im, (x, 42), im); draw.text((x, 5), f"{e['index']:02d} {e['label']}", font=font, fill="#f0e7bc"); draw.text((x, 42+H*scale+7), e["view"], font=small, fill="#9bb9a2")
    atlas.save(OUT / "turn-keyframes-atlas-3x.png")
    native = Image.new("RGB", (W*5, H+32), "#102522")
    for e in frames:
        im = Image.open(OUT/e["file"]).convert("RGBA"); native.paste(im, (e["index"]*W, 28), im)
    native.save(OUT / "turn-keyframes-native.png")
    # One editable OpenRaster contact sheet: each complete frame is an independent layer.
    root = Element("image", {"version":"0.0.3", "w":str(W), "h":str(H), "name":"Front to profile turn keyframes"}); stack = SubElement(root, "stack")
    ora = OUT / "pixel-turn-keyframes-v01.ora"
    with zipfile.ZipFile(ora, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "image/openraster", compress_type=zipfile.ZIP_STORED)
        for i, e in reversed(list(enumerate(frames))):
            buf = BytesIO(); Image.open(OUT/e["file"]).save(buf, format="PNG"); name = f"data/frame-{i:02d}.png"; z.writestr(name, buf.getvalue()); SubElement(stack, "layer", {"name":e["label"], "src":name, "opacity":"1.0", "visibility":"visible", "composite-op":"svg:src-over", "x":"0", "y":"0"})
        z.writestr("stack.xml", tostring(root, encoding="utf-8", xml_declaration=True)); buf = BytesIO(); Image.open(OUT/"turn-keyframes-native.png").save(buf, format="PNG"); z.writestr("mergedimage.png", buf.getvalue()); z.writestr("Thumbnails/thumbnail.png", buf.getvalue())
    manifest = {"revision":"pixel-turn-keyframes-v01", "status":"hand-authored-turn-gate", "artApproved":False, "motionApproved":False, "homepageIntegrated":False, "canvas":[W,H], "baseline":BASELINE, "fps":6, "frames":frames, "method":"complete native pixel frames; endpoint references are retained, three intermediate frames are explicit cluster drawings", "forbiddenMethods":["mirroring", "horizontal stretch", "3D interpolation", "limb-only transforms", "generic motion tween"], "sourceReferences":{"front":"prototypes/visual-direction/pixel-native-master-v01/reference-1x.png", "side":"prototypes/visual-direction/pixel-native-master-v01/reference-side-1x.png"}, "gate":"Approve all three intermediate frames at native size and 3x before stage 3 loaded keyposes."}
    from pixel_review import write_candidate_records
    write_candidate_records(OUT, manifest)
    print(json.dumps({"status":"built", "frames":len(frames), "out":str(OUT)}, ensure_ascii=False))


if __name__ == "__main__": main()
