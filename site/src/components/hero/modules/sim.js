import * as THREE from 'three';
import { stepCharge, coneFactor, clamp, smooth } from '../model.js';
import { N, SP, X0, LAMP, slabX, slabZ, zAt } from './config.js';

// non-GPU state machine: scroll smoothing, flicker sample, light spring, per-slab charge/latch/pulse
export function createSim(S, flicker, params, readScroll) {
  const V = new THREE.Vector3(), V2 = new THREE.Vector3();
  const pt = [0, 0, 0];
  return {
    update(dt) {
      S.time += dt;
      const red = S.reduced;
      flicker.rate = params.flicker.rate; flicker.depth = params.flicker.depth;
      const target = red ? 1 : readScroll();
      S.p += (target - S.p) * (1 - Math.exp(-dt * 3.0)); if (red) S.p = 1;
      const pa = clamp(S.p / 0.8);
      S.u = 0.4 + (8.6 - 0.4) * pa;
      S.pull = smooth(0.82, 1.0, S.p);
      const fl = flicker.at(S.time); S.n = fl.n; S.base = fl.base; S.b = fl.b;
      // light: dwell on nearest slab, snap between slabs; a critically-damped spring makes the sweep
      let tx, ly = LAMP.y, lz = LAMP.z;
      if (red) { tx = 0; ly = 6.6; lz = 3.4; S.spot.angle = 0.95; S.spot.penumbra = 0.9; S.lightX = 0; S.lightV = 0; S.lean = 0; }
      else {
        S.spot.angle = params.light.angle; S.spot.penumbra = params.light.penumbra;
        const fu = Math.floor(S.u), fr = S.u - fu;
        tx = X0 + (fu + smooth(0.25, 0.75, fr)) * SP;
        const w = 1.9, a = w * w * (tx - S.lightX) - 2 * w * S.lightV;
        S.lightV += a * dt; S.lightX += S.lightV * dt;
        S.lean += (clamp(S.lightV / 1.4, -1, 1) - S.lean) * (1 - Math.exp(-dt * 2.2));
      }
      const lx = red ? 0 : S.lightX;
      const tz = zAt(lx);
      S.lp[0] = lx + (red ? 0 : LAMP.dx) - S.lean * 1.4; S.lp[1] = ly; S.lp[2] = lz + tz;
      V.set(lx, 0, tz).sub(V2.set(S.lp[0], S.lp[1], S.lp[2])).normalize();
      S.ld[0] = V.x; S.ld[1] = V.y; S.ld[2] = V.z; S.targetX = tx; S.lx = lx; S.lz = tz;
      // charge
      for (let i = 0; i < N; i++) {
        pt[0] = slabX(i); pt[2] = slabZ(i);
        const f = coneFactor(pt, S.lp, S.ld, S.spot.angle, S.spot.penumbra);
        S.foot[i] = f;
        if (S.done[i] < 1 && !S.hold) {
          S.charge[i] = stepCharge(S.charge[i], f, fl.n, dt);
          if (S.charge[i] >= 0.998) { S.charge[i] = 1; S.done[i] = 1; S.doneAt[i] = S.time; S.pulseT[i] = S.time; }
        }
        if (S.pulseT[i] >= 0) { const a = (S.time - S.pulseT[i]) / 1.6; S.pulse[i] = a >= 1 ? 0 : Math.pow(Math.sin(Math.PI * a), 2); if (a >= 1) S.pulseT[i] = -2; }
      }
      return fl;
    },
    dispose() {},
  };
}
