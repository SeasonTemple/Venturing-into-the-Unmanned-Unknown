import * as THREE from 'three';
import { N, TILT, HERO_U } from './config.js';

// pointer only: parallax target + slab hover tilt. Chapter links live in the page DOM, not here. Owns every listener it adds.
export function createInteraction({ container, S }) {
  const cleanups = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); cleanups.push(() => t.removeEventListener(type, fn, o)); };
  let canvas = null, camera = null, slabs = null, world = null;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const h = raycaster.intersectObject(slabs, false)[0];
    return h ? h.instanceId : -1;
  }
  return {
    // the hero is a fixed composition, not a scroll journey
    readScroll: () => 0.8 * ((HERO_U - 0.4) / 8.2),
    bind(c, cam, w) {
      canvas = c; camera = cam; world = w; slabs = w.slabs;
      on(window, 'pointermove', (e) => { S.mx = (e.clientX / window.innerWidth) * 2 - 1; S.my = (e.clientY / window.innerHeight) * 2 - 1; S.pointer = { x: e.clientX, y: e.clientY }; S.dirty = true; }, { passive: true });
      on(document.documentElement, 'pointerleave', () => { S.pointer = null; });
    },
    updateHover(S, fl, dt) {
      S.hoverIdx = S.pointer && canvas ? pick(S.pointer.x, S.pointer.y) : -1;
      let moved = false;
      for (let i = 0; i < N; i++) {
        const eligible = i === S.hoverIdx && (S.done[i] >= 1 || S.foot[i] * fl.n > 0.15);
        const h = S.hover[i] + ((eligible ? 1 : 0) - S.hover[i]) * (1 - Math.exp(-dt * 9));
        if (Math.abs(h - S.hover[i]) > 1e-4) S.dirty = true;
        S.hover[i] = h;
        const tt = TILT * h;
        if (Math.abs(tt - S.tilt[i]) > 1e-5) { S.tilt[i] = tt; moved = true; }
      }
      if (moved) world.writeMatrices();
    },
    dispose() { cleanups.forEach((f) => f()); cleanups.length = 0; },
  };
}
