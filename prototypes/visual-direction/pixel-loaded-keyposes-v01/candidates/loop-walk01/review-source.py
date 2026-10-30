"""Diagnose existing source only; never creates or approves media generation tasks."""
import argparse
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--atlas-script', type=Path, required=True)
    parser.add_argument('--frames', type=Path, required=True)
    args = parser.parse_args()
    out = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location('official_atlas', args.atlas_script)
    atlas = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(atlas)
    paths = sorted(args.frames.glob('frame-*.png'))
    assert len(paths) == 107, 'Expected entire 107-frame source, without trimming'
    images = []
    rows = []
    previews = []
    preview_dir = args.frames / 'review-composites'
    preview_dir.mkdir(exist_ok=True)
    for i, path in enumerate(paths):
        source = Image.open(path).convert('RGB')
        # Default far=120 overlaps the reference's own colours (minimum 86.7).
        # Conservative diagnostic key avoids intentional fading of those colours.
        keyed, purity, key = atlas.key_frame(source, near=35, far=70)
        images.append(keyed)
        alpha = np.asarray(keyed)[..., 3]
        yy, xx = np.nonzero(alpha >= 250)
        rows.append({'index': i, 'time': i / 24, 'purity': purity,
                     'estimatedKey': key.tolist(),
                     'opaqueCenterX': float(xx.mean()),
                     'opaqueBounds': [int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())]})
        canvas = Image.new('RGB', (768, 544))
        for x, color in ((0, '#192e29'), (384, '#e2d9bb')):
            canvas.paste(Image.new('RGB', (384, 512), color), (x, 32))
            canvas.paste(keyed, (x, 32), keyed)
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, 0, 768, 31), fill='#13231f')
        draw.text((10, 10), f'SOURCE DIAGNOSTIC | frame {i:03d}/106 | {i/24:.3f}s | unchanged position', fill='#f0e7cb')
        canvas.save(preview_dir / f'frame-{i+1:03d}.png')
        previews.append(canvas)
    small = atlas.small_arrays(images)
    info, picks = atlas.pick_loop(small, 16)
    diagnostics = {
        'purpose': 'Diagnosis only: full source chronology and root motion retained',
        'key': {'near': 35, 'far': 70, 'perFrameBorderEstimate': True},
        'sourceFrameCount': len(paths), 'fps': 24,
        'positionRangeDiagnosticPixels': max(r['opaqueCenterX'] for r in rows) - min(r['opaqueCenterX'] for r in rows),
        'positionMetricLimitation': 'Opaque silhouette centroid includes articulation; not an anatomical root measurement',
        'automaticLoop': info, 'automaticPicks': picks,
        'automaticSeam': atlas.loop_quality(small, picks, info),
        'automaticPlayback': atlas.playback_quality(small, picks, True, expected_n=16),
        'automaticMetricsLimitation': 'Pixel similarity cannot verify gait phase, weight, joint anatomy or naturalness',
        'frames': rows,
    }
    palette_source = Image.new('RGB', (384 * 6, 272 * 3))
    for j, i in enumerate(np.linspace(0, 106, 18).round().astype(int)):
        palette_source.paste(previews[i].resize((384, 272)), ((j % 6) * 384, (j // 6) * 272))
    palette = palette_source.quantize(colors=256)
    gif_frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in previews]
    durations = [(round((i + 1) * 100 / 24) - round(i * 100 / 24)) * 10 for i in range(107)]
    gif_path = out / 'source-diagnostic.gif'
    gif_frames[0].save(gif_path, save_all=True, append_images=gif_frames[1:],
                       duration=durations, loop=0, optimize=False, disposal=2)
    with Image.open(gif_path) as gif:
        total = 0
        for i in range(gif.n_frames):
            gif.seek(i)
            total += gif.info['duration']
        diagnostics['gif'] = {'frames': gif.n_frames, 'durationMs': total, 'expectedDurationMs': sum(durations)}
        assert total == sum(durations)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-framerate', '24',
                    '-i', str(preview_dir / 'frame-%03d.png'), '-c:v', 'libx264', '-crf', '18',
                    '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                    str(out / 'source-diagnostic.mp4')], check=True)
    for i in (0, 29, 48, 77, 106):
        images[i].save(out / f'keyed-diagnostic-{i:03d}.png')
    # Display exact algorithm picks without retiming or publishing a loop asset.
    sheet = Image.new('RGB', (1024, 1520), '#192e29')
    for j, i in enumerate(picks):
        thumb = images[i].resize((256, 342), Image.Resampling.NEAREST)
        x, y = (j % 4) * 256, (j // 4) * 380
        sheet.paste(thumb, (x, y + 25), thumb)
        ImageDraw.Draw(sheet).text((x + 8, y + 8), f'{i:03d} / {i/24:.3f}s', fill='#f0e7cb')
    sheet.save(out / 'automatic-cycle-diagnostic.jpg', quality=92)
    (out / 'source-diagnostics.json').write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in diagnostics.items() if k != 'frames'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
