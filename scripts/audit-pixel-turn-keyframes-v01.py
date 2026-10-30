"""Report measurable style and contact evidence for the turn gate.

The report is diagnostic, not an art approval: high colour counts can come
from antialiasing, so the values only identify where manual review is needed.
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-turn-keyframes-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))
rows = []
for entry in manifest["frames"]:
    image = Image.open(STUDY / entry["file"]).convert("RGBA")
    alpha = image.getchannel("A")
    visible = [pixel for pixel in image.get_flattened_data() if pixel[3] > 0]
    y80 = [x for x in range(image.width) if alpha.getpixel((x, 80)) > 0]
    bbox = alpha.getbbox()
    rows.append({
        "index": entry["index"],
        "view": entry["view"],
        "alphaBounds": list(bbox) if bbox else None,
        "visiblePixels": len(visible),
        "distinctRGBA": len(set(visible)),
        "silhouetteWidthAtY80": max(y80) - min(y80) + 1 if y80 else 0,
    })
endpoint_counts = [rows[0]["distinctRGBA"], rows[-1]["distinctRGBA"]]
middle_counts = [item["distinctRGBA"] for item in rows[1:-1]]
report = {
    "revision": "pixel-turn-keyframes-v01-audit-v01",
    "status": "diagnostic",
    "frames": rows,
    "endpointDistinctRGBA": endpoint_counts,
    "middleDistinctRGBA": middle_counts,
    "styleDensityRisk": max(middle_counts) < min(endpoint_counts) * 0.2,
    "interpretation": "RGBA count is a review signal only; it does not approve or reject the art.",
}
(STUDY / "audit-v01.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(json.dumps(report, ensure_ascii=False))
