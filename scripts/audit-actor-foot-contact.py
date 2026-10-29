"""Audit evaluated shoe contact; never treats the lowest vertex as sole contact.

Usage:
  .../python.exe scripts/audit-actor-foot-contact.py --source-dir prototypes/visual-direction/actor-fk-reference-v02
"""
import argparse
import json
import math
from pathlib import Path

import bpy
import numpy as np


parser = argparse.ArgumentParser()
parser.add_argument("--source-dir", type=Path, required=True)
parser.add_argument("--cutoff", type=float, default=0.01,
                    help="local shoe vertices within this z range form the bottom sample")
args = parser.parse_args()
folder = args.source_dir.resolve()
blend = folder / "motion-reference.blend"
if not blend.exists():
    raise SystemExit(f"missing {blend}")

bpy.ops.wm.open_mainfile(filepath=str(blend))
scene = bpy.context.scene
shoe = bpy.data.objects["Ankle_boots"]
source_path = Path(__file__).resolve().parents[1] / ".lab/whole-walk/cmu-sampled/world-joints.json"
source = json.loads(source_path.read_text(encoding="utf-8"))["frames"]
vertex_ids = {
    side: [v.index for v in shoe.data.vertices
           if (v.co.x < 0) == (side == "R") and v.co.z <= args.cutoff]
    for side in ("R", "L")
}


def fit_plane(points):
    """Return normal tilt and residuals for z = ax + by + c."""
    pts = np.asarray(points, dtype=float)
    design = np.c_[pts[:, 0], pts[:, 1], np.ones(len(pts))]
    a, b, c = np.linalg.lstsq(design, pts[:, 2], rcond=None)[0]
    normal = np.array([-a, -b, 1.0])
    tilt = math.degrees(math.acos(min(1.0, abs(normal[2]) / np.linalg.norm(normal))))
    residual = pts[:, 2] - design @ np.array([a, b, c])
    return {"tiltDegrees": float(tilt), "rmsMm": float(np.sqrt(np.mean(residual * residual)) * 1000)}


frames = []
for frame in range(1, scene.frame_end + 1):
    scene.frame_set(frame)
    evaluated = shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
    sides = {}
    for side, ids in vertex_ids.items():
        points = [evaluated.matrix_world @ evaluated.data.vertices[index].co for index in ids]
        xyz = np.array([tuple(point) for point in points])
        plane = fit_plane(xyz)
        sides[side] = {
            **plane,
            "sampleCount": len(points),
            "heightRangeMm": [float(xyz[:, 2].min() * 1000), float(xyz[:, 2].max() * 1000)],
            "lowestPointMm": float(xyz[:, 2].min() * 1000),
        }
    source_frame = json.loads((folder / "reference.json").read_text(encoding="utf-8"))["frames"][frame - 1]["sourceFrame"]
    frames.append({"frame": frame, "sourceFrame": source_frame, "sides": sides})

max_tilt = max((item["sides"][side]["tiltDegrees"] for item in frames for side in ("R", "L")), default=0)
result = {
    "method": "Evaluated shoe geometry; per-side local-z bottom sample plane fit",
    "cutoffLocalZ": args.cutoff,
    "lowestVertexIsNotContactProof": True,
    "frames": frames,
    "summary": {
        "frameCount": len(frames),
        "maxSoleTiltDegrees": max_tilt,
        "frame48": frames[47] if len(frames) >= 48 else None,
    },
    "axisEvidence": {
        "purpose": "Expose the uncalibrated foot-frame inputs before choosing a correction.",
        "targetRestAxes": {
            side: [list(row) for row in np.asarray(bpy.data.objects["Fieldworker_master_rig"].data.bones["foot." + side].matrix_local.to_3x3())]
            for side in ("R", "L")
        },
        "sourceFrame48FootAxes": {
            side: source[235]["boneOrientations"][side.lower() + "foot"]
            for side in ("R", "L")
        },
        "sourceFrame48ToeAxes": {
            side: source[235]["boneOrientations"][side.lower() + "toes"]
            for side in ("R", "L")
        },
        "directWorldRotationCopy": True,
    },
}
out = folder / "foot-contact-audit.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"out": str(out), "summary": result["summary"]}, ensure_ascii=False))
