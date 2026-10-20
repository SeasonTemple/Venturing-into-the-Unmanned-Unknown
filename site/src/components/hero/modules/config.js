export const N = 10, SP = 1.3, X0 = -5.85;
export const LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', 'A'];
export const REVEAL = { x: -9.5, z: -11, w: 19, d: 16 };   // covers the diagonal row (z +1 .. -8) plus margins
export const SLAB_DZ = -0.8, SLAB_YAW = -0.3;               // row runs diagonally into the depth, faces turned toward the front-left
export const slabX = (i) => X0 + i * SP;
export const slabZ = (i) => i * SLAB_DZ;
export const zAt = (x) => ((x - X0) / SP) * SLAB_DZ;      // row depth at any x (the lamp follows it)
export const LAMP = { y: 5.2, z: 2.8, dx: -1.6 };
export const TILT = 0.075;
// DPR ceiling: 2 on desktop, 1.5 on phones / coarse pointers
export const prCap = () => (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 820 ? 1.5 : 2);
export const HERO_U = 1.95;   // fixed composition: camera stands at u = 1.95 along the row (the approved frame)
export const DUST_N = 2000;
export const REVEAL_RT = [760, 640];

// every runtime-tunable number lives here; window.__survey.params exposes this very object
export function makeParams(reduced) {
  return {
    exposure: 1.1,
    bloom: { threshold: 1.1, strength: 0.34, radius: 0.3 },
    light: { intensity: 260, angle: 0.27, penumbra: 0.55, coneStrength: 0.15, ambient: 2.2 },
    flicker: { rate: 1, depth: 1 },             // rate scales the sine/noise frequencies, depth scales the swing
    reveal: { lambda: 0.55, gain: 1 },
    grain: reduced ? 0.02 : 0.026, vignette: 0.62,
    quality: { level: 0, auto: true },
  };
}
