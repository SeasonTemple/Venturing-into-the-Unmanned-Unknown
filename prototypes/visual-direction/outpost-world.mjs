import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Work areas have different elevations and volumes along one connected structure.
export const stations = [
  ['意图', 'ch1', -6.4, .84, 2.5], ['设计', 'ch2', -4.8, 1.75, -1.9],
  ['验证', 'ch3', -.5, 1.08, .8], ['实现', 'ch4', 1.5, 1.44, 3.6],
  ['交付', 'ch6', 4.2, 2.2, -1.6], ['演进', 'ch7', 7.5, 2.48, 1.8],
].map(([title, chapter, x, y, z], index) => ({ title, chapter, index, position: [x, y, z] }));

export function createWorld(host, { onFrame, still = false } = {}) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color('#111e24');
  const camera = new T.OrthographicCamera(-14, 14, 10, -10, .1, 140);
  const field = new T.Group(); scene.add(field);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const own = g => (geometries.add(g), g);
  const material = opts => { const m = new T.MeshStandardMaterial(opts); materials.add(m); return m; };
  const noise = document.createElement('canvas'); noise.width = noise.height = 128;
  const ctx = noise.getContext('2d'), pixels = ctx.createImageData(128, 128);
  let seed = 29;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = 112 + (seed / 4294967296) * 108;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = n; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const grain = new T.CanvasTexture(noise); grain.wrapS = grain.wrapT = T.RepeatWrapping; grain.repeat.set(4, 4); textures.add(grain);
  const mineral = material({ color: '#9daea7', roughness: .79, roughnessMap: grain, bumpMap: grain, bumpScale: .045 });
  const cut = material({ color: '#6c7c7b', roughness: .91, bumpMap: grain, bumpScale: .035 });
  const steel = material({ color: '#34474e', metalness: .65, roughness: .49 });
  const dark = material({ color: '#203039', metalness: .3, roughness: .74 });
  const copper = material({ color: '#b58b58', metalness: .6, roughness: .47 });
  const paper = material({ color: '#d5d2bc', roughness: .75 });
  const batches = new Map();
  function add(g, mat, p = [0, 0, 0], r = [0, 0, 0]) {
    if (g.index) { const source = g; g = g.toNonIndexed(); source.dispose(); }
    const m = new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromEuler(new T.Euler(...r)), new T.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(g);
  }
  const box = (w, h, d, p, mat = mineral, r = [0, 0, 0], bevel = .025) =>
    add(bevel ? new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 5, h / 5, d / 5)) : new T.BoxGeometry(w, h, d), mat, p, r);
  function beam(a, b, radius = .035, mat = steel) {
    const av = new T.Vector3(...a), bv = new T.Vector3(...b), v = bv.clone().sub(av);
    const g = new T.CylinderGeometry(radius, radius, v.length(), 8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()));
    add(g, mat, av.add(bv).multiplyScalar(.5).toArray());
  }
  function flight(x, z, y, count, rise, tread, width, direction = 1) {
    for (let i = 0; i < count; i++) box(width, .1, tread + .025, [x, y + i * rise, z + direction * i * tread], mineral);
  }
  function rail(a, b, y, height = .45) {
    beam([a[0], y + height, a[1]], [b[0], y + height, b[1]], .018, copper);
    for (let i = 0; i <= 3; i++) {
      const x = T.MathUtils.lerp(a[0], b[0], i / 3), z = T.MathUtils.lerp(a[1], b[1], i / 3);
      beam([x, y, z], [x, y + height, z], .016);
    }
  }
  // A thick, cut base carries separate volumes rather than a single display disc.
  box(5.5, .65, 5.7, [-5.8, .04, .6], cut, [0, 0, 0], .06);
  box(5.7, .5, 3.2, [-.4, .12, .2], cut, [0, 0, 0], .06);
  box(4.4, .46, 3.5, [1.4, .25, 3.5], dark, [0, 0, 0], .04);
  for (let i = 0; i < 8; i++) box(.025, .38, 5.72, [-8.2 + i * .61, .05, .6], dark, [0, 0, 0], 0);
  // 01: intent — an open alcove and a single clear working plane.
  box(4.2, .18, 3.3, [-6.4, .73, 2.5]);
  box(.22, 3.6, 3.3, [-8.36, 2.62, 2.5]);
  box(3.2, .18, 3.3, [-6.9, 4.34, 2.5]);
  box(1.9, .12, .95, [-6.4, 1.55, 2.35], paper);
  box(.1, .72, .82, [-7.15, 1.15, 2.35], steel);
  box(.1, .72, .82, [-5.65, 1.15, 2.35], steel);
  for (let i = 0; i < 3; i++) box(.32, .014, .6, [-6.9 + i * .48, 1.62, 2.35], copper, [0, 0, 0], 0);
  rail([-8.3, 4.1], [-4.4, 4.1], .84);
  // 02: design — a raised interface bridge with exposed supports and paired rails.
  box(4.4, .18, 2, [-4.9, 1.64, -1.9]);
  for (const x of [-6.55, -3.25]) box(.17, 1.4, 1.65, [x, .89, -1.9], steel);
  box(4.45, .12, .13, [-4.9, 1.46, -2.65], copper);
  box(4.45, .12, .13, [-4.9, 1.46, -1.15], copper);
  rail([-7.1, -2.86], [-2.7, -2.86], 1.74);
  flight(-6.4, 1.03, .9, 7, .125, .29, 1.25, -1);
  // 03: verification — the slit is a real gap between two solid walls.
  box(4.7, .17, 3.8, [-.5, .98, .8]);
  box(1.7, 4.6, .24, [-1.48, 3.35, -.72]);
  box(1.7, 4.6, .24, [.48, 3.35, -.72]);
  box(.28, .18, .24, [-.5, 5.56, -.72], copper);
  box(2.5, .13, 1.1, [-3.55, .92, 1.5], mineral, [0, 0, .095]);
  for (const y of [2.05, 3.6, 5.12]) {
    box(1.65, .012, .007, [-1.48, y, -.596], steel, [0, 0, 0], 0);
    box(1.65, .012, .007, [.48, y, -.596], steel, [0, 0, 0], 0);
  }
  for (let i = 0; i < 9; i++) box(i % 4 === 0 ? .13 : .07, .012, .008, [-.76, 1.7 + i * .37, -.592], copper, [0, 0, 0], 0);
  box(2.6, .09, 1.5, [-.5, 1.2, 1.03], paper);
  for (const x of [-1.3, .3]) box(.025, .006, 1.5, [x, 1.25, 1.03], copper, [0, 0, 0], 0);
  box(2.3, .025, .025, [-.5, 1.26, 1.58], copper, [0, 0, 0], 0);
  // A bridge genuinely joins design to the inspection floor.
  box(1.4, .13, 1.1, [-2.25, 1.45, -1.36], steel, [0, 0, -.25]);
  // 04: implementation — a larger open workshop with a ribbed canopy.
  box(3.5, .17, 2.9, [1.4, 1.33, 3.6]);
  box(.18, 2.25, 2.9, [3.05, 2.53, 3.6], cut);
  box(.16, 2.25, .18, [-.27, 2.53, 4.9], steel);
  box(.16, 2.25, .18, [-.27, 2.53, 2.25], steel);
  for (let i = 0; i < 7; i++) box(3.5, .1, .16, [1.4, 3.68, 2.3 + i * .43], steel);
  for (let i = 0; i < 3; i++) {
    box(.62, .28 + i * .14, 1.4, [.3 + i * .85, 1.6 + i * .07, 3.6], i === 2 ? copper : mineral);
    box(.46, .025, .92, [.3 + i * .85, 1.76 + i * .14, 3.6], paper);
  }
  box(1.7, .12, .9, [-.75, 1.24, 2.64], mineral, [0, -.45, 0]);
  // 05: delivery — a cantilever and its load-carrying triangulation.
  box(5.1, .17, 2.05, [4.0, 2.1, -1.6]);
  for (const z of [-2.35, -.85]) {
    beam([1.5, .4, z], [1.5, 2.02, z], .055);
    beam([1.5, .4, z], [5.8, 2.02, z], .045);
    beam([3.8, 1.26, z], [3.8, 2.02, z], .035);
  }
  rail([1.5, -2.58], [6.5, -2.58], 2.2);
  for (let i = 0; i < 6; i++) box(.34, .1, 1.1, [1.5 + i * .34, 1.34 + i * .15, -.72], mineral);
  box(.1, 2.6, .1, [5.85, 3.48, -2.15], copper);
  box(.76, .08, .12, [5.85, 4.52, -2.15], steel);
  // 06: evolution — an observation deck ending in a visible, unclosed structure.
  box(2.4, .16, 2.8, [7.5, 2.39, 1.8]);
  box(.18, 2.25, .18, [6.5, 1.18, 2.8], steel);
  box(.18, 2.25, .18, [8.5, 1.18, 2.8], steel);
  box(1.05, .12, 2.15, [6.43, 2.27, -.1], steel, [-.1, -.3, 0]);
  rail([6.4, 3.1], [8.7, 3.1], 2.48);
  box(1.3, .11, 1.7, [9.35, 2.39, 1.8], steel);
  for (const z of [.9, 2.7]) {
    const height = z === .9 ? 2.7 : 1.4;
    box(.08, height, .08, [10.5, 2.43 + height / 2, z], steel);
    beam([9.96, 2.45, z], [10.5, 2.45, z], .035);
  }
  box(.08, .08, .9, [10.5, 5.1, 1.35], steel);
  // Etched route in the concrete; it remains a local, incomplete trace.
  const route = [new T.Vector3(-7, .84, 3), new T.Vector3(-5.4, .84, 3), new T.Vector3(-4.45, .84, 1.6),
    new T.Vector3(-2, 1.1, 1.6), new T.Vector3(.8, 1.1, 1.6), new T.Vector3(1.6, 1.44, 3),
    new T.Vector3(2.6, 1.44, 3), new T.Vector3(3.5, 2.2, -1.4), new T.Vector3(5.5, 2.2, -1.4),
    new T.Vector3(7.5, 2.48, 1.8), new T.Vector3(9.9, 2.48, 1.8)];
  // The angular trace keeps the interfaces legible and stops at the open end.
  const routeGeo = own(new T.BufferGeometry().setFromPoints(route));
  const routeMat = new T.LineBasicMaterial({ color: '#c5aa78', transparent: true, opacity: .68 }); materials.add(routeMat);
  field.add(new T.Line(routeGeo, routeMat));
  const wirePositions = [];
  for (let i = 0; i < 7; i++) {
    const x = 10.8 + i * .31;
    wirePositions.push(x, 2.48, .9, x + .13, 2.48, .9, x, 2.48, 2.7, x + .13, 2.48, 2.7);
  }
  const wireMat = new T.LineBasicMaterial({ color: '#7d969c', transparent: true, opacity: .35 }); materials.add(wireMat);
  const wireGeo = own(new T.BufferGeometry()); wireGeo.setAttribute('position', new T.Float32BufferAttribute(wirePositions, 3));
  field.add(new T.LineSegments(wireGeo, wireMat));
  for (const [mat, parts] of batches) {
    const g = own(mergeGeometries(parts)); parts.forEach(p => p.dispose());
    const mesh = new T.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; field.add(mesh);
  }
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .06); scene.environment = environment.texture; scene.environmentIntensity = .16;
  room.dispose(); pmrem.dispose();
  scene.add(new T.HemisphereLight('#b9d0da', '#18242a', .55));
  const key = new T.DirectionalLight('#eee7d8', 2.65); key.position.set(-9, 21, 9); key.target.position.set(0, 1, 0);
  key.castShadow = true; key.shadow.autoUpdate = false; key.shadow.needsUpdate = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -17, right: 17, top: 13, bottom: -13, near: 1, far: 60 });
  key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -.0002; key.shadow.normalBias = .025;
  scene.add(key, key.target);
  const slit = new T.SpotLight('#ffc77e', 1800, 20, .34, .35, 2);
  slit.position.set(-.5, 5.5, -5.4); slit.target.position.set(-.5, 1.2, 1.4);
  slit.castShadow = true; slit.shadow.mapSize.set(1024, 1024); slit.shadow.autoUpdate = false; slit.shadow.needsUpdate = true;
  slit.shadow.normalBias = .012; slit.shadow.bias = -.0001; scene.add(slit, slit.target);
  // A radial contact receiver visually anchors the section without an enclosing disc.
  const groundMat = new T.ShadowMaterial({ color: '#00070a', opacity: .2 }); materials.add(groundMat);
  groundMat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position.xy;');
    shader.fragmentShader = 'varying vec2 vGround;\n' + shader.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.a*=1.-smoothstep(5.,12.,length(vGround));\n#include <tonemapping_fragment>');
  };
  const ground = new T.Mesh(own(new T.PlaneGeometry(48, 36)), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -.32; ground.receiveShadow = true; scene.add(ground);
  // Detail is revealed through entry, without rebuilding the world or its actors.
  const actors = new T.Group(); field.add(actors); actors.visible = false;
  function actor(human, p) {
    const group = new T.Group(); group.position.fromArray(p);
    const parts = human ? [new T.CapsuleGeometry(.07, .25, 3, 7).translate(0, .27, 0), new T.SphereGeometry(.075, 8, 6).translate(0, .52, 0)] :
      [new RoundedBoxGeometry(.28, .15, .24, 1, .025).translate(0, .13, 0), new T.BoxGeometry(.12, .06, .13).translate(0, .24, 0)];
    const normalized = parts.map(g => { if (!g.index) return g; const converted = g.toNonIndexed(); g.dispose(); return converted; });
    const geo = own(mergeGeometries(normalized)); normalized.forEach(g => g.dispose());
    const mesh = new T.Mesh(geo, human ? paper : copper); mesh.castShadow = true; group.add(mesh); actors.add(group); return group;
  }
  const person = actor(true, [-6.7, .84, 3.3]);
  const bots = [actor(false, [-4.8, 1.75, -1.9]), actor(false, [.5, 1.44, 3.6]), actor(false, [4.2, 2.2, -1.6])];
  const markerMaterial = material({ color: '#e1bd7e', emissive: '#80532a', emissiveIntensity: .25, roughness: .5 });
  const marker = new T.Mesh(own(new T.TorusGeometry(.25, .013, 6, 32)), markerMaterial); marker.rotation.x = -Math.PI / 2; marker.visible = false; field.add(marker);
  let width = 1, height = 1, frames = 0, raf = 0, disposed = false, suspended = false, visible = true;
  let view = 'home', mode = 'agent', selected = 2, job = null, span = 28;
  const eye = new T.Vector3(), target = new T.Vector3(), abort = new AbortController();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const presets = name => width < 760 ?
    (name === 'home' ? { eye: new T.Vector3(25, 23, 14), target: new T.Vector3(.8, .1, .5), span: 18 } :
      { eye: new T.Vector3(16, 30, 20), target: new T.Vector3(.3, 1.5, .5), span: 21 }) :
    (name === 'home' ? { eye: new T.Vector3(19, 15, 25), target: new T.Vector3(-.6, 1.65, .1), span: 28 } :
      { eye: new T.Vector3(6, 23, 26), target: new T.Vector3(.1, 1.5, .3), span: 26 });
  function labels() {
    onFrame?.(stations.map(s => {
      const p = new T.Vector3(...s.position); p.y += s.index === 2 ? 4.8 : s.index === 1 && width < 760 ? 2.8 : 1.2; p.project(camera);
      return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2, visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < .95 && Math.abs(p.y) < .95 };
    }));
  }
  function draw(now = performance.now()) {
    if (disposed || suspended) return;
    if (job) {
      job.start ??= now;
      const k = Math.min(1, (now - job.start) / job.duration), ease = k * k * (3 - 2 * k);
      eye.lerpVectors(job.eye, job.to.eye, ease); target.lerpVectors(job.target, job.to.target, ease); span = T.MathUtils.lerp(job.span, job.to.span, ease);
      if (k === 1) { const done = job.resolve; job = null; done(); }
    }
    camera.left = -span / 2; camera.right = span / 2; camera.top = span / 2 * height / width; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); camera.position.copy(eye); camera.lookAt(target); camera.updateMatrixWorld();
    renderer.render(scene, camera); frames++; labels();
  }
  function allowed() { return !disposed && !suspended && !document.hidden && visible; }
  function schedule() {
    if (!allowed()) { cancelAnimationFrame(raf); raf = 0; return; }
    if (!raf) raf = requestAnimationFrame(now => { raf = 0; if (!allowed()) return; draw(now); if (job) schedule(); });
  }
  function settle(to) { eye.copy(to.eye); target.copy(to.target); span = to.span; }
  function resize() {
    width = host.clientWidth; height = host.clientHeight; if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, 1920 / width)); renderer.setSize(width, height, false);
    if (!job) settle(presets(view));
    if (allowed()) draw();
    if (job) schedule();
  }
  const resetShadows = () => { key.shadow.needsUpdate = slit.shadow.needsUpdate = true; };
  function show(next, animate = true) {
    view = next; actors.visible = next === 'space'; marker.visible = next === 'space'; resetShadows();
    bots.forEach(b => b.visible = mode === 'agent'); marker.position.fromArray(stations[selected].position); marker.position.y += .1;
    const to = presets(next); job?.resolve(); job = null;
    if (still || reduced.matches || !animate) { settle(to); draw(); return Promise.resolve(); }
    return new Promise(resolve => { job = { start: null, duration: 1800, eye: eye.clone(), target: target.clone(), span, to, resolve }; schedule(); });
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  const io = new IntersectionObserver(entries => { visible = entries[0].intersectionRatio >= .01; if (visible) { if (job) schedule(); else if (allowed()) draw(); } else schedule(); }, { threshold: .01 }); io.observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) schedule(); else if (job) schedule(); else if (allowed()) draw(); }, { signal: abort.signal });
  reduced.addEventListener('change', () => { if (reduced.matches && job) { const old = job; job = null; settle(old.to); old.resolve(); } schedule(); }, { signal: abort.signal });
  resize();
  return {
    show, resize,
    // Synchronous framebuffer evidence uses the same tone mapping as the canvas.
    sample({ slitLight = true } = {}) {
      if (disposed) throw Error('The world has been disposed');
      const previous = renderer.getRenderTarget(), oldLight = slit.visible;
      try {
        slit.visible = slitLight; resetShadows(); renderer.setRenderTarget(null); renderer.render(scene, camera);
        const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, raw = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
        const pixels = new Uint8Array(160 * 120 * 4);
        for (let y = 0; y < 120; y++) for (let x = 0; x < 160; x++) {
          const from = (Math.min(h - 1, Math.floor((y + .5) * h / 120)) * w + Math.min(w - 1, Math.floor((x + .5) * w / 160))) * 4, to = (y * 160 + x) * 4;
          pixels.set(raw.subarray(from, from + 4), to);
        }
        const workArea = [[-1.8, .28], [.8, .28], [.8, 1.78], [-1.8, 1.78]].map(([x, z]) => {
          const p = new T.Vector3(x, 1.25, z).project(camera); return { x: (p.x + 1) * 80, y: (p.y + 1) * 60 };
        });
        return { pixels, workArea };
      } finally { slit.visible = oldLight; renderer.setRenderTarget(previous); resetShadows(); }
    },
    select(index) { selected = index; marker.position.fromArray(stations[index].position); marker.position.y += .1; if (allowed()) draw(); },
    setMode(value) { mode = value; bots.forEach(b => b.visible = value === 'agent'); person.position.fromArray(value === 'agent' ? [-6.7, .84, 3.3] : [-1.4, 1.08, 1.9]); resetShadows(); if (allowed()) draw(); },
    pause(value) { suspended = value; if (value) schedule(); else { resize(); if (job) schedule(); } },
    stats: () => ({ frames, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      pixelRatio: renderer.getPixelRatio(), view, mode, selected, moving: !!job, canvasCount: host.querySelectorAll('canvas').length, art: 'engineering-section',
      areas: stations.length, elevationRange: 1.64, actorsVisible: actors.visible, loopScheduled: !!raf, slitLight: slit.visible }),
    destroy() {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf); raf = 0; job?.resolve(); job = null;
      abort.abort(); ro.disconnect(); io.disconnect(); key.shadow.dispose(); slit.shadow.dispose();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
