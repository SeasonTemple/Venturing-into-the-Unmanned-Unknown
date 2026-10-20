import * as THREE from 'three';
import { prCap } from './config.js';

// one WebGLRenderer per mount(); returns null when WebGL2 is unavailable (the poster simply stays)
export function createRenderer(container, params, onResize) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('webgl2 required');
  } catch (e) { try { renderer && renderer.dispose(); } catch {} return null; }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('tabindex', '-1');
  canvas.className = 'mt-scene-canvas';
  container.appendChild(canvas);
  let pr = Math.min(window.devicePixelRatio || 1, prCap());
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;
  renderer.shadowMap.enabled = true;           // only the spot casts; ground receives, slabs cast
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;             // we reset once per frame so info covers the whole pipeline
  const size = { w: 1, h: 1 };
  function resize() {
    const r = container.getBoundingClientRect();
    size.w = Math.max(1, Math.round(r.width)); size.h = Math.max(1, Math.round(r.height));
    renderer.setSize(size.w, size.h);
    onResize && onResize(size.w, size.h, pr);
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  return {
    renderer, canvas, size, get pr() { return pr; },
    setPixelRatio(v) { pr = v; renderer.setPixelRatio(v); resize(); },
    resize,
    update() { renderer.toneMappingExposure = params.exposure; },
    dispose() { ro.disconnect(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); },
  };
}
