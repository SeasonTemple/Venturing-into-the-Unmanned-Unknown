"""Integrity checks for the eight-frame walk sample and its approved homepage gate."""
from __future__ import annotations
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-walk-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))
review = json.loads((STUDY / "review-v01.json").read_text(encoding="utf8"))
audit = json.loads((STUDY / "audit-v01.json").read_text(encoding="utf8"))
if review["status"] != "pass-source-constrained-walk-art" or len(review["manualChecklist"]) != 5:
    raise SystemExit("WALK_REVIEW_RECORD_FAILED")
if manifest["sourceArtApproved"] is not True or manifest["artApproved"] is not False or manifest["motionApproved"] is not False or manifest["homepageIntegrated"] is not False:
    raise SystemExit("WALK_APPROVAL_GATE_FAILED")
if audit["status"] != "diagnostic" or audit["upperBodyResponds"] is not True:
    raise SystemExit("WALK_UPPER_BODY_DIAGNOSTIC_FAILED")
if manifest["canvas"] != [128, 196] or manifest["baseline"] != 183 or manifest["fps"] != 8:
    raise SystemExit("WALK_CONTRACT_FAILED")
if len(manifest["frames"]) != 8:
    raise SystemExit("WALK_FRAME_COUNT_FAILED")
required = {"right-contact", "right-lift", "left-forward", "left-heel", "left-contact", "left-lift", "right-forward", "right-heel"}
actual = {entry["phase"] for entry in manifest["frames"]}
if actual != required:
    raise SystemExit(f"WALK_PHASE_SET_FAILED:{sorted(actual)}")
hashes = []
for i, entry in enumerate(manifest["frames"]):
    if entry["index"] != i or entry["baseline"] != 183:
        raise SystemExit(f"WALK_ORDER_FAILED:{i}")
    path = STUDY / entry["file"]; image = Image.open(path).convert("RGBA"); alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if image.size != (128, 196) or bounds is None or bounds[1] not in (10, 11, 12) or bounds[3] != 184:
        raise SystemExit(f"WALK_SIZE_OR_BOUNDS_FAILED:{i}")
    if not any(alpha.getpixel((x, 183)) for x in range(128)):
        raise SystemExit(f"WALK_CONTACT_FAILED:{i}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest(); hashes.append(digest)
    if digest != entry["frameSha256"]:
        raise SystemExit(f"WALK_HASH_FAILED:{i}")
if len(set(hashes)) != 8:
    raise SystemExit("WALK_FRAMES_NOT_UNIQUE")
print(json.dumps({"status":"ok", "frames":8, "canvas":[128,196], "baseline":183, "fps":8, "uniqueFrames":8, "sourceArtApproved":True, "artApproved":False, "motionApproved":False, "homepageIntegrated":False}, ensure_ascii=False))
