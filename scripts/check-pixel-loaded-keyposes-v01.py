"""Integrity checks for the four loaded keyposes; art approval remains manual."""
from __future__ import annotations
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-loaded-keyposes-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))
review = json.loads((STUDY / "review-v01.json").read_text(encoding="utf8"))
audit = json.loads((STUDY / "audit-v01.json").read_text(encoding="utf8"))
if review["status"] not in {"pending-visual-review", "rejected-by-user"} or len(review["manualChecklist"]) != 5:
    raise SystemExit("LOADED_KEYPOSE_REVIEW_RECORD_FAILED")
if not audit["upperBodyResponds"] or len(audit["frames"]) != 4:
    raise SystemExit("LOADED_KEYPOSE_UPPER_BODY_AUDIT_FAILED")
if manifest["canvas"] != [128, 196] or manifest["baseline"] != 183:
    raise SystemExit("LOADED_KEYPOSE_CANVAS_FAILED")
if len(manifest["frames"]) != 4:
    raise SystemExit("LOADED_KEYPOSE_COUNT_FAILED")
expected = ["right-bearing", "left-forward", "left-heel", "left-bearing"]
hashes = []
for i, (entry, view) in enumerate(zip(manifest["frames"], expected)):
    if entry["index"] != i or entry["view"] != view or entry["baseline"] != 183:
        raise SystemExit(f"LOADED_KEYPOSE_ORDER_FAILED:{i}")
    if entry["authoring"] != "hand-authored-complete-loaded-keypose" or entry["operations"] < 60:
        raise SystemExit(f"LOADED_KEYPOSE_AUTHORING_FAILED:{i}")
    path = STUDY / entry["file"]
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if image.size != (128, 196) or bounds is None or bounds[1] not in (10, 11) or bounds[3] != 184:
        raise SystemExit(f"LOADED_KEYPOSE_SIZE_OR_BOUNDS_FAILED:{i}")
    if not any(alpha.getpixel((x, 183)) for x in range(128)):
        raise SystemExit(f"LOADED_KEYPOSE_CONTACT_FAILED:{i}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest(); hashes.append(digest)
    if digest != entry["frameSha256"]:
        raise SystemExit(f"LOADED_KEYPOSE_HASH_FAILED:{i}")
if len(set(hashes)) != 4:
    raise SystemExit("LOADED_KEYPOSE_FRAMES_IDENTICAL")
assert not manifest["artApproved"] and not manifest["motionApproved"]
print(json.dumps({"status":"integrity-ok", "frames":4, "canvas":[128,196], "baseline":183, "uniqueFrames":4, "upperBodyCentroidChanges":audit["upperBodyResponds"], "artApproved":False, "visualReview":review["status"]}, ensure_ascii=False))
