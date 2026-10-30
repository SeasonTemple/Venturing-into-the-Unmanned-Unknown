"""Exercise rejection persistence and invalidation in an isolated pixel source."""
from __future__ import annotations
import copy
import importlib.util
import json
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image
from pixel_review import frame_set_digest, write_candidate_records

with TemporaryDirectory(prefix="pixel-review-") as temporary:
    folder = Path(temporary)
    image = Image.new("RGBA", (3, 3), "#d88732")
    image.save(folder / "frame.png")
    source = {"frames": [{"file": "frame.png"}], "artApproved": True,
              "sourceArtApproved": True, "motionApproved": True, "homepageIntegrated": True}
    write_candidate_records(folder, copy.deepcopy(source), {"status": "pass-source-constrained-walk-art"})
    load = lambda name: json.loads((folder / name).read_text(encoding="utf8"))
    assert load("review-v01.json")["status"] == "pending-visual-review"
    assert all(load("manifest.json")[key] is False for key in ["artApproved", "sourceArtApproved", "motionApproved", "homepageIntegrated"])
    review = load("review-v01.json")
    review["userDecision"] = {"status": "rejected", "frameSetSha256": frame_set_digest(folder, source["frames"]), "reason": "test rejection"}
    (folder / "review-v01.json").write_text(json.dumps(review), encoding="utf8")
    write_candidate_records(folder, copy.deepcopy(source))
    assert load("review-v01.json")["status"] == "rejected-by-user"
    # Re-encoding identical pixels leaves the decision attached.
    image.save(folder / "frame.png", compress_level=0)
    write_candidate_records(folder, copy.deepcopy(source))
    assert load("review-v01.json")["status"] == "rejected-by-user"
    image.putpixel((0, 0), (0, 0, 0, 0))
    image.save(folder / "frame.png")
    write_candidate_records(folder, copy.deepcopy(source))
    current = load("review-v01.json")
    assert current["status"] == "pending-visual-review"
    assert current["previousUserDecision"]["reason"] == "test rejection"
    assert "userDecision" not in current
    assert load("manifest.json")["artApproved"] is False
print("PASS: generators cannot self-approve; rejection survives rebuild/re-encoding; changed pixels need a new review")

root = Path(__file__).resolve().parents[1]
for name in ["pixel-turn-keyframes-v01", "pixel-loaded-keyposes-v01", "pixel-walk-v01"]:
    source = root / "prototypes/visual-direction" / name
    before = json.loads((source / "manifest.json").read_text(encoding="utf8"))
    with TemporaryDirectory(prefix="pixel-rebuild-") as temporary:
        folder = Path(temporary) / name
        shutil.copytree(source, folder)
        spec = importlib.util.spec_from_file_location(name, root / "scripts" / f"build-{name}.py")
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        builder.OUT, builder.FRAMES = folder, folder / "frames"
        builder.main()
        after = json.loads((folder / "manifest.json").read_text(encoding="utf8"))
        assert frame_set_digest(folder, after["frames"]) == before["frameSetSha256"], name
        assert not any(after[key] for key in ["sourceArtApproved", "artApproved", "motionApproved", "homepageIntegrated"]), name
        if name == "pixel-walk-v01":
            assert after["visualReviewStatus"] == "rejected-by-user"
    print(f"PASS: isolated rebuild keeps {name} pixels and visual gate unchanged")
