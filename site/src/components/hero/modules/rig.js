import * as THREE from 'three';
import { SP, X0, zAt } from './config.js';

// camera: scroll travel along the row, pull-back overview at the end, damped parallax capped at 1.44 deg (1.2 yaw / 0.8 pitch ellipse)
export function createRig(camera) {
  const look = new THREE.Vector3(), V = new THREE.Vector3(), V2 = new THREE.Vector3(), UP = new THREE.Vector3();
  return {
    update(S, dt) {
      const red = S.reduced, pull = S.pull;
      if (red) { S.pmx = 0; S.pmy = 0; } else { const k = 1 - Math.exp(-dt * 2.6); S.pmx += (S.mx - S.pmx) * k; S.pmy += (S.my - S.pmy) * k; }
      // eye height 1.25 m, standing front-left of the current slab and looking down the diagonal row: near slabs big, far ones small
      const fx = X0 + S.u * SP, fz = zAt(fx), fit = Math.max(1, 1.6 / camera.aspect), k = 1 - pull;
      const cz = zAt(0);
      camera.position.set(
        (fx - 4.3) * k, 1.25 + 1.15 * pull,
        (fz + 6.2) * k + (cz + 11.8 * fit) * pull);
      look.set((fx + 2.0) * k, 0.95 - 0.25 * pull, (fz - 3.4) * k + cz * pull);
      V.copy(camera.position).sub(look);
      const yaw = -S.pmx * 1.2 * Math.PI / 180, pit = -S.pmy * 0.8 * Math.PI / 180;
      V.applyAxisAngle(UP.set(0, 1, 0), yaw);
      V2.set(1, 0, 0).applyAxisAngle(UP.set(0, 1, 0), yaw);
      V.applyAxisAngle(V2, pit);
      camera.position.copy(look).add(V); camera.lookAt(look);
      S.parallaxDeg = Math.hypot(S.pmx * 1.2, S.pmy * 0.8);
    },
    dispose() {},
  };
}
