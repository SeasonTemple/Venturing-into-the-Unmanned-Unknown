import * as THREE from 'three';
import * as G from '../shaders.js';
import { REVEAL, REVEAL_RT } from './config.js';

// revealMap (top-down orthographic, accumulate + decay). Owns `shared` uniforms.
export function createReveal(renderer, S, params) {
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const revealRT = new THREE.WebGLRenderTarget(REVEAL_RT[0], REVEAL_RT[1], rtOpts);
  const cx = REVEAL.x + REVEAL.w / 2, cz = REVEAL.z + REVEAL.d / 2;
  const revealCam = new THREE.OrthographicCamera(-REVEAL.w / 2, REVEAL.w / 2, REVEAL.d / 2, -REVEAL.d / 2, 0.1, 30);
  revealCam.position.set(cx, 10, cz); revealCam.up.set(0, 0, -1); revealCam.lookAt(cx, 0, cz);
  const revealScene = new THREE.Scene();
  const revealGeo = new THREE.PlaneGeometry(REVEAL.w, REVEAL.d).rotateX(-Math.PI / 2).translate(cx, 0, cz);
  const decayMat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 } }, vertexShader: G.decayVert, fragmentShader: G.decayFrag, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const footMat = new THREE.ShaderMaterial({
    uniforms: { uLP: { value: new THREE.Vector3() }, uLD: { value: new THREE.Vector3(0, -1, 0) }, uCos: { value: new THREE.Vector2() }, uAdd: { value: 0 } },
    vertexShader: G.footVert, fragmentShader: G.footFrag, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  const m0 = new THREE.Mesh(revealGeo, decayMat); m0.renderOrder = 0; m0.frustumCulled = false;
  const m1 = new THREE.Mesh(revealGeo, footMat); m1.renderOrder = 1; m1.frustumCulled = false;
  revealScene.add(m0, m1);

  const rect = new THREE.Vector4(REVEAL.x, REVEAL.z, REVEAL.w, REVEAL.d);

  const shared = {
    uReveal: { value: revealRT.texture }, uRect: { value: rect }, uTime: { value: 0 },
    uDone: { value: S.done }, uHover: { value: S.hover }, uGhost: { value: new THREE.Vector3(0.075, 9, 24) },   // x strength, y/z fade-out distance (m)
  };
  const clear = () => { [revealRT].forEach((t) => { renderer.setRenderTarget(t); renderer.clear(); }); renderer.setRenderTarget(null); };
  clear();

  return {
    shared, revealRT, revealScene, revealCam,
    update(S, fl, dt) {
      const lp = S.lp, ld = S.ld, red = S.reduced;
      footMat.uniforms.uLP.value.set(lp[0], lp[1], lp[2]); footMat.uniforms.uLD.value.set(ld[0], ld[1], ld[2]); footMat.uniforms.uCos.value.set(S.cone.cO, S.cone.cI);
      footMat.uniforms.uAdd.value = params.reveal.gain * dt * fl.n * (red ? 2.4 : 1);
      decayMat.uniforms.uK.value = 1 - Math.exp(-params.reveal.lambda * dt);
      shared.uTime.value = red ? 0 : S.time;   // slow erosion drift of the lit area's edge; frozen under reduced motion
    },
    // GPU part: accumulate light into revealMap
    render() {
      renderer.setRenderTarget(revealRT); renderer.autoClear = false; renderer.render(revealScene, revealCam); renderer.autoClear = true;
      renderer.setRenderTarget(null);
    },
    dispose() { revealRT.dispose(); revealGeo.dispose(); decayMat.dispose(); footMat.dispose(); },
  };
}
