"""Integrity checker for the hand-authored turn gate.

This validates dimensions, baseline metadata, endpoint provenance and that the
three middle frames are explicit authoring outputs. It does not pretend to
judge whether the drawings are aesthetically approved.
"""
from __future__ import annotations
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-turn-keyframes-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))
review = json.loads((STUDY / "review-v01.json").read_text(encoding="utf8"))
if review["status"] not in {"pending-visual-review", "rejected-by-user"} or len(review["manualChecklist"]) != 5:
    raise SystemExit("TURN_KEYFRAME_REVIEW_RECORD_FAILED")
if manifest["canvas"] != [128, 196] or manifest["baseline"] != 183:
    raise SystemExit("TURN_KEYFRAME_CANVAS_FAILED")
if len(manifest["frames"]) != 5:
    raise SystemExit("TURN_KEYFRAME_COUNT_FAILED")
expected = ["front", "turn-15", "turn-30", "turn-45", "side"]
for i, (entry, view) in enumerate(zip(manifest["frames"], expected)):
    if entry["index"] != i or entry["view"] != view or entry["baseline"] != 183:
        raise SystemExit(f"TURN_KEYFRAME_ORDER_FAILED:{i}")
    path = STUDY / entry["file"]
    if Image.open(path).convert("RGBA").size != (128, 196):
        raise SystemExit(f"TURN_KEYFRAME_SIZE_FAILED:{i}")
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry["frameSha256"]:
        raise SystemExit(f"TURN_KEYFRAME_HASH_FAILED:{i}")
    expected_authoring = "endpoint-reference" if view in ("front", "side") else "hand-authored-complete-pixel-frame"
    if entry["authoring"] != expected_authoring:
        raise SystemExit(f"TURN_KEYFRAME_AUTHORING_FAILED:{i}")
row_widths = []
for entry in manifest["frames"]:
    alpha = Image.open(STUDY / entry["file"]).convert("RGBA").getchannel("A")
    xs = [x for x in range(alpha.width) if alpha.getpixel((x, 80))]
    if not xs:
        raise SystemExit(f"TURN_KEYFRAME_SILHOUETTE_ROW_FAILED:{entry['index']}")
    row_widths.append(max(xs) - min(xs) + 1)
if any(left < right for left, right in zip(row_widths, row_widths[1:])):
    raise SystemExit(f"TURN_KEYFRAME_TURN_WIDTH_ORDER_FAILED:{row_widths}")
for forbidden in ("mirroring", "horizontal stretch", "3D interpolation", "limb-only transforms", "generic motion tween"):
    if forbidden not in manifest["forbiddenMethods"]:
        raise SystemExit(f"TURN_KEYFRAME_METHOD_CONTRACT_FAILED:{forbidden}")
assert not manifest["artApproved"] and not manifest["motionApproved"]
print(json.dumps({"status":"integrity-ok", "frames":5, "intermediateFrames":3, "canvas":[128,196], "baseline":183, "silhouetteWidthsAtY80":row_widths, "artApproved":False, "motionApproved":False, "visualReview":review["status"]}, ensure_ascii=False))
