import * as THREE from 'three';
import { Flicker, clamp } from './model.js';
import { N, X0, HERO_U, prCap, makeParams } from './modules/config.js';
import { createRenderer } from './modules/renderer.js';
import { createPost } from './modules/post.js';
import { createLighting } from './modules/lighting.js';
import { createReveal } from './modules/reveal.js';
import { createWorld } from './modules/world.js';
import { createSim } from './modules/sim.js';
import { createRig } from './modules/rig.js';
import { createInteraction } from './modules/interaction.js';

const VIEW_SHIFT_H = 0.32;   // the scene is slid right by 0.32 x viewport HEIGHT (= the approved 0.20 x width at 16:10), so the poster (cover-cropped by height) and the live canvas line up at any desktop aspect

// Single instance: mount() always destroys the previous one first.
let current = null;
export function mount(container, opts = {}) {
  destroy();
  current = createInstance(container, opts);
  return current && current.api;
}
// returns what the renderer still tracked after every resource was disposed (null when nothing was mounted)
export function destroy() {
  if (!current) return null;
  const c = current; current = null;
  return c.destroy();
}

function createState() {
  return {
    reduced: false, hold: false, time: 0, p: 0, u: HERO_U, pull: 0, lightX: 0, lightV: 0, lean: 0, lx: 0,
    charge: new Float32Array(N), done: new Float32Array(N), hover: new Float32Array(N), pulse: new Float32Array(N),
    pulseT: new Float32Array(N).fill(-2), tilt: new Float32Array(N), hoverIdx: -1, foot: new Float32Array(N), doneAt: new Array(N).fill(null),
    mx: 0, my: 0, pmx: 0, pmy: 0, pointer: null, n: 0.9, base: 0.9, b: 1, dirty: true, frames: 0, tipIdx: -1, tipWall: 0,
    lp: [0, 5.2, 2.8], ld: [0, -1, 0], spot: { angle: 0.22, penumbra: 0.55 }, cone: { cO: 1, cI: 1 },
    qualityLevel: 0, fps: null, clicks: [],
  };
}

function createInstance(container, { seed, onLost, still } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;   // reduced motion: the poster is the whole experience
  const cleanups = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); cleanups.push(() => t.removeEventListener(type, fn, o)); };
  const S = createState(), params = makeParams(false);
  if (still) params.grain = 0;
  const flicker = new Flicker(seed ?? ((Math.random() * 1e9) | 0), false);

  const inter = createInteraction({ container, S });
  const scene = new THREE.Scene();                       // no background, no environment: pure black
  const camera = new THREE.PerspectiveCamera(38, 1.6, 0.1, 60); scene.add(camera);
  let post = null;
  const rend = createRenderer(container, params, (w, h, pr) => {
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.setViewOffset(w, h, -h * VIEW_SHIFT_H, 0, w, h);
    post && post.setSize(w, h, pr); S.dirty = true;
  });
  if (!rend) { inter.dispose(); return null; }
  const { renderer, canvas } = rend;
  const reveal = createReveal(renderer, S, params);
  const world = createWorld(scene, reveal.shared, S, rend.pr);
  const lighting = createLighting(scene, params);
  post = createPost(renderer, scene, camera, rend.pr, params);
  const rig = createRig(camera);
  const sim = createSim(S, flicker, params, inter.readScroll);
  rend.resize();
  inter.bind(canvas, camera, world);

  function update(dt) {
    const fl = sim.update(dt);
    rig.update(S, dt);
    inter.updateHover(S, fl, dt);
    lighting.update(S, fl, S.lx);
    reveal.update(S, fl, dt);
    world.update(S, fl);
    rend.update(); post.update(S);
    S.dirty = true;
  }
  function render() {
    renderer.info.reset();
    reveal.render();
    post.render();
    S.frames++;
    S.dirty = false;
  }
  function setQuality(level) {
    level = clamp(level | 0, 0, 3); S.qualityLevel = params.quality.level = level;
    world.setDetail(level); lighting.setConeSides(level >= 2);
    rend.setPixelRatio(level >= 3 ? 1 : Math.min(window.devicePixelRatio || 1, prCap()));
    world.dustMat.uniforms.uPR.value = rend.pr;
  }

  // ---- approved composition: slabs 0 and 1 already surveyed, lamp settled on slab 2, 4.9 s of light history in the reveal map ----
  S.p = inter.readScroll(); S.lightX = X0 + 2 * 1.3;
  for (let k = 0; k < 2; k++) { S.done[k] = 1; S.charge[k] = 1; S.doneAt[k] = 0; }
  for (let t = 0; t < 4.9; t += 1 / 30) { update(1 / 30); reveal.render(); }
  S.hold = true; S.time = 0;          // charge is frozen from here on: the hero keeps the approved frame and only breathes (flicker, dust, parallax)

  // ---- loop: runs only while the hero is on screen AND the tab is visible ----
  let raf = 0, last = 0, lastRaf = 0, bad = 0, destroyed = false, inView = true;
  const ring = new Float32Array(180); let rn = 0;
  function sample(now) {
    if (lastRaf) { ring[rn % 180] = now - lastRaf; rn++; }
    lastRaf = now;
    if (rn > 60 && rn % 60 === 0) {
      const n = Math.min(rn, 180), s = Array.from(ring.subarray(0, n)).sort((a, b) => a - b), p95 = s[Math.min(n - 1, Math.floor(n * 0.95))];
      S.fps = { p95: +p95.toFixed(1) };
      if (params.quality.auto) { bad = p95 > 33 ? bad + 1 : 0; if (bad >= 2 && S.qualityLevel < 3) { setQuality(S.qualityLevel + 1); bad = 0; rn = 0; } }
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.1); last = now;
    sample(now);
    update(dt); render();
  }
  function sync() {
    const run = !destroyed && !still && inView && !document.hidden;
    if (run && !raf) { last = performance.now(); lastRaf = 0; raf = requestAnimationFrame(frame); }
    else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  const io = new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; sync(); });
  io.observe(container); cleanups.push(() => io.disconnect());
  on(document, 'visibilitychange', sync);
  on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); if (!destroyed) { inView = false; sync(); onLost && onLost(); } });

  update(1 / 60); render();
  renderer.getContext().finish();
  sync();

  function teardown() {
    if (destroyed) return null;
    destroyed = true; sync();
    cleanups.forEach((f) => f()); cleanups.length = 0;
    scene.traverse((o) => {                                         // sweep: geometry, material (array or single), every texture on it
      if (o.geometry) o.geometry.dispose();
      const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => { for (const v of Object.values(mm)) if (v && v.isTexture) v.dispose(); mm.dispose(); });
    });
    inter.dispose(); post.dispose(); world.dispose(); lighting.dispose(); reveal.dispose(); sim.dispose(); rig.dispose();
    const left = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    rend.dispose();                                                 // ResizeObserver, renderer.dispose(), forceContextLoss(), canvas removal
    return left;
  }
  const info = () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs ? renderer.info.programs.length : 0, pixelRatio: rend.pr, quality: S.qualityLevel, running: !!raf });
  return { api: { canvas, info, render, destroy }, destroy: teardown };
}
