"""Author four complete loaded keyposes as unapproved pixel candidates."""
from __future__ import annotations
import hashlib, json, zipfile
from io import BytesIO
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "prototypes/visual-direction/pixel-loaded-keyposes-v01"
FRAMES = OUT / "frames"
W, H, BASELINE = 128, 196, 183
P = {
    "ink":"#182728", "hair":"#20272d", "hair_mid":"#34383e", "hair_hi":"#575347",
    "skin_deep":"#69463d", "skin":"#b77955", "skin_hi":"#e0a269", "skin_light":"#f0bd79",
    "beard":"#493735", "beard_hi":"#6c493d", "coat_deep":"#633421", "coat_shadow":"#884425",
    "coat":"#bd6128", "coat_light":"#d88732", "coat_hi":"#edab4b", "coat_glint":"#f3c273",
    "pants_deep":"#1e302d", "pants":"#30443a", "pants_light":"#5b6845", "pants_hi":"#7e8558",
    "boot_deep":"#18252b", "boot":"#29343a", "boot_light":"#536055",
    "metal_deep":"#657873", "metal":"#aabbb1", "metal_light":"#d5dfcf", "metal_hi":"#edf0d5",
    "device_deep":"#244137", "device":"#366253", "screen":"#b7c793", "screen_hi":"#e5e2b8", "button":"#c28e65",
}


