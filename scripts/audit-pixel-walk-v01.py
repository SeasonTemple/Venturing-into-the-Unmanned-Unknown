"""Diagnostic audit for shared upper-body response in the walk sample.

This is evidence for manual review, not an art approval. It checks that the
head and chest regions change together while every frame retains the same
canvas and foot-contact contract.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "prototypes/visual-direction/pixel-walk-v01"
manifest = json.loads((STUDY / "manifest.json").read_text(encoding="utf8"))


def centroid(image: Image.Image, box: tuple[int, int, int, int]) -> tuple[float, float]:
    alpha = image.getchannel("A")
    x0, y0, x1, y1 = box
    points = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if alpha.getpixel((x, y))]
    if not points:
        raise ValueError("empty diagnostic region")
    return (sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points))


rows = []
for entry in manifest["frames"]:
    path = STUDY / entry["file"]
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    head = centroid(image, (0, 0, 128, 60))
    upper = centroid(image, (0, 60, 128, 137))
    rows.append({
        "index": entry["index"],
        "phase": entry["phase"],
        "bounds": list(bounds) if bounds else None,
        "headCentroid": [round(head[0], 3), round(head[1], 3)],
        "upperCentroid": [round(upper[0], 3), round(upper[1], 3)],
    })

head_y = [row["headCentroid"][1] for row in rows]
upper_y = [row["upperCentroid"][1] for row in rows]
head_x = [row["headCentroid"][0] for row in rows]
upper_x = [row["upperCentroid"][0] for row in rows]
report = {
    "revision": "pixel-walk-v01-audit-v01",
    "status": "diagnostic",
    "frames": rows,
    "headVerticalRange": round(max(head_y) - min(head_y), 3),
    "upperVerticalRange": round(max(upper_y) - min(upper_y), 3),
    "headHorizontalRange": round(max(head_x) - min(head_x), 3),
    "upperHorizontalRange": round(max(upper_x) - min(upper_x), 3),
    "upperBodyResponds": (max(head_y) - min(head_y) >= 0.5 and max(upper_y) - min(upper_y) >= 0.5),
    "interpretation": "Centroid changes support review of shared motion; they do not approve anatomy, balance or naturalness.",
}
(STUDY / "audit-v01.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(json.dumps(report, ensure_ascii=False))
