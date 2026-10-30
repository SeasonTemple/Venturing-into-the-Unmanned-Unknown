"""Measure weight-transfer evidence without replacing manual pose review."""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-loaded-keyposes-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))
rows = []
for entry in manifest["frames"]:
    alpha = Image.open(STUDY / entry["file"]).convert("RGBA").getchannel("A")
    def region(y0, y1):
        points = [(x, y) for y in range(y0, y1 + 1) for x in range(alpha.width) if alpha.getpixel((x, y))]
        return {"bounds":[min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points)+1, max(y for _, y in points)+1], "centroidX":round(sum(x for x, _ in points)/len(points), 3), "visiblePixels":len(points)}
    contact = [x for x in range(alpha.width) if alpha.getpixel((x, 183))]
    rows.append({"index":entry["index"], "view":entry["view"], "upperBody":region(30,105), "lowerBody":region(105,183), "contactSpan":[min(contact),max(contact)] if contact else None})
upper_delta = round(rows[-1]["upperBody"]["centroidX"] - rows[0]["upperBody"]["centroidX"], 3)
lower_delta = round(rows[-1]["lowerBody"]["centroidX"] - rows[0]["lowerBody"]["centroidX"], 3)
report = {"revision":"pixel-loaded-keyposes-v01-audit-v01", "status":"diagnostic", "frames":rows, "upperBodyCentroidDelta":upper_delta, "lowerBodyCentroidDelta":lower_delta, "upperBodyResponds":abs(upper_delta)>=3, "interpretation":"Centroid movement supports review; it does not approve anatomy or balance."}
(STUDY / "audit-v01.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
print(json.dumps(report, ensure_ascii=False))