def frame_pose(pose: int) -> tuple[Image.Image, list[dict]]:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); ops = []
    def poly(points, color): d.polygon(points, fill=P[color]); ops.append({"kind":"polygon","points":points,"color":color})
    def rect(box, color): d.rectangle(box, fill=P[color]); ops.append({"kind":"rect","box":box,"color":color})
    def line(points, color, width=1): d.line(points, fill=P[color], width=width); ops.append({"kind":"line","points":points,"color":color,"width":width})

    # Pose contract: 0 right-leg support, 1 left leg forward, 2 left heel
    # contact, 3 left-leg support. Each pose gets its own complete silhouette.
    lean = [-2, 0, 2, 4][pose]
    # Hair top must remain y=10 like the approved turn source.
    head_y = [-2, -2, -1, -1][pose]
    # head and neck follow the torso lean; the face still points left.
    hx = [46, 49, 51, 53][pose]
    poly([(hx,head_y+19),(hx+8,head_y+17),(hx+15,head_y+19),(hx+19,head_y+24),(hx+18,head_y+32),(hx+15,head_y+38),(hx+10,head_y+41),(hx+4,head_y+39),(hx,head_y+36),(hx-3,head_y+34),(hx-2,head_y+30),(hx-1,head_y+26)], "skin")
    poly([(hx+1,head_y+21),(hx+7,head_y+19),(hx+12,head_y+20),(hx+15,head_y+24),(hx+14,head_y+31),(hx+11,head_y+37),(hx+6,head_y+38),(hx+2,head_y+35),(hx,head_y+32),(hx-2,head_y+32),(hx,head_y+28)], "skin_hi")
    poly([(hx+11,head_y+21),(hx+15,head_y+23),(hx+17,head_y+28),(hx+15,head_y+35),(hx+12,head_y+38),(hx+10,head_y+35),(hx+12,head_y+30)], "skin_deep")
    poly([(hx+1,head_y+34),(hx+5,head_y+37),(hx+9,head_y+38),(hx+13,head_y+36),(hx+13,head_y+39),(hx+9,head_y+42),(hx+4,head_y+40)], "beard")
    line([(hx+1,head_y+34),(hx+5,head_y+35),(hx+8,head_y+36)], "beard_hi")
    rect((hx-2,head_y+27,hx+1,head_y+28), "beard"); rect((hx-2,head_y+29,hx-1,head_y+29), "skin_light"); rect((hx,head_y+29,hx+1,head_y+29), "ink")
    poly([(hx-4,head_y+30),(hx-1,head_y+31),(hx-2,head_y+34),(hx-5,head_y+33),(hx-5,head_y+31)], "skin_hi")
    poly([(hx+1,head_y+21),(hx,head_y+18),(hx+3,head_y+15),(hx+8,head_y+14),(hx+11,head_y+12),(hx+16,head_y+14),(hx+19,head_y+16),(hx+21,head_y+20),(hx+20,head_y+26),(hx+17,head_y+26),(hx+15,head_y+22),(hx+11,head_y+20),(hx+6,head_y+21),(hx+2,head_y+24)], "hair")
    poly([(hx+3,head_y+18),(hx+8,head_y+15),(hx+13,head_y+14),(hx+17,head_y+16),(hx+19,head_y+19),(hx+16,head_y+20),(hx+12,head_y+18),(hx+7,head_y+19),(hx+3,head_y+21)], "hair_mid")
    line([(hx+7,head_y+15),(hx+11,head_y+14),(hx+14,head_y+15)], "hair_hi")
    poly([(hx+3,head_y+39),(hx+11,head_y+40),(hx+13,head_y+48),(hx+5,head_y+52),(hx+1,head_y+47)], "skin_deep")
    poly([(hx+5,head_y+40),(hx+10,head_y+41),(hx+11,head_y+46),(hx+6,head_y+49),(hx+3,head_y+46)], "skin")

    # torso and pelvis lean toward the support leg; chest folds follow the lean.
    tx = 47 + lean
    poly([(tx,48),(tx+9,46),(tx+18,50),(tx+23,57),(tx+23,74),(tx+21,91),(tx+23,105),(tx+18,112),(tx-1,110),(tx-6,105),(tx-4,88),(tx-4,71),(tx-1,57)], "coat_deep")
    poly([(tx+2,51),(tx+9,49),(tx+16,53),(tx+20,58),(tx+20,73),(tx+18,88),(tx+19,103),(tx+15,108),(tx,106),(tx-3,102),(tx-1,86),(tx-2,73),(tx+1,59)], "coat")
    poly([(tx+1,52),(tx+6,51),(tx+11,55),(tx+9,65),(tx+7,79),(tx+6,92),(tx+7,102),(tx+3,106),(tx-1,103),(tx,87),(tx-1,75),(tx+2,63)], "coat_light")
    poly([(tx+8,50),(tx+14,52),(tx+19,56),(tx+19,61),(tx+14,59),(tx+8,56)], "coat_hi")
    line([(tx+2,53),(tx+3,67),(tx+2,82),(tx+3,104)], "coat_glint")
    poly([(tx-2,47),(tx+3,45),(tx+8,49),(tx+13,50),(tx+17,48),(tx+20,50),(tx+15,55),(tx+9,54),(tx+3,51),(tx-3,50)], "coat_shadow")
    poly([(tx-1,47),(tx+3,46),(tx+7,50),(tx+13,51),(tx+14,53),(tx+8,52),(tx+2,49),(tx-2,49)], "coat_hi")
    line([(tx+2,55),(tx+2,80),(tx+3,103)], "coat_shadow")
    rect((tx+2,58,tx+3,60), "metal")
    # pose-specific chest folds make the torso react to the leg load.
    if pose == 0:
        poly([(tx+15,70),(tx+19,68),(tx+20,75),(tx+17,80),(tx+14,78)], "coat_shadow")
        poly([(tx+1,91),(tx+6,93),(tx+10,91),(tx+13,95),(tx+8,99),(tx+2,97)], "coat_light")
    elif pose == 1:
        poly([(tx+13,71),(tx+18,70),(tx+19,76),(tx+15,81),(tx+12,79)], "coat_shadow")
        poly([(tx+1,90),(tx+5,92),(tx+10,91),(tx+12,95),(tx+7,98),(tx+1,96)], "coat_hi")
    elif pose == 2:
        poly([(tx+12,72),(tx+17,70),(tx+19,76),(tx+15,82),(tx+11,80)], "coat_shadow")
        poly([(tx+1,92),(tx+5,94),(tx+9,92),(tx+12,96),(tx+6,100),(tx+1,97)], "coat_light")
    else:
        poly([(tx+11,72),(tx+16,70),(tx+18,77),(tx+14,83),(tx+10,81)], "coat_shadow")
        poly([(tx+1,93),(tx+5,95),(tx+9,93),(tx+11,97),(tx+6,101),(tx+1,98)], "coat_hi")

    # near arm and elbow counterbalance the support leg.
    arm_shift = [4, 2, 0, -2][pose]
    poly([(tx+16,54),(tx+23+arm_shift,56),(tx+29+arm_shift,63),(tx+31+arm_shift,72),(tx+29+arm_shift,81),(tx+24+arm_shift,90),(tx+19+arm_shift,99),(tx+15+arm_shift,100),(tx+13+arm_shift,96),(tx+18+arm_shift,86),(tx+22+arm_shift,78),(tx+23+arm_shift,71),(tx+19+arm_shift,63)], "coat_shadow")
    poly([(tx+17,57),(tx+22+arm_shift,58),(tx+26+arm_shift,64),(tx+28+arm_shift,72),(tx+26+arm_shift,79),(tx+22+arm_shift,86),(tx+18+arm_shift,95),(tx+15+arm_shift,96),(tx+20+arm_shift,84),(tx+24+arm_shift,77),(tx+25+arm_shift,71),(tx+20+arm_shift,64)], "coat")
    poly([(tx+18,58),(tx+22+arm_shift,60),(tx+25+arm_shift,65),(tx+26+arm_shift,71),(tx+24+arm_shift,76),(tx+22+arm_shift,68)], "coat_light")
    poly([(tx+22+arm_shift,87),(tx+25+arm_shift,85),(tx+22+arm_shift,92),(tx+19+arm_shift,95)], "coat_hi")
    poly([(tx+15+arm_shift,96),(tx+20+arm_shift,98),(tx+22+arm_shift,102),(tx+19+arm_shift,106),(tx+14+arm_shift,104),(tx+12+arm_shift,100)], "skin")
    rect((tx+16+arm_shift,98,tx+19+arm_shift,100), "skin_hi")

    # Erase the neutral lower body before drawing pose-specific legs and
    # equipment; otherwise the cleanup pass would cut through the toolbox.
    d.polygon([(39,103),(70,103),(75,184),(31,184)], fill=(0,0,0,0))

    # Toolbox and recorder move with their owning hands, not with the hips alone.
    tool_x = 29 + [0, 2, 4, 6][pose]
    hand_x = 38 + [0, 1, 3, 5][pose]
    poly([(hand_x,105),(hand_x+5,106),(hand_x+8,111),(hand_x+6,116),(hand_x+1,118),(hand_x-3,114),(hand_x-3,108)], "skin_deep")
    poly([(hand_x,106),(hand_x+4,107),(hand_x+6,111),(hand_x+4,114),(hand_x,114),(hand_x-1,111)], "skin")
    rect((hand_x+1,107,hand_x+4,109), "skin_hi")
    poly([(tool_x,119),(tool_x+6,116),(tool_x+16,118),(tool_x+18,122),(tool_x+17,138),(tool_x+14,141),(tool_x+1,138),(tool_x-1,135)], "metal_deep")
    poly([(tool_x+1,120),(tool_x+6,119),(tool_x+14,120),(tool_x+15,137),(tool_x+2,136)], "metal")
    poly([(tool_x+13,120),(tool_x+17,122),(tool_x+17,135),(tool_x+14,138),(tool_x+14,122)], "metal_light")
    line([(tool_x+2,121),(tool_x+13,122)], "metal_hi")
    rect((tool_x+4,124,tool_x+6,127), "metal_deep"); rect((tool_x+5,124,tool_x+6,125), "metal_hi")
    rect((tool_x+11,125,tool_x+13,128), "metal_deep"); rect((tool_x+12,125,tool_x+13,126), "metal_hi")
    line([(tool_x+2,135),(tool_x+13,137)], "metal_light")
    rec_x = 61 + [0, 1, 2, 3][pose]
    poly([(rec_x,105),(rec_x+5,106),(rec_x+6,120),(rec_x+4,123),(rec_x-1,121),(rec_x-2,110)], "device_deep")
    poly([(rec_x,107),(rec_x+4,108),(rec_x+4,120),(rec_x,119)], "device")
    rect((rec_x+1,109,rec_x+3,112), "screen"); rect((rec_x+1,110,rec_x+3,110), "screen_hi"); rect((rec_x,117,rec_x+1,118), "button")

    # support leg first: knee is over the planted foot; the other leg carries
    # a deliberate bend and never forms an inward-facing knee.
    support_x = [61, 61, 55, 48][pose]
    if pose == 0:
        poly([(54,105),(64,106),(67,124),(65,143),(65,160),(67,178),(62,182),(56,181),(57,164),(58,149),(55,136)], "pants_deep")
        poly([(58,110),(64,111),(65,126),(62,141),(62,157),(64,176),(60,180),(58,163),(59,148),(57,136)], "pants")
        poly([(48,106),(56,107),(57,123),(54,140),(52,156),(53,176),(50,180),(45,179),(44,162),(46,145),(45,129)], "pants")
        poly([(48,123),(52,123),(50,141),(49,156),(51,173),(48,177),(46,160)], "pants_light")
        left_boot, right_boot = (33,45,50,53), (56,62,67,69)
    elif pose == 1:
        poly([(57,105),(66,107),(68,125),(66,141),(64,158),(65,177),(61,181),(56,179),(57,161),(58,146),(55,132)], "pants_deep")
        poly([(60,110),(65,111),(66,127),(63,141),(62,157),(64,175),(60,178),(59,160),(60,145),(58,132)], "pants")
        poly([(49,106),(57,108),(54,123),(49,136),(43,148),(37,166),(31,179),(26,178),(30,163),(36,146),(43,132),(46,117)], "pants")
        poly([(48,112),(53,113),(50,124),(44,137),(39,149),(34,165),(30,175),(28,175),(34,153),(40,139),(46,125)], "pants_light")
        left_boot, right_boot = (22,29,36,40), (55,61,66,69)
    elif pose == 2:
        poly([(57,105),(66,107),(68,125),(65,141),(64,158),(65,177),(61,181),(56,179),(57,161),(58,146),(55,132)], "pants_deep")
        poly([(60,110),(65,111),(66,127),(63,141),(62,157),(64,175),(60,178),(59,160),(60,145),(58,132)], "pants")
        poly([(49,106),(57,108),(54,122),(48,135),(43,148),(38,159),(34,170),(33,179),(27,179),(28,169),(34,151),(41,137),(46,120)], "pants")
        poly([(48,112),(53,113),(49,125),(44,138),(39,151),(35,165),(34,176),(31,176),(34,156),(40,140),(46,125)], "pants_light")
        left_boot, right_boot = (25,33,39,44), (55,61,66,69)
    else:
        poly([(48,105),(57,107),(57,124),(55,140),(53,157),(52,176),(48,181),(44,179),(45,160),(46,145),(45,130)], "pants_deep")
        poly([(50,110),(55,111),(54,127),(51,142),(50,158),(49,175),(46,178),(47,159),(48,144),(47,131)], "pants")
        poly([(56,106),(65,108),(68,123),(67,138),(71,151),(75,164),(77,176),(73,180),(68,171),(64,159),(60,148),(59,134)], "pants")
        poly([(59,112),(64,113),(65,126),(63,138),(67,151),(71,162),(74,175),(71,176),(67,166),(62,151),(57,140)], "pants_light")
        left_boot, right_boot = (42,48,52,56), (70,75,78,81)
    # explicit support and trailing boots.
    for coords in [left_boot, right_boot]:
        x0,x1,x2,x3=coords
        poly([(x0,172),(x2,173),(x3,177),(x3-2,181),(x1,183),(x0-7,182),(x0-8,180),(x0-2,177)], "boot_deep")
        poly([(x0+1,175),(x1,175),(x2-1,178),(x2-3,180),(x0-6,181),(x0-3,178)], "boot")
        line([(x0-7,181),(x0,182),(x2-2,180)], "boot_light")
    # authored cloth creases reconnect knees and hems after the leg redraw.
    poly([(46,126),(49,124),(50,130),(47,135)], "pants_light")
    poly([(58,144),(61,141),(62,147),(60,151)], "pants_hi")
    poly([(49,157),(52,154),(52,161),(50,166)], "pants_deep")
    return im, ops


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    sequence = [("right-bearing", "右腿承重"), ("left-forward", "左腿前摆"), ("left-heel", "左脚跟落地"), ("left-bearing", "左腿承重")]
    frames=[]
    for i,(view,label) in enumerate(sequence):
        image, ops = frame_pose(i); file=FRAMES/f"frame-{i:02d}.png"; image.save(file)
        frames.append({"index":i,"file":f"frames/{file.name}","view":view,"label":label,"baseline":BASELINE,"authoring":"hand-authored-complete-loaded-keypose","operations":len(ops),"frameSha256":hashlib.sha256(file.read_bytes()).hexdigest()})
    scale=3; card=(W*scale+42,H*scale+58); atlas=Image.new("RGB",(card[0]*4,card[1]),"#102522"); draw=ImageDraw.Draw(atlas)
    try: font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",12*scale); small=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",8*scale)
    except OSError: font=small=None
    for e in frames:
        im=Image.open(OUT/e["file"]).convert("RGBA").resize((W*scale,H*scale),Image.Resampling.NEAREST); x=e["index"]*card[0]+21; atlas.paste(im,(x,42),im); draw.text((x,5),f"{e['index']:02d} {e['label']}",font=font,fill="#f0e7bc"); draw.text((x,42+H*scale+8),e["view"],font=small,fill="#9bb9a2")
    atlas.save(OUT/"loaded-keyposes-atlas-3x.png")
    native=Image.new("RGB",(W*4,H+32),"#102522")
    for e in frames: im=Image.open(OUT/e["file"]).convert("RGBA"); native.paste(im,(e["index"]*W,28),im)
    native.save(OUT/"loaded-keyposes-native.png")
    root=Element("image",{"version":"0.0.3","w":str(W),"h":str(H),"name":"Loaded keyposes"}); stack=SubElement(root,"stack"); ora=OUT/"pixel-loaded-keyposes-v01.ora"
    with zipfile.ZipFile(ora,"w",compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype","image/openraster",compress_type=zipfile.ZIP_STORED)
        for i,e in reversed(list(enumerate(frames))):
            buf=BytesIO(); Image.open(OUT/e["file"]).save(buf,format="PNG"); name=f"data/frame-{i:02d}.png"; z.writestr(name,buf.getvalue()); SubElement(stack,"layer",{"name":e["label"],"src":name,"opacity":"1.0","visibility":"visible","composite-op":"svg:src-over","x":"0","y":"0"})
        z.writestr("stack.xml",tostring(root,encoding="utf-8",xml_declaration=True)); buf=BytesIO(); Image.open(OUT/"loaded-keyposes-native.png").save(buf,format="PNG"); z.writestr("mergedimage.png",buf.getvalue()); z.writestr("Thumbnails/thumbnail.png",buf.getvalue())
    manifest={"revision":"pixel-loaded-keyposes-v01","status":"loaded-keypose-art-review","artApproved":False,"motionApproved":False,"homepageIntegrated":False,"canvas":[W,H],"baseline":BASELINE,"fps":6,"frames":frames,"method":"four complete pose-specific native pixel drawings; no leg-only runtime transform or generic tween","source":"prototypes/visual-direction/pixel-turn-keyframes-v01/frames/frame-03.png","poseContract":["right leg supports and left leg relaxes","left leg swings forward while right supports","left heel contacts while right supports","left leg supports and right leg trails"],"gate":"Approve pelvis, chest, shoulder, elbow, head, hands, equipment, knees and foot contact in all four poses before walking."}
    review={"revision":"pixel-loaded-keyposes-v01-review-v01","status":"pending-manual-art-approval","reviewSurface":"pixel-loaded-keyposes-v01.html","manualChecklist":[{"id":"support","question":"support foot carries pelvis and knee points over it","status":"needs-review"},{"id":"pelvis-chest","question":"pelvis, chest and shoulders respond across the four poses","status":"needs-review"},{"id":"arms-equipment","question":"elbows, hands, toolbox and recorder remain connected","status":"needs-review"},{"id":"knees","question":"knees bend outward or forward without inward collapse","status":"needs-review"},{"id":"contact","question":"all feet share y=183 with no floating or buried sole","status":"needs-review"}],"decision":"Do not expand to walking until the four loaded poses pass manual review."}
    from pixel_review import write_candidate_records
    write_candidate_records(OUT, manifest, review)
    print(json.dumps({"status":"built","frames":len(frames),"out":str(OUT)},ensure_ascii=False))

if __name__ == "__main__": main()
