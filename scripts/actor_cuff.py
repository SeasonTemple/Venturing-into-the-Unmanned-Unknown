"""Derive an authored trouser hem from the very same ankle transform as its boot.

This repairs a cutout seam only. It does not establish anatomy or ground contact.
"""
import copy
import math


def attach_cuff_to_boot(spec, side, source):
    result = copy.deepcopy(spec)
    source_y = 314 if side == 'R' else 321
    pivot_x, pivot_y = (58, 319) if side == 'R' else (104, 328)
    # Ignore isolated mask specks and use the main opaque run at the hem.
    runs, start = [], None
    for x in range(source.width + 1):
        opaque = x < source.width and source.getpixel((x, source_y))[3] > 0
        if opaque and start is None:
            start = x
        if not opaque and start is not None:
            runs.append((start, x - 1))
            start = None
    if not runs:
        raise ValueError('Source trouser hem is missing')
    lo, hi = max(runs, key=lambda pair: pair[1] - pair[0])
    angle = math.radians(result.get('bootAngle', 0))
    c, s = math.cos(angle), math.sin(angle)
    tx, ty = result['ankle']

    def target(x):
        dx, dy = x - pivot_x, source_y - pivot_y
        return [round(tx + c * dx - s * dy), round(ty + s * dx + c * dy)]

    left, right = target(lo), target(hi)
    outline = result['outline']
    if len(outline) % 2:
        raise ValueError('Expected paired left/right trouser stations')
    half = len(outline) // 2
    outline[half - 1], outline[half] = left, right
    result['center'][-1] = [(left[1] + right[1]) / 2,
                             (left[0] + right[0]) / 2]
    result['hemLastRow'] = max(left[1], right[1])
    return result
