"""Asset generators record candidates; they cannot award visual approval."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image


def frame_set_digest(folder: Path, frames: list[dict]) -> str:
    """Bind decisions to decoded pixels and ordered frames, not PNG metadata."""
    digest = hashlib.sha256()
    for frame in frames:
        with Image.open(folder / frame["file"]) as source:
            image = source.convert("RGBA")
        digest.update(json.dumps([frame["file"], image.size]).encode("utf8"))
        digest.update(image.tobytes())
    return digest.hexdigest()


def write_candidate_records(folder: Path, manifest: dict, review: dict | None = None) -> None:
    path = folder / "review-v01.json"
    previous = json.loads(path.read_text(encoding="utf8")) if path.exists() else {}
    digest = frame_set_digest(folder, manifest["frames"])
    decision = previous.get("userDecision", {})
    rejected = decision.get("status") == "rejected" and decision.get("frameSetSha256") == digest
    review = dict(previous if review is None else review)
    review.update({
        "status": "rejected-by-user" if rejected else "pending-visual-review",
        "frameSetSha256": digest,
        "producer": "asset-builder",
        "artApproved": False,
        "motionApproved": False,
        "decision": "Rejected pixels retained for diagnosis; do not expand or publish."
            if rejected else "Candidate only. File integrity and diagnostic metrics do not approve art or motion.",
    })
    for item in review.get("manualChecklist", []):
        item["status"] = "blocked" if rejected else "needs-visual-review"
        item.pop("evidence", None)  # Old centroid/hash claims are technical, not visual evidence.
    review["notes"] = ["Automated checks establish resource integrity only; no visual acceptance is inferred."]
    if decision:
        if rejected:
            review["userDecision"] = decision
        else:
            review.pop("userDecision", None)
            review["previousUserDecision"] = decision
    manifest.update({"status": "visual-rejected" if rejected else "visual-review-pending",
                     "sourceArtApproved": False, "artApproved": False,
                     "motionApproved": False, "homepageIntegrated": False,
                     "visualReviewStatus": review["status"], "frameSetSha256": digest,
                     "gate": "Visual acceptance is absent. Retain as a diagnostic candidate, outside the formal homepage."})
    for name, data in [("manifest.json", manifest), ("review-v01.json", review)]:
        (folder / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
