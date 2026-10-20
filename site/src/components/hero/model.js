// Pure simulation: light flicker, brown-outs, slab charge. No three.js here.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const SPOT = { angle: 0.3, penumbra: 0.6 };
export const CHARGE = {
  up: 1 / 6.5, // charge / s at full footprint and full intensity
  downRatio: 0.25, // idle decay = up * downRatio
  sag: 1.5, // extra loss while the light is on the slab but intensity collapses
};

// identical to three's spot cone falloff, evaluated at a world point
export function coneFactor(p, lp, ld, angle = SPOT.angle, penumbra = SPOT.penumbra) {
  const dx = p[0] - lp[0], dy = p[1] - lp[1], dz = p[2] - lp[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  const c = (dx * ld[0] + dy * ld[1] + dz * ld[2]) / l;
  return smooth(Math.cos(angle), Math.cos(angle * (1 - penumbra)), c);
}

export function stepCharge(c, f, nI, dt, k = CHARGE) {
  const e = f * nI;
  let dc = k.up * e;
  dc -= k.up * k.downRatio * (1 - smooth(0.12, 0.5, e));
  dc -= k.up * k.sag * f * (1 - smooth(0.15, 0.5, nI));
  return clamp(c + dc * dt);
}

function vnoise(rnd, n) {
  const t = new Float32Array(n + 2);
  for (let i = 0; i < t.length; i++) t[i] = rnd();
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    const a = t[((i % n) + n) % n], b = t[(((i + 1) % n) + n) % n];
    return a + (b - a) * u;
  };
}

export class Flicker {
  constructor(seed = 1, steady = false) {
    this.rnd = mulberry32(seed);
    this.steady = steady;
    this.ph = [this.rnd() * 6.28, this.rnd() * 6.28, this.rnd() * 6.28];
    this.noise = vnoise(this.rnd, 4096);
    this.next = 5 + this.rnd() * 4; // first brown-out 5..9 s in
    this.start = -1;
    this.hold = 0.18;
    this.log = []; // brown-out start times (sim seconds)
    this.rate = 1; this.depth = 1; // live-tunable: frequency scale and swing scale
  }
  // returns { base, b, n }: base jitter 0.55..1, b brown-out envelope 0.1..1, n = base*b
  at(t) {
    if (this.steady) return { base: 0.9, b: 1, n: 0.9 };
    const TAU = Math.PI * 2, tt = t * this.rate;
    let s =
      0.78 + this.depth * (
      0.075 * Math.sin((TAU * tt) / 2.9 + this.ph[0]) +
      0.055 * Math.sin((TAU * tt) / 1.27 + this.ph[1]) +
      0.035 * Math.sin((TAU * tt) / 0.53 + this.ph[2]) +
      0.11 * (this.noise(tt * 6.5) - 0.5));
    const base = clamp(s, 0.55, 1);
    if (t >= this.next && this.start < 0) {
      this.start = t;
      this.lastStart = t;
      this.hold = 0.14 + this.rnd() * 0.12;
      this.log.push(t);
    }
    let b = 1;
    if (this.start >= 0) {
      const u = t - this.start;
      if (u < this.hold) b = 0.1;
      else {
        b = 0.1 + 0.9 * (1 - Math.exp(-(u - this.hold) / 0.3));
        if (u > this.hold + 1.8) {
          this.start = -1;
          this.next = Math.max(t, this.lastStart + 5 + this.rnd() * 4); // 5..9 s between brown-out starts
          b = 1;
        }
      }
    }
    return { base, b, n: base * b };
  }
}
