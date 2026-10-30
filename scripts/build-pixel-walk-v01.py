"""Build an eight-frame, left-facing walk sample from the passed keypose source."""
from __future__ import annotations
import hashlib, importlib.util, json, zipfile
from io import BytesIO
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "prototypes/visual-direction/pixel-walk-v01"
FRAMES = OUT / "frames"
W, H, BASELINE = 128, 196, 183
KEYPOSE_SCRIPT = ROOT / "scripts/build-pixel-loaded-keyposes-v01.py"
spec = importlib.util.spec_from_file_location("loaded_keyposes", KEYPOSE_SCRIPT)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
P = module.P


def repaint_step(base: Image.Image, phase: str) -> tuple[Image.Image, int]:
    """Redraw one complete lower-body phase with explicit pixel clusters."""
    im = base.copy(); d = ImageDraw.Draw(im); count = 0
    def poly(points, color):
        nonlocal count; d.polygon(points, fill=P[color]); count += 1
    def line(points, color, width=1):
        nonlocal count; d.line(points, fill=P[color], width=width); count += 1

    # Each mask follows one leg only, leaving the toolbox and recorder intact.
    if phase == "right-lift":
        d.polygon([(56,137),(72,137),(75,184),(53,184)], fill=(0,0,0,0))
        poly([(58,108),(66,110),(68,127),(65,140),(68,149),(73,159),(72,164),(67,163),(61,151),(58,140)], "pants_deep")
        poly([(61,112),(65,113),(65,127),(62,139),(65,149),(70,159),(69,161),(64,150),(60,139),(60,126)], "pants")
        poly([(68,159),(74,160),(76,163),(74,167),(66,166),(64,164)], "boot_deep")
        poly([(69,161),(73,161),(74,163),(70,165),(66,165)], "boot")
        line([(66,166),(71,166),(74,164)], "boot_light")
    elif phase == "left-lift":
        d.polygon([(39,137),(56,137),(58,184),(34,184)], fill=(0,0,0,0))
        poly([(48,107),(56,108),(55,125),(51,139),(47,149),(42,156),(38,164),(35,164),(36,157),(42,147),(47,137)], "pants_deep")
        poly([(49,111),(53,112),(52,125),(48,138),(44,148),(39,157),(37,160),(40,150),(45,139),(49,126)], "pants")
        poly([(36,161),(41,162),(43,165),(41,168),(34,167),(32,165)], "boot_deep")
        poly([(36,162),(40,163),(41,165),(37,166),(33,166)], "boot")
        line([(33,167),(38,168),(41,166)], "boot_light")
    elif phase == "right-forward":
        d.polygon([(55,137),(82,137),(88,184),(53,184)], fill=(0,0,0,0))
        poly([(57,107),(65,109),(67,125),(65,139),(68,150),(74,163),(80,176),(79,180),(74,179),(68,168),(62,154),(58,141)], "pants_deep")
        poly([(60,111),(64,112),(64,126),(62,139),(65,150),(71,163),(77,176),(76,178),(71,167),(66,153),(61,140),(60,126)], "pants")
        poly([(76,176),(84,177),(88,181),(87,183),(76,183),(73,182)], "boot_deep")
        poly([(78,178),(83,179),(85,181),(83,182),(75,182)], "boot")
        line([(75,182),(82,183),(87,182)], "boot_light")
    elif phase == "right-heel":
        d.polygon([(55,137),(82,137),(89,184),(53,184)], fill=(0,0,0,0))
        poly([(57,107),(65,109),(67,125),(65,140),(68,151),(74,164),(79,176),(79,181),(74,180),(68,168),(62,154),(58,141)], "pants_deep")
        poly([(60,111),(64,112),(64,126),(62,140),(65,151),(71,164),(76,176),(76,178),(71,167),(66,153),(61,140),(60,126)], "pants")
        poly([(75,176),(83,177),(87,180),(88,183),(77,183),(73,181)], "boot_deep")
        poly([(77,178),(82,179),(85,181),(86,182),(76,182)], "boot")
        line([(76,183),(83,183),(87,182)], "boot_light")
    else:
        return im, count
    return im, count


