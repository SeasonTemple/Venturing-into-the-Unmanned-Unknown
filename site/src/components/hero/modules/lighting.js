import * as THREE from 'three';
import * as G from '../shaders.js';
import { zAt } from './config.js';

// the one lamp: SpotLight (+ its shadow map) and the volumetric cone mesh that shares its pose
export function createLighting(scene, params) {
  const spot = new THREE.SpotLight(0xffe4bd, params.light.intensity, 0, params.light.angle, params.light.penumbra, 2);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 1; spot.shadow.camera.far = 12; spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.02; spot.shadow.radius = 3;
  const ambient = new THREE.HemisphereLight(0x7f95c0, 0x14161c, params.light.ambient);   // barely there: only draws the silhouettes
  scene.add(spot, spot.target, ambient);
  const coneGeo = new THREE.ConeGeometry(1, 1, 64, 1, true).translate(0, -0.5, 0); // apex at origin, base at y=-1
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uPow: { value: 1 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.72, 0.36) }, uStrength: { value: params.light.coneStrength }, uNoise: { value: 1 } },
    vertexShader: G.coneVert, fragmentShader: G.coneFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat); cone.frustumCulled = false; scene.add(cone);
  const DOWN = new THREE.Vector3(0, -1, 0), v = new THREE.Vector3();
  return {
    spot, cone, coneMat,
    // S.lp / S.ld / S.spot already hold this frame's pose; fl = flicker sample
    update(S, fl, lx) {
      const red = S.reduced;
      spot.position.set(S.lp[0], S.lp[1], S.lp[2]); spot.target.position.set(lx, 0, zAt(lx)); spot.target.updateMatrixWorld();
      spot.angle = S.spot.angle; spot.penumbra = S.spot.penumbra;
      spot.intensity = params.light.intensity * fl.n * (red ? 1.35 : 1);
      const ext = v.set(lx - S.lp[0], -S.lp[1], zAt(lx) - S.lp[2]).length() * 1.3;
      cone.position.set(S.lp[0], S.lp[1], S.lp[2]);
      cone.quaternion.setFromUnitVectors(DOWN, v.set(S.ld[0], S.ld[1], S.ld[2]));
      const rad = Math.tan(S.spot.angle * 0.9);
      cone.scale.set(ext * rad, ext, ext * rad);
      coneMat.uniforms.uNoise.value = red ? 0 : 1;   // reduced motion: clean static shaft, no density banks
      coneMat.uniforms.uPow.value = fl.n; coneMat.uniforms.uTime.value = red ? 0 : S.time;
      coneMat.uniforms.uStrength.value = params.light.coneStrength * (red ? 0.55 : 1) * (S.qualityLevel >= 2 ? 1.7 : 1);
      S.cone.cO = Math.cos(S.spot.angle); S.cone.cI = Math.cos(S.spot.angle * (1 - S.spot.penumbra));
    },
    setConeSides(front) { coneMat.side = front ? THREE.FrontSide : THREE.DoubleSide; coneMat.needsUpdate = true; },
    dispose() { spot.shadow.dispose(); spot.shadow.map = null; coneGeo.dispose(); coneMat.dispose(); scene.remove(spot, spot.target, cone, ambient); ambient.dispose(); },
  };
}
