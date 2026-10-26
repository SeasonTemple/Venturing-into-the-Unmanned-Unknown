import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const stations = [
  { title: '意图', chapter: 'ch1', angle: 2.6, y: .72 },
  { title: '设计', chapter: 'ch2', angle: 3.55, y: .78 },
  { title: '验证', chapter: 'ch3', angle: 4.55, y: .8 },
  { title: '实现', chapter: 'ch4', angle: 5.45, y: .6 },
  { title: '交付', chapter: 'ch6', angle: .1, y: .5 },
  { title: '演进', chapter: 'ch7', angle: 1.03, y: .45 },
].map(s => ({ ...s, position: [Math.cos(s.angle) * 5.8, s.y, Math.sin(s.angle) * 5.8] }));

export function createWorld(host, { onFrame, still = false } = {}) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.5 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.AgXToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#111c22'); scene.fog = new T.FogExp2('#111c22', .018);
  const camera = new T.PerspectiveCamera(37, 1, .2, 180);
  host.append(renderer.domElement);
  const geometryPool = new Map(), geometries = new Set(), materials = new Set(), textures = new Set();
  const m = opts => { const material = new T.MeshStandardMaterial(opts); materials.add(material); return material; };
  // One deterministic, owned roughness/bump map adds scale without image assets.
  const surface = document.createElement('canvas'); surface.width = surface.height = 128;
  const ctx = surface.getContext('2d'), data = ctx.createImageData(128, 128); let seed = 7101;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < data.data.length; i += 4) { const v = 118 + random() * 90; data.data[i] = data.data[i + 1] = data.data[i + 2] = v; data.data[i + 3] = 255; }
  ctx.putImageData(data, 0, 0); const grain = new T.CanvasTexture(surface); grain.wrapS = grain.wrapT = T.RepeatWrapping; grain.repeat.set(5, 5); textures.add(grain);
  const concrete = m({ color: '#8f9b96', roughness: .88, metalness: .05, bumpMap: grain, bumpScale: .035 });
  const stone = m({ color: '#536066', roughness: 1, bumpMap: grain, bumpScale: .06, flatShading: true });
  const metal = m({ color: '#495a61', roughness: .55, metalness: .45 });
  const dark = m({ color: '#23333b', roughness: .75, metalness: .2 });
  const copper = m({ color: '#aa7950', roughness: .52, metalness: .55 });
  const light = m({ color: '#e8bb7e', emissive: '#efad62', emissiveIntensity: 4, roughness: .8 });
  const ink = m({ color: '#101d24', roughness: .8 });
  const matte = m({ color: '#0b141a', roughness: 1, bumpMap: grain, bumpScale: .02 });
  function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
    geometry.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation))); geometry.translate(...position);
    if (!geometryPool.has(material)) geometryPool.set(material, []); geometryPool.get(material).push(geometry);
  }
  const box = (p, size, material = concrete, rotation = [0, 0, 0]) => add(new T.BoxGeometry(...size), material, p, rotation);
  function bevel(p, size, material = concrete, rot = [0, 0, 0], amount = .07) {
    const [w, h, d] = size, shape = new T.Shape(); shape.moveTo(-w / 2 + amount, -h / 2 + amount); shape.lineTo(w / 2 - amount, -h / 2 + amount); shape.lineTo(w / 2 - amount, h / 2 - amount); shape.lineTo(-w / 2 + amount, h / 2 - amount); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth: d - amount * 2, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: amount, bevelThickness: amount }); g.translate(0, 0, -d / 2 + amount); add(g, material, p, rot);
  }
  function sector(inner, outer, start, length, depth, material, pos = [0, 0, 0], vertical = false) {
    const shape = new T.Shape(); const steps = Math.max(10, Math.ceil(length * 18));
    shape.moveTo(Math.cos(start) * outer, Math.sin(start) * outer);
    for (let i = 1; i <= steps; i++) { const a = start + length * i / steps; shape.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); }
    for (let i = steps; i >= 0; i--) { const a = start + length * i / steps; shape.lineTo(Math.cos(a) * inner, Math.sin(a) * inner); }
    shape.closePath(); const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, bevelThickness: .035, bevelSize: .035, steps: 1 });
    if (!vertical) g.rotateX(-Math.PI / 2); add(g, material, pos);
  }
  function rod(a, b, radius, material = metal) {
    const av = new T.Vector3(...a), bv = new T.Vector3(...b), delta = bv.clone().sub(av);
    const g = new T.CylinderGeometry(radius, radius, delta.length(), 6); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize())); g.translate(...av.add(bv).multiplyScalar(.5).toArray()); add(g, material);
  }
  // Uneven cut stone under a precisely assembled, incomplete measuring deck.
  const base = new T.CylinderGeometry(7.6, 5.8, 1.5, 11, 1, false); base.rotateY(.2); add(base, stone, [0, -.9, 0]);
  // Machined perimeter, shallow grooves and inspection marks establish a human scale.
  for (let i = 0; i < 3; i++) sector(7.12, 7.35, 2.13, 3.9, .10, dark, [0, -.3 - i * .19, 0]);
  for (let i = 0; i < 70; i++) {
    const a = 2.15 + i * .055, r = i % 5 ? 6.78 : 6.65;
    box([Math.cos(a) * r, .525, Math.sin(a) * r], [i % 5 ? .12 : .35, .015, .025], copper, [0, -a, 0]);
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .04, y = i < 3 ? .22 : .05;
    if (i === 1) continue;
    sector(3.3, 7.25, a, .94, .28, i < 3 ? concrete : metal, [0, y, 0]);
    sector(6.98, 7.12, a + .025, .86, .03, copper, [0, y + .29, 0]);
    if (i > 1 && i < 5) sector(3.38, 3.43, a + .04, .8, .025, light, [0, y + .30, 0]);
    for (let j = 0; j < 5; j++) {
      const r = 3.8 + j * .55; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      box([x, y + .025, z], [.035, .025, .46], dark, [0, -a, 0]);
    }
    const radial = a + .48;
    box([Math.cos(radial) * 5.1, -.12, Math.sin(radial) * 5.1], [2.4, .28, 3.3], dark, [0, -radial, 0]);
  }
  // A gap persists even in the most ordered part of the world.
  sector(3.45, 7, 1.14, .25, .2, metal, [0, -.25, 0]);
  sector(4.1, 6.4, 1.55, .16, .18, metal, [.3, -.45, .25]);
  for (let i = 0; i < 4; i++) {
    const a = .88 + random() * .74, r = 7.2 + random() * 4;
    bevel([Math.cos(a) * r, -.35 - random() * .9, Math.sin(a) * r], [.5 + random() * .8, .15, .6 + random()], metal, [0, random(), .1]);
  }
  // A large open arch is the landmark shared by both camera states.
  sector(4.25, 4.7, -.05, Math.PI * 1.1, .42, concrete, [0, 3.65, -2.5], true);
  sector(4.12, 4.21, .04, Math.PI * .95, .13, copper, [0, 3.65, -2.23], true);
  sector(4.15, 4.19, .24, Math.PI * .62, .045, light, [0, 3.65, -2.00], true);
  // This is a measuring instrument: offset plates, fasteners and a partial graduation.
  for (let i = 0; i < 48; i++) {
    const a = .04 + i * Math.PI / 47, r = 4.49;
    box([Math.cos(a) * r, 3.65 + Math.sin(a) * r, -2.04], [i % 4 ? .09 : .21, .025, .035], i < 32 ? copper : dark, [0, 0, a]);
  }
  for (let i = 0; i < 7; i++) {
    const a = .06 + i * .49;
    box([Math.cos(a) * 4.53, 3.65 + Math.sin(a) * 4.53, -2.48], [.17, .55, .63], dark, [0, 0, a]);
  }
  bevel([-4.49, 1.65, -2.27], [.48, 3.3, .74], concrete); bevel([4.47, 1.65, -2.27], [.48, 3.3, .74], metal);
  bevel([-4.48, .2, -2.3], [1.8, .3, 1.3], dark); bevel([4.48, .12, -2.3], [1.8, .3, 1.3], dark);
  // Center reference table: small, warmly illuminated, surrounded by unmeasured space.
  bevel([-.6, .4, .1], [3.6, .7, 2.6], dark); bevel([-.6, .8, .1], [3.85, .14, 2.8], copper);
  bevel([-.6, .9, .1], [3.55, .12, 2.5], concrete);
  for (let i = 0; i < 5; i++) box([-.6, .97, -.8 + i * .43], [3.15, .014, .012], metal);
  for (let i = 0; i < 7; i++) box([-2 + i * .46, .975, .1], [.012, .014, 2.1], metal);
  for (const [x, z, h] of [[-.9, .35, .33], [-.1, -.3, .45], [.5, .5, .18]]) bevel([x, 1 + h / 2, z], [.5, h, .4], stone, [0, .15, 0], .025);
  // A physical topographic sheet rather than a floating interface.
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = 768; mapCanvas.height = 512;
  const mapContext = mapCanvas.getContext('2d'); mapContext.fillStyle = '#b9b49c'; mapContext.fillRect(0, 0, 768, 512);
  mapContext.strokeStyle = '#6e796c'; mapContext.lineWidth = 1.4;
  for (let level = 0; level < 23; level++) {
    mapContext.beginPath();
    for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2, r = 20 + level * 13 + Math.sin(a * 3 + level * .09) * 16 + Math.cos(a * 5) * 9; const x = 405 + Math.cos(a) * r * 1.28, y = 240 + Math.sin(a) * r * .8; i ? mapContext.lineTo(x, y) : mapContext.moveTo(x, y); }
    mapContext.closePath(); mapContext.stroke();
  }
  mapContext.strokeStyle = '#984e2e'; mapContext.lineWidth = 3; mapContext.beginPath(); mapContext.moveTo(140, 400); mapContext.lineTo(300, 315); mapContext.lineTo(390, 280); mapContext.lineTo(520, 140); mapContext.stroke();
  mapContext.font = '14px monospace'; mapContext.fillStyle = '#35413e'; mapContext.fillText('FIELD SURVEY / 06', 24, 33); mapContext.fillText('BOUNDARY UNRESOLVED', 24, 487);
  const mapTexture = new T.CanvasTexture(mapCanvas); mapTexture.colorSpace = T.SRGBColorSpace; textures.add(mapTexture);
  const mapMaterial = m({ map: mapTexture, color: '#e3d1a7', roughness: 1 });
  add(new T.PlaneGeometry(3.1, 2.0), mapMaterial, [-.6, .991, .1], [-Math.PI / 2, 0, 0]);
  rod([-2.55, .5, 1.7], [-2.55, 2.7, 1.7], .045); rod([-2.55, 2.7, 1.7], [-.4, 2.7, 1.7], .04);
  box([-1.2, 2.68, 1.7], [1.75, .07, .14], dark); box([-1.2, 2.63, 1.7], [1.6, .025, .12], light);
  const local = (index, x, y, z) => { const s = stations[index]; return [s.position[0] + x, s.position[1] + y, s.position[2] + z]; };
  // Each work site has a distinct silhouette instead of repeated chapter plinths.
  bevel(local(0, 0, -.12, 0), [1.8, .2, 1.35], dark); bevel(local(0, 0, .55, -.25), [1.7, .85, .13], concrete, [-.23, 0, 0]);
  box(local(0, 0, .59, -.13), [1.45, .55, .035], ink, [-.23, 0, 0]); box(local(0, -.55, .45, .01), [.035, .22, .04], light);
  for (let i = 0; i < 3; i++) bevel(local(1, i * .38 - .38, .25 + i * .23, 0), [.53, .7 + i * .4, .55], concrete, [0, -.18, 0], .04);
  rod(local(1, -.8, .85, .5), local(1, .8, .85, .5), .025, copper);
  bevel(local(2, 0, -.13, 0), [2, .22, 1.7], dark);
  for (const x of [-.7, .7]) bevel(local(2, x, .85, 0), [.17, 1.7, .3], metal, [0, 0, x > 0 ? -.12 : .12], .025);
  bevel(local(2, 0, 1.7, 0), [1.6, .16, .32], concrete, [0, 0, 0], .03); box(local(2, 0, 1.58, .02), [1.3, .025, .1], light);
  bevel(local(3, 0, .3, 0), [2.15, .4, 1.1], concrete); box(local(3, 0, .53, 0), [1.8, .035, .7], dark);
  for (let i = 0; i < 5; i++) bevel(local(3, -.7 + i * .35, .7, 0), [.17, .3, .4], metal, [0, 0, 0], .025);
  const mast = local(4, 0, .8, 0); rod([mast[0], .3, mast[2]], [mast[0], 2.4, mast[2]], .09, concrete);
  add(new T.ConeGeometry(.8, .25, 12, 1, true), copper, local(4, 0, 2, 0), [.3, 0, .35]);
  rod(local(4, 0, .1, 0), local(4, .9, -.1, .5), .035); rod(local(4, 0, .1, 0), local(4, -.8, -.1, .4), .035);
  for (let i = 0; i < 4; i++) { const p = local(5, i * .4 - .6, .15 + i * .07, i % 2 * .5); bevel(p, [.35, .28, .35], metal, [0, .2, 0], .035); }
  // Keep the unknown empty; disconnected boxes read as unfinished modelling.
  add(new T.PlaneGeometry(250, 250), matte, [0, -1.85, 0], [-Math.PI / 2, 0, 0]);
  for (const [material, parts] of geometryPool) {
    // Extrusions have UVs/normals compatible with standard primitives.
    const g = mergeGeometries(parts.map(part => part.index ? part.toNonIndexed() : part));
    parts.forEach(part => part.dispose()); geometries.add(g);
    const mesh = new T.Mesh(g, material); mesh.castShadow = material !== light && material !== matte; mesh.receiveShadow = true; scene.add(mesh);
  }
  const hemi = new T.HemisphereLight('#9ebbc8', '#10191e', 1); scene.add(hemi);
  const key = new T.DirectionalLight('#b8d6e1', 2.1); key.position.set(-7, 14, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 15, bottom: -13, near: .5, far: 55 }); key.shadow.normalBias = .045; scene.add(key);
  const fill = new T.DirectionalLight('#769bb8', 2); fill.position.set(5, 6, -8); scene.add(fill);
  const spot = new T.SpotLight('#ffb05b', 1600, 11, 1.05, .65, 2); spot.position.set(-1.2, 3.6, 1.7); spot.target.position.set(-.6, .8, .1); scene.add(spot, spot.target);
  const warm = new T.PointLight('#f9a359', 80, 7, 2); warm.position.set(-1, 1.9, .1); scene.add(warm);
  // Actors only belong to the entered state. Their scale remains subordinate to the place.
  const actors = new T.Group(); actors.visible = false; scene.add(actors);
  function actor(human, p) {
    const group = new T.Group(); const material = human ? concrete : dark;
    const parts = human ? [new T.CylinderGeometry(.16, .14, .52, 6).translate(0, .7, 0), new T.SphereGeometry(.15, 8, 6).translate(0, 1.1, 0), ...[-.09, .09].map(x => new T.BoxGeometry(.12, .4, .13).translate(x, .25, 0))] : [new T.BoxGeometry(.55, .3, .44).translate(0, .3, 0), new T.BoxGeometry(.3, .19, .3).translate(0, .55, 0), ...[-.28, .28].map(x => new T.BoxGeometry(.1, .14, .48).translate(x, .15, 0))];
    const geometry = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g)); parts.forEach(g => g.dispose()); geometries.add(geometry);
    const mesh = new T.Mesh(geometry, material); mesh.castShadow = true; group.add(mesh);
    const visorG = new T.BoxGeometry(human ? .18 : .26, .055, .035); geometries.add(visorG); const visor = new T.Mesh(visorG, light); visor.position.set(0, human ? 1.12 : .56, .19); group.add(visor);
    group.position.fromArray(p); actors.add(group); return group;
  }
  const person = actor(true, [-3.3, .26, 2.7]); const bots = [actor(false, [-4.3, .25, -3.2]), actor(false, [2.8, .12, -4.4]), actor(false, [5.2, .08, 1.8])];
  let width = 1, height = 1, raf = 0, disposed = false, suspended = false, view = 'home', job = null, mode = 'agent', frames = 0;
  const eye = new T.Vector3(), target = new T.Vector3(), abort = new AbortController();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preset = (name) => {
    const narrow = width < 760;
    return name === 'home' ? { eye: new T.Vector3(narrow ? 36 : 18, narrow ? 28 : 14, narrow ? 44 : 23), target: new T.Vector3(0, 2.2, 0) }
      : { eye: new T.Vector3(narrow ? 31 : 13, narrow ? 23 : 9.5, narrow ? 38 : 17), target: new T.Vector3(0, 1.8, -.5) };
  };
  function render(now = performance.now()) {
    if (disposed || suspended) return;
    if (job) {
      job.start ??= now; const t = Math.min(1, (now - job.start) / job.duration), k = t * t * (3 - 2 * t);
      eye.lerpVectors(job.eye, job.to.eye, k); target.lerpVectors(job.target, job.to.target, k);
      if (t === 1) { const resolve = job.resolve; job = null; resolve(); }
    }
    camera.position.copy(eye); camera.lookAt(target); camera.updateMatrixWorld(); renderer.info.reset(); renderer.render(scene, camera); frames++;
    onFrame?.(stations.map(s => { const p = new T.Vector3(...s.position); p.y += 2; p.project(camera); return { x: (p.x + 1) * .5 * width, y: (1 - p.y) * .5 * height, visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < .95 && Math.abs(p.y) < .94 }; }));
  }
  function frame(now) { raf = 0; if (disposed || document.hidden || suspended) return; render(now); if (job) invalidate(); }
  function invalidate() { if (!disposed && !document.hidden && !suspended && !raf) { if (still) render(); else raf = requestAnimationFrame(frame); } }
  function resize() {
    width = host.clientWidth; height = host.clientHeight; if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 760 ? 1.5 : 2)); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!job) { const p = preset(view); eye.copy(p.eye); target.copy(p.target); } invalidate();
  }
  function show(next, animate = true) {
    view = next; actors.visible = view === 'space'; bots.forEach(b => b.visible = mode === 'agent');
    const to = preset(view); job?.resolve(); job = null;
    if (still || reduced.matches || !animate) { eye.copy(to.eye); target.copy(to.target); invalidate(); return Promise.resolve(); }
    return new Promise(resolve => { job = { start: null, duration: 1600, eye: eye.clone(), target: target.clone(), to, resolve }; invalidate(); });
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else invalidate(); }, { signal: abort.signal });
  resize(); renderer.compile(scene, camera); render();
  return {
    show, resize,
    setMode(value) { mode = value; bots.forEach(b => b.visible = value === 'agent'); person.position.set(value === 'agent' ? -3.3 : -1.2, .3, value === 'agent' ? 2.7 : -4); invalidate(); },
    pause(value) { suspended = value; if (value) { cancelAnimationFrame(raf); raf = 0; } else { resize(); invalidate(); } },
    stats: () => ({ frames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), view, mode, moving: !!job, canvasCount: host.querySelectorAll('canvas').length }),
    destroy() { if (disposed) return; disposed = true; cancelAnimationFrame(raf); job?.resolve(); abort.abort(); ro.disconnect(); key.shadow.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}