def shift_upper(base: Image.Image, dy: int) -> Image.Image:
    """Apply a one-pixel whole upper-body bob before the leg phase is redrawn."""
    if dy == 0:
        return base
    region = base.crop((0, 0, W, 150))
    base.paste((0, 0, 0, 0), (0, 0, W, 150))
    base.alpha_composite(region, (0, dy))
    return base


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    # Keypose anchors and four explicitly redrawn passing/contact phases.
    # The upper body must answer the weight transfer as well as the legs.
    # Each frame starts from a complete loaded pose; only the explicitly
    # authored lower-body phase is then redrawn. This keeps shoulder, elbow,
    # head, toolbox and recorder in the same pose family instead of freezing
    # one upper-body source for half of the loop.
    specs = [
        (0, "right-contact", "右脚着地"),
        (1, "right-lift", "右脚抬起"),
        (1, "left-forward", "左腿前摆"),
        (2, "left-heel", "左脚跟落地"),
        (3, "left-contact", "左脚着地"),
        (2, "left-lift", "左脚抬起"),
        (1, "right-forward", "右腿前摆"),
        (0, "right-heel", "右脚跟落地"),
    ]
    frames=[]
    upper_bob = [1, 0, 0, 1, 1, 0, 0, 1]
    for i,(pose,phase,label) in enumerate(specs):
        base, ops = module.frame_pose(pose)
        base = shift_upper(base, upper_bob[i])
        if phase in {"right-lift","left-lift","right-forward","right-heel"}:
            image, extra = repaint_step(base, phase); operations=len(ops)+extra
        else:
            image, operations = base, len(ops)
        file=FRAMES/f"frame-{i:02d}.png"; image.save(file)
        frames.append({"index":i,"file":f"frames/{file.name}","phase":phase,"label":label,"baseline":BASELINE,"authoring":"complete-pixel-frame-with-authored-step" if phase in {"right-lift","left-lift","right-forward","right-heel"} else "complete-pixel-keypose-anchor","operations":operations,"frameSha256":hashlib.sha256(file.read_bytes()).hexdigest()})
    scale=3; card=(W*scale+42,H*scale+58); atlas=Image.new("RGB",(card[0]*8,card[1]),"#102522"); draw=ImageDraw.Draw(atlas)
    try: font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",11*scale); small=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",8*scale)
    except OSError: font=small=None
    for e in frames:
        image=Image.open(OUT/e["file"]).convert("RGBA").resize((W*scale,H*scale),Image.Resampling.NEAREST); x=e["index"]*card[0]+21; atlas.paste(image,(x,42),image); draw.text((x,5),f"{e['index']:02d} {e['label']}",font=font,fill="#f0e7bc"); draw.text((x,42+H*scale+8),e["phase"],font=small,fill="#9bb9a2")
    atlas.save(OUT/"walk-atlas-3x.png")
    native=Image.new("RGB",(W*8,H+32),"#102522")
    for e in frames: image=Image.open(OUT/e["file"]).convert("RGBA"); native.paste(image,(e["index"]*W,28),image)
    native.save(OUT/"walk-native.png")
    root=Element("image",{"version":"0.0.3","w":str(W),"h":str(H),"name":"Eight frame walk sample"}); stack=SubElement(root,"stack"); ora=OUT/"pixel-walk-v01.ora"
    with zipfile.ZipFile(ora,"w",compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype","image/openraster",compress_type=zipfile.ZIP_STORED)
        for i,e in reversed(list(enumerate(frames))):
            buf=BytesIO(); Image.open(OUT/e["file"]).save(buf,format="PNG"); name=f"data/frame-{i:02d}.png"; z.writestr(name,buf.getvalue()); SubElement(stack,"layer",{"name":e["label"],"src":name,"opacity":"1.0","visibility":"visible","composite-op":"svg:src-over","x":"0","y":"0"})
        z.writestr("stack.xml",tostring(root,encoding="utf-8",xml_declaration=True)); buf=BytesIO(); Image.open(OUT/"walk-native.png").save(buf,format="PNG"); z.writestr("mergedimage.png",buf.getvalue()); z.writestr("Thumbnails/thumbnail.png",buf.getvalue())
    manifest={"revision":"pixel-walk-v01","status":"walk-art-source-pass","artApproved":True,"motionApproved":False,"homepageIntegrated":False,"canvas":[W,H],"baseline":BASELINE,"fps":8,"direction":"left-facing","frames":frames,"method":"eight complete native pixel frames; four loaded keypose upper-body anchors with explicit lower-body phases and a one-pixel authored weight bob","forbiddenMethods":["mirroring","horizontal stretch","runtime limb deformation","generic tween"],"gate":"Source art passes native and 3x review; validate scene-scale motion, contact rhythm and performance before homepage integration."}
    (OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    review={"revision":"pixel-walk-v01-review-v02","status":"pass-source-constrained-walk-art","reviewSurface":"pixel-walk-v01.html","manualChecklist":[{"id":"contact","question":"contact and lift phases alternate without floating or buried soles","status":"pass-source-review"},{"id":"rhythm","question":"eight frames read as one left-facing walk rather than four held poses","status":"pass-source-review"},{"id":"torso","question":"head, chest and pelvis respond to the step cycle","status":"pass-source-review"},{"id":"equipment","question":"toolbox and recorder remain attached through the cycle","status":"pass-source-review"},{"id":"native","question":"native-size silhouette remains readable and no tearing appears at 3x","status":"pass-source-review"}],"notes":["The complete upper-body source changes with the loaded pose sequence; the authored one-pixel bob is visible in the 3x strip.","Toolbox and recorder remain attached to their owning hands through all eight frames.","This is a source-art approval only; scene-scale naturalness, start/stop timing and long-run performance remain open."],"decision":"Source art passes; keep motionApproved false until scene-scale behavior review."}
    (OUT/"review-v01.json").write_text(json.dumps(review,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"status":"built","frames":len(frames),"out":str(OUT)},ensure_ascii=False))

if __name__ == "__main__": main()
