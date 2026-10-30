"""Check the independent route behavior shell and its source references."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / "prototypes/visual-direction/pixel-route-v01/manifest.json"
html_path = ROOT / "prototypes/visual-direction/pixel-route-v01.html"
script_path = ROOT / "prototypes/visual-direction/pixel-route-v01.mjs"

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
assert manifest["status"] == "independent-behavior-shell"
assert manifest["homepageIntegrated"] is False
assert manifest["behaviorApproved"] is True
assert manifest["usesPendingWalkSource"] is True
assert manifest["sourceArtApproved"] is False
assert manifest["artApproved"] is False
assert manifest["motionApproved"] is False
assert len(manifest["walk"]["frames"]) == 8
assert len(manifest["turn"]["frames"]) == 5
assert [stop["x"] for stop in manifest["stops"]] == sorted((stop["x"] for stop in manifest["stops"]), reverse=True)
for frame in manifest["walk"]["frames"] + manifest["turn"]["frames"]:
    assert (ROOT / "prototypes/visual-direction" / frame["file"]).is_file(), frame["file"]
for path in (html_path, script_path):
    assert path.is_file(), path
html = html_path.read_text(encoding="utf-8")
script = script_path.read_text(encoding="utf-8")
for needle in ("id=\"scene\"", "aria-live=\"polite\"", "id=\"reduced\"", "id=\"turn\""):
    assert needle in html, needle
for needle in ("requestAnimationFrame", "IntersectionObserver", "prefers-reduced-motion", "stopRequested", "pendingTurn"):
    assert needle in script, needle
home_report = ROOT / "prototypes/visual-direction/pixel-route-v01/home-checks.json"
assert home_report.is_file()
assert json.loads(home_report.read_text(encoding="utf-8"))["pass"] is True
print(json.dumps({"status":"integrity-ok","revision":manifest["revision"],"walkFrames":8,"turnFrames":5,"homepageIntegrated":False,"behaviorReview":"pass-independent-shell","sourceArtApproved":False,"artApproved":False,"motionApproved":False}, ensure_ascii=False))
