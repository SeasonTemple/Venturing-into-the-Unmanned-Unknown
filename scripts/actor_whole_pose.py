"""Small same-view full-body pose controls, with continuous surface sampling.

Uses the selected source artwork, not the rejected FK or lane animations.
Body anchors form one pelvis/chest/neck chain. The head follows the neck;
occupied arms retain their own elbows and measured hand/prop grip points.
This is a limited cutout/surface study, not completed painted walk artwork.
"""
import math

import numpy as np
from PIL import Image, ImageDraw


def rotate(v, degrees):
    angle = math.radians(degrees)
    c, s = math.cos(angle), math.sin(angle)
    return np.array([c*v[0] - s*v[1], s*v[0] + c*v[1]])


def smooth(lo, hi, value):
    t = np.clip((value-lo)/(hi-lo), 0, 1)
    return float(t*t*(3-2*t))


def transform(point, pivot, target, angle):
    return np.array(target) + rotate(np.array(point)-pivot, angle)


class WholePoseArt:
    # Measured on the original 156x348 image. In particular the left wrist is
    # beside the recorder top, not the old guessed point below the instrument.
    anchors = {
        'pelvis': [78, 178], 'chest': [78, 104], 'neck': [78, 66], 'head': [74, 30],
        'R': {'shoulder': [47, 86], 'elbow': [32, 122], 'wrist': [24, 151], 'grip': [25, 165]},
        'L': {'shoulder': [111, 83], 'elbow': [144, 121], 'wrist': [122, 150], 'grip': [113, 157]},
    }

    def __init__(self, layers, size, offset):
        self.size = tuple(size)
        self.offset = np.array(offset, dtype=float)
        self.layers = {name: im.copy() for name, im in layers.items()}
        self.body = self.layers['upper_body']
        self.ownership_transfers = []
        self.separate_surfaces()
        # Recover only coverage hidden underneath the existing sleeves. The
        # original source itself remains unchanged and covers this at rest.
        self.underpaint = Image.new('RGBA', self.body.size)
        for y in range(70, 178):
            if not self.body.getpixel((78, y))[3]:
                continue
            lo = hi = 78
            while lo > 0 and self.body.getpixel((lo-1, y))[3]:
                lo -= 1
            while hi < self.body.width-1 and self.body.getpixel((hi+1, y))[3]:
                hi += 1
            for side, edge, direction in [('R', lo, -1), ('L', hi, 1)]:
                for step in range(1, 13):
                    x = edge + direction*step
                    if not 0 <= x < self.body.width:
                        continue
                    # Detached cap-edge coverage can be separated by a source
                    # transparent pixel on this row; it is still hidden behind
                    # the sleeve. Do not stop the overlap at that first gap.
                    if not self.layers['arm_'+side].getpixel((x, y))[3]:
                        continue
                    sx = min(hi, max(lo, edge-direction*2))
                    self.underpaint.putpixel((x, y), self.body.getpixel((sx, y)))

    def separate_surfaces(self):
        """Move sleeve fragments out of the source torso mask before posing.

        The original separation left both a connected inner-elbow patch and
        isolated sleeve edge pixels in the torso layer. They otherwise follow
        the chest while their surrounding sleeve follows the arm.
        """
        base = Image.new('RGBA', self.body.size)
        for name in ['arm_R', 'arm_L', 'upper_body']:
            base.alpha_composite(self.layers[name])

        def transfer(points, target):
            for x, y in points:
                # Reproduce the old composited pixel at rest, including alpha.
                self.layers[target].putpixel((x, y), base.getpixel((x, y)))
                self.body.putpixel((x, y), (0, 0, 0, 0))
            self.ownership_transfers.append({'to': target, 'pixels': points})

        left_elbow = [(x, y) for y in range(69, 180) for x in range(114, self.body.width)
                      if self.body.getpixel((x, y))[3]]
        transfer(left_elbow, 'arm_L')
        remaining = {(x, y) for y in range(self.body.height) for x in range(self.body.width)
                     if self.body.getpixel((x, y))[3]}
        components = []
        while remaining:
            seed = remaining.pop()
            component, todo = [seed], [seed]
            while todo:
                x, y = todo.pop()
                for dx in [-1, 0, 1]:
                    for dy in [-1, 0, 1]:
                        point = (x+dx, y+dy)
                        if point in remaining:
                            remaining.remove(point); component.append(point); todo.append(point)
            components.append(component)
        for component in components:
            if len(component) > 48 or min(y for x, y in component) < 64:
                continue
            candidates = ['arm_R', 'arm_L', 'glove_R', 'toolbox_R', 'recorder_L']
            scores = {name: sum(0 <= x+dx < self.body.width and 0 <= y+dy < self.body.height
                                and self.layers[name].getpixel((x+dx, y+dy))[3] > 0
                                for x, y in component for dx in range(-2, 3) for dy in range(-2, 3))
                      for name in candidates}
            target = max(scores, key=scores.get)
            if scores[target]:
                transfer(component, target)

    def rigid(self, image, pivot, target, angle):
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        tx, ty = np.array(target) + self.offset
        return image.transform(self.size, Image.Transform.AFFINE,
            (c, s, pivot[0]-c*tx-s*ty, -s, c, pivot[1]+s*tx-c*ty),
            resample=Image.Resampling.NEAREST)

    def surface(self, image, point, rows=None):
        """Rasterize a shared connected triangle surface with inverse sampling.

        The exact same mapped vertices are used on both sides of every edge.
        No per-column offsets, independently scaled head or forward scattering.
        """
        bounds = image.getbbox()
        if bounds is None:
            return Image.new('RGBA', self.size)
        left, top, right, bottom = bounds
        # Keep the original interior tessellation, but extend its outer cover
        # beyond alpha bounds. A pixel has area: fractional translation must
        # not clip a visible top/edge sample at the geometric vertex boundary.
        xs = sorted(set([left-2, left, right, right+2] + list(range(left, right, 10))))
        ys = sorted(set([top-2, top, bottom, bottom+2] + list(range(top, bottom, 8))
                        + [y for y in (rows or []) if top < y < bottom]))
        source = np.array(image)
        result = np.zeros((self.size[1], self.size[0], 4), dtype=np.uint8)

        def triangle(ps, qs):
            ps = np.array(ps, dtype=float)
            qs = np.array(qs, dtype=float) + self.offset
            matrix = np.vstack((qs.T, np.ones(3)))
            if abs(np.linalg.det(matrix)) < 1e-8:
                raise ValueError('Collapsed artwork surface')
            lo = np.maximum(np.floor(qs.min(axis=0)).astype(int), 0)
            hi = np.minimum(np.ceil(qs.max(axis=0)).astype(int)+1, self.size)
            if np.any(hi <= lo):
                return
            yy, xx = np.mgrid[lo[1]:hi[1], lo[0]:hi[0]]
            bary = np.linalg.inv(matrix) @ np.vstack((xx.ravel(), yy.ravel(), np.ones(xx.size)))
            inside = (bary >= -1e-7).all(axis=0)
            uv = ps.T @ bary
            u, v = np.rint(uv).astype(int)
            inside &= (u >= 0) & (v >= 0) & (u < image.width) & (v < image.height)
            pixels = source[np.clip(v, 0, image.height-1), np.clip(u, 0, image.width-1)]
            inside &= pixels[:, 3] > 0
            result[yy.ravel()[inside], xx.ravel()[inside]] = pixels[inside]

        for a, b in zip(ys, ys[1:]):
            for l, r in zip(xs, xs[1:]):
                ps = [np.array(p) for p in [(l, a), (r, a), (r, b), (l, b)]]
                qs = [point(p) for p in ps]
                for indices in [(0, 1, 2), (0, 2, 3)]:
                    triangle([ps[i] for i in indices], [qs[i] for i in indices])
        return Image.fromarray(result)

    def render(self, pose):
        controls = pose['bodyPose']
        dx, dy = pose['upperShift']
        pelvis = np.array(self.anchors['pelvis']) + [dx, dy]
        lean = controls.get('spineLean', 0)
        chest_angle = lean + controls.get('chestCounterRoll', 0)
        chest = pelvis + rotate([0, -74], lean)
        neck = chest + rotate([0, -38], chest_angle)
        head_angle = controls.get('headWorldAngle', 0)

        def body_point(p):
            p = np.array(p)
            hip = transform(p, self.anchors['pelvis'], pelvis, controls.get('pelvisRoll', 0))
            rib = transform(p, self.anchors['chest'], chest, chest_angle)
            skull = transform(p, self.anchors['neck'], neck, head_angle)
            if p[1] < 90:
                t = smooth(64, 90, p[1])
                return skull*(1-t) + rib*t
            t = smooth(130, 178, p[1])
            return rib*(1-t) + hip*t

        actual = {name: body_point(self.anchors[name]).tolist() for name in ['pelvis', 'chest', 'neck', 'head']}
        arm_images, glove, box, recorder = {}, None, None, None
        for side in ['R', 'L']:
            source = self.anchors[side]
            shoulder = body_point(source['shoulder'])
            upper_angle = chest_angle + controls.get('shoulder'+side, 0)
            forearm_angle = upper_angle + controls.get('elbow'+side, 0)
            elbow = transform(source['elbow'], source['shoulder'], shoulder, upper_angle)

            def arm_point(p, source=source, shoulder=shoulder, elbow=elbow,
                          upper_angle=upper_angle, forearm_angle=forearm_angle):
                upper = transform(p, source['shoulder'], shoulder, upper_angle)
                forearm = transform(p, source['elbow'], elbow, forearm_angle)
                t = smooth(source['elbow'][1]-8, source['elbow'][1]+8, p[1])
                return upper*(1-t) + forearm*t

            arm_images[side] = self.surface(self.layers['arm_'+side], arm_point, [source['elbow'][1]])
            grip = transform(source['grip'], source['elbow'], elbow, forearm_angle)
            wrist = transform(source['wrist'], source['elbow'], elbow, forearm_angle)
            actual[side] = {'shoulder': shoulder.tolist(), 'elbow': elbow.tolist(),
                            'wrist': wrist.tolist(), 'grip': grip.tolist(),
                            'upperAngle': upper_angle, 'forearmAngle': forearm_angle}
            if side == 'R':
                glove = self.rigid(self.layers['glove_R'], source['elbow'], elbow, forearm_angle)
                box = self.rigid(self.layers['toolbox_R'], source['grip'], grip,
                                 controls.get('boxWorldAngle', 0))
            else:
                recorder = self.rigid(self.layers['recorder_L'], source['grip'], grip,
                                      forearm_angle + controls.get('recorderLocalAngle', 0))
        stack = [('hidden_jacket_coverage', self.surface(self.underpaint, body_point)),
                 ('sleeve_R', arm_images['R']), ('sleeve_L', arm_images['L']),
                 ('continuous_body_head_neck', self.surface(self.body, body_point, [64, 66, 90, 104, 130, 178])),
                 ('toolbox_R', box), ('glove_R', glove), ('recorder_L', recorder)]
        if controls.get('includePelvis'):
            stack.insert(4, ('continuous_pelvis', self.surface(self.layers['pelvis'], body_point, [178, 180, 208])))
        return stack, actual
