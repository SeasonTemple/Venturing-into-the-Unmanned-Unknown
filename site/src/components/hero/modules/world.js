import * as THREE from 'three';
import * as G from '../shaders.js';
import { mulberry32, clamp } from '../model.js';
import { N, REVEAL, DUST_N, SLAB_YAW, slabX, slabZ } from './config.js';

export function tileNoiseTexture(size, seed) {
  const rnd = mulberry32(seed);
  const oct = [8, 16, 32, 64];
  const grids = oct.map((n) => { const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rnd(); return g; });
  const sample = (g, n, x, y) => {
    const fx = x * n, fy = y * n, ix = Math.floor(fx), iy = Math.floor(fy);
    const ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
    const a = g[(iy % n) * n + (ix % n)], b = g[(iy % n) * n + ((ix + 1) % n)];
    const c = g[((iy + 1) % n) * n + (ix % n)], d = g[((iy + 1) % n) * n + ((ix + 1) % n)];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < oct.length; o++) { v += amp * sample(grids[o], oct[o], x / size, y / size); tot += amp; amp *= 0.55; }
    const b = Math.round(255 * clamp(v / tot));
    const k = (y * size + x) * 4; data[k] = data[k + 1] = data[k + 2] = b; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function buildGround() {
  const g = new THREE.PlaneGeometry(REVEAL.w, REVEAL.d).rotateX(-Math.PI / 2).translate(REVEAL.x + REVEAL.w / 2, 0, REVEAL.z + REVEAL.d / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2.5, pos.getZ(i) / 2.5);
  return g;
}

// slab with a gently bowed front: normals lean up toward the lamp at the top and away at the bottom, a little toward the lamp side across,
// so the spotlight's incidence angle changes over the face (bright top -> dark foot) instead of one flat value
export function buildSlabGeometry() {
  const g = new THREE.BoxGeometry(0.55, 1.7, 0.2).translate(0, 0.85, 0);
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (nor.getZ(i) < 0.9) continue;
    const th = (pos.getY(i) / 1.7 - 0.42) * 0.62, ph = -(pos.getX(i) / 0.275) * 0.16;
    nor.setXYZ(i, Math.sin(ph) * Math.cos(th), Math.sin(th), Math.cos(ph) * Math.cos(th));
  }
  return g;
}

// ground (one plane) + 10 slabs + engraving lines + dust. Owns every material that samples the revealMap.
export function createWorld(scene, shared, S, pr) {
  const bump = tileNoiseTexture(128, 7);
  const materials = [], geometries = [];
  function revealStandard(kind) {
    const slab = kind === 'slab';
    const mat = new THREE.MeshStandardMaterial({ color: slab ? 0x222328 : 0x150e0a, roughness: slab ? 0.34 : 0.92, metalness: 0.06, bumpMap: bump, bumpScale: slab ? 1.5 : 3.0 });
    mat.defines = slab ? { SLAB: '' } : {};
    mat.customProgramCacheKey = () => 'svy-' + kind;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shared);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + G.NOISE + 'varying vec3 vWorld;\n' + (slab ? 'attribute float aSlab;\nvarying float vSlab;\nvarying vec3 vLoc;\n' : ''))
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + (slab
          ? 'vec4 svW = instanceMatrix * vec4(transformed, 1.0); svW = modelMatrix * svW; vWorld = svW.xyz; vSlab = aSlab; vLoc = transformed;'
          : 'vWorld = (modelMatrix * vec4(position, 1.0)).xyz;'));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + G.NOISE + G.revealPars)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + G.revealFragHead)
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + G.revealFragTail);
    };
    materials.push(mat); return mat;
  }
  const slabMat = revealStandard('slab'), groundMat = revealStandard('ground');
  const geo = (g) => { geometries.push(g); return g; };

  // ground: one flat plane; its visible extent is decided per fragment from the revealMap (eroding edge, see shaders.js)
  const ground = new THREE.Mesh(geo(buildGround()), groundMat); ground.receiveShadow = true; ground.frustumCulled = false; scene.add(ground);

  // slabs (devices) + engraving lines
  const slabGeo = geo(buildSlabGeometry());
  const idx = new Float32Array(N).map((_, i) => i);
  slabGeo.setAttribute('aSlab', new THREE.InstancedBufferAttribute(idx, 1));
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, N); slabs.castShadow = true; slabs.frustumCulled = false; scene.add(slabs);
  const lineGeo = geo(new THREE.BoxGeometry(0.034, 1.5, 0.012));
  lineGeo.setAttribute('aSlab', new THREE.InstancedBufferAttribute(idx.slice(), 1));
  const lineMat = new THREE.ShaderMaterial({ uniforms: { ...shared, uCharge: { value: S.charge }, uPulse: { value: S.pulse } }, vertexShader: G.lineVert, fragmentShader: G.lineFrag });
  materials.push(lineMat);
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, N); lines.frustumCulled = false; scene.add(lines);

  // dust: Points, 1 draw call, all motion in the vertex shader
  const dustGeo = geo(new THREE.BufferGeometry());
  { const rnd = mulberry32(99); const pos = new Float32Array(DUST_N * 3), sd = new Float32Array(DUST_N);
    for (let i = 0; i < DUST_N; i++) { pos[i * 3] = (rnd() - 0.5) * 18; pos[i * 3 + 1] = 0.05 + rnd() * 4.2; pos[i * 3 + 2] = -3.2 + (rnd() - 0.5) * 12.6; sd[i] = rnd(); }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1)); }
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: pr }, uSize: { value: 11 }, uDrift: { value: S.reduced ? 0 : 1 }, uPow: { value: 1 }, uLP: { value: new THREE.Vector3() }, uLD: { value: new THREE.Vector3(0, -1, 0) }, uCos: { value: new THREE.Vector2() } },
    vertexShader: G.dustVert, fragmentShader: G.dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  materials.push(dustMat);
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);

  const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4(), _y = new THREE.Matrix4().makeRotationY(SLAB_YAW);
  function writeMatrices() {
    for (let i = 0; i < N; i++) {
      _r.makeRotationX(S.tilt[i]);
      _m.makeTranslation(slabX(i), 0, slabZ(i)).multiply(_y).multiply(_r); slabs.setMatrixAt(i, _m);
      _t.makeTranslation(0, 0.87, 0.104); _m.multiply(_t); lines.setMatrixAt(i, _m);
    }
    slabs.instanceMatrix.needsUpdate = true; lines.instanceMatrix.needsUpdate = true;
  }
  writeMatrices();

  return {
    ground, slabs, lines, dust, dustMat, writeMatrices,
    update(S, fl) {
      const u = dustMat.uniforms, red = S.reduced;
      u.uLP.value.set(S.lp[0], S.lp[1], S.lp[2]); u.uLD.value.set(S.ld[0], S.ld[1], S.ld[2]);
      u.uCos.value.set(S.cone.cO, S.cone.cI); u.uPow.value = fl.n * (red ? 0.7 : 1); u.uTime.value = red ? 0 : S.time; u.uDrift.value = red ? 0 : 1;
    },
    setDetail(level) { dustGeo.setDrawRange(0, level >= 1 ? Math.round(DUST_N / 2) : DUST_N); },
    dispose() {
      [ground, slabs, lines, dust].forEach((o) => scene.remove(o));
      slabs.dispose(); lines.dispose();
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); bump.dispose();
    },
  };
}
