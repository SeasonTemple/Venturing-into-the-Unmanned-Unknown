"""Preserve the original raster in editable guide layers, without downsampling.

This repairs a source-data loss, not the missing pose artwork or animation.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from io import BytesIO
from pathlib import Path
import zipfile
from xml.etree import ElementTree
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("master", ROOT / "scripts/build-pixel-native-master.py")
master = importlib.util.module_from_spec(spec)
spec.loader.exec_module(master)
OUT = ROOT / "prototypes/visual-direction/pixel-native-master-v01/full-resolution-source"


def main():
    OUT.mkdir(exist_ok=False)
    source_path = ROOT / "prototypes/visual-direction/art-pack-media/actor-front.png"
    original = Image.open(source_path).convert("RGBA")
    if original.size != (156, 348):
        raise ValueError("Recalibrate guide coordinates before changing the source dimensions")
    occupied = Image.new("L", original.size)
    layers = [("identity_reference", original.copy(), "hidden")]
    # These polygons are existing source guides, not invented hidden anatomy.
    # Make ownership disjoint so even antialiased alpha is not composited twice.
    for name, polygon in master.LAYERS.items():
        mask = Image.new("L", original.size)
        ImageDraw.Draw(mask).polygon([(x * 2, y * 2) for x, y in polygon], fill=255)
        mask = ImageChops.subtract(mask, occupied)
        occupied = ImageChops.lighter(occupied, mask)
        layer = Image.new("RGBA", original.size)
        layer.paste(original, (0, 0), mask)
        layers.append((name + "_guide", layer, "visible"))
    remainder = Image.new("RGBA", original.size)
    remainder.paste(original, (0, 0), ImageChops.invert(occupied))
    layers.append(("unassigned_source_pixels", remainder, "visible"))
    master.write_ora(OUT / "actor-source.ora", *original.size, layers)
    with zipfile.ZipFile(OUT / "actor-source.ora") as archive:
        stack = ElementTree.fromstring(archive.read("stack.xml")).find("stack")
        rebuilt = Image.new("RGBA", original.size)
        for layer in reversed(list(stack)):
            if layer.get("visibility") == "visible":
                rebuilt.alpha_composite(Image.open(BytesIO(archive.read(layer.get("src")))).convert("RGBA"))
        if rebuilt.tobytes() != original.tobytes():
            raise ValueError("Saved guide layers changed source pixels")
    original.save(OUT / "original-raster.png")
    original.resize((468, 1044), Image.Resampling.NEAREST).save(OUT / "original-raster-3x.png")
    reduced = original.resize((78, 174), Image.Resampling.NEAREST).resize(original.size, Image.Resampling.NEAREST)
    source_bytes, reduced_bytes = original.tobytes(), reduced.tobytes()
    changed = sum(source_bytes[i:i+4] != reduced_bytes[i:i+4] for i in range(0, len(source_bytes), 4))
    record = {
        "status": "source-restored-not-new-pose",
        "source": str(source_path.relative_to(ROOT)).replace("\\", "/"),
        "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "sourceRasterSize": list(original.size),
        "nativePixelGridKnown": False,
        "previousWorkingSize": [78, 174],
        "pixelsChangedByPreviousDownsampleRoundtrip": changed,
        "decodedLayerCompositeMatchesSource": True,
        "verification": "Saved visible ORA layers reconstruct original RGBA exactly; source retention only.",
        "layers": [name for name, _, _ in layers],
        "guideCoordinates": "existing guide polygons scaled by 2; no hidden-region painting",
        "limitations": ["not motion-ready", "occluded areas remain unpainted", "no new loaded pose"],
        "artApproved": False, "motionApproved": False, "homepageIntegrated": False,
    }
    (OUT / "manifest.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps(record, ensure_ascii=False))


if __name__ == "__main__":
    main()
