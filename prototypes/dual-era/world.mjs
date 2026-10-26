import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const NODES = { source: [-6, 0, 3], relay: [-1, 0, -3], verify: [0, 0, 5], receiver: [6, 0, -1], console: [-6, 0, 8] };

export async function createWorld(host, { onPick, onFrame, instant = false } = {}) {
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#172128'); scene.fog = new T.Fog('#172128', 25, 65);
  const camera = new T.PerspectiveCamera(43, 1, .2, 100);
  host.append(renderer.domElement);
  const resources = new Set(), materials = [];
  const mat = (opts) => { const m = new T.MeshStandardMaterial(opts); materials.push(m); return m; };
  const floorMat = mat({ color: '#34434c', roughness: 1, metalness: .05 });
  const structureMat = mat({ color: '#70818a', roughness: .8, metalness: .1 });
  const darkMat = mat({ color: '#26333b', roughness: .9 });
  const edgeMat = mat({ color: '#a18b78', roughness: .8 });
  const pools = new Map();
  const addStatic = (g, material, x, y, z, rotation = 0) => {
    g.rotateY(rotation); g.translate(x, y, z); if (!pools.has(material)) pools.set(material, []); pools.get(material).push(g);
  };
  const box = (x, y, z, w, h, d, material = structureMat, rotation = 0) => addStatic(new T.BoxGeometry(w, h, d), material, x, y, z, rotation);
  box(0, -.3, 1, 18, .55, 17, floorMat);
  for (let x = -8; x <= 8; x += 4) { box(x, 0, -7.3, .15, .08, .8, edgeMat); box(x, -.01, 9, .08, .04, .7, edgeMat); }
  // Six working sites, not a row of identical chapter doors.
  box(-6, .4, 3, 1.7, .8, 1.7); box(-6, 1.18, 3, .75, .8, .75, darkMat);
  addStatic(new T.CylinderGeometry(.2, .3, 2.2, 6), structureMat, -6, 2.1, 3);
  box(-1, .25, -3, 2.6, .5, 2); box(-1.8, 1.3, -3, .3, 1.8, .4); box(-.2, 1.3, -3, .3, 1.8, .4); box(-1, 2.1, -3, 1.9, .3, .4);
  box(0, .6, 5, 2.4, 1.2, 1.8, darkMat); box(0, 1.22, 5, 2.5, .12, 2); box(0, 1.6, 5.55, 1.5, .7, .15);
  box(6, .3, -1, 2.2, .6, 2.2); box(6, 1.4, -1, .5, 1.7, .5); addStatic(new T.CylinderGeometry(.7, .7, .12, 8), edgeMat, 6, 2.4, -1);
  box(-6, .55, 8, 2.5, 1.1, 1.2, darkMat); box(-6, 1.3, 8, 2.3, .15, 1.5);
  // An open, deliberately unfinished perimeter. Distant masses retain no readable detail.
  box(-8.4, 1.2, 0, .25, 2.4, 3); box(8.4, 1.2, 2, .25, 2.4, 3);
  for (let i = 0; i < 5; i++) box(-14 + i * 7, 1 + i % 2, -21 - (i % 3) * 5, 5 + i % 2, 3 + i % 3, 6, darkMat, i * .37);
  for (const [material, geometries] of pools) {
    const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); resources.add(geometry);
    const mesh = new T.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
  scene.add(new T.HemisphereLight('#b7cbd8', '#26313b', 2));
  const key = new T.DirectionalLight('#ffe2c5', 2.8); key.position.set(-7, 16, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 }); key.shadow.normalBias = .04; scene.add(key);
  const accent = mat({ color: '#df8b5a', roughness: .6, emissive: '#3b1b0e', emissiveIntensity: .3 });
  const actorDark = mat({ color: '#25333c', roughness: .8 });
  const actorBright = mat({ color: '#b3c0c7', roughness: .6 });
  function actor(human) {
    const group = new T.Group(), parts = [];
    if (human) {
      parts.push(new T.CylinderGeometry(.24, .21, .7, 6).translate(0, .95, 0));
      parts.push(new T.SphereGeometry(.21, 8, 6).translate(0, 1.55, 0));
      for (const x of [-.14, .14]) parts.push(new T.BoxGeometry(.17, .6, .2).translate(x, .35, 0));
    } else {
      parts.push(new T.BoxGeometry(.75, .48, .65).translate(0, .5, 0));
      parts.push(new T.BoxGeometry(.42, .25, .35).translate(0, .87, 0));
      for (const x of [-.42, .42]) parts.push(new T.BoxGeometry(.15, .23, .64).translate(x, .24, 0));
    }
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); resources.add(geo);
    const body = new T.Mesh(geo, human ? actorBright : actorDark); body.castShadow = true; group.add(body);
    const visorGeo = new T.BoxGeometry(human ? .22 : .38, .09, .06); resources.add(visorGeo);
    const visor = new T.Mesh(visorGeo, accent); visor.position.set(0, human ? 1.55 : .87, .2); group.add(visor);
    scene.add(group); return group;
  }
  const person = actor(true), bots = [actor(false), actor(false), actor(false)];
  person.position.fromArray(NODES.console); bots.forEach((b, i) => b.position.set(-5 + i * 1.3, 0, 6.8));
  const lines = [], lineMaterials = [];
  function route(points) {
    const geometry = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(...p).add(new T.Vector3(0, .09, 0)))); resources.add(geometry);
    const material = new T.LineDashedMaterial({ color: '#82959f', dashSize: .32, gapSize: .2 }); lineMaterials.push(material);
    const line = new T.Line(geometry, material); line.computeLineDistances(); scene.add(line); lines.push(line); return line;
  }
  route([NODES.source, NODES.relay, NODES.receiver]); route([NODES.source, NODES.verify, NODES.receiver]);
  const markerGeo = new T.BoxGeometry(.16, .12, 1.1); resources.add(markerGeo);
  const rejected = new T.Group();
  for (const angle of [-Math.PI / 4, Math.PI / 4]) { const m = new T.Mesh(markerGeo, accent); m.rotation.y = angle; rejected.add(m); }
  rejected.position.set(2.5, .16, -2); rejected.visible = false; scene.add(rejected);
  const beaconGeo = new T.CylinderGeometry(.12, .12, .22, 8); resources.add(beaconGeo);
  const beacon = new T.Mesh(beaconGeo, accent); beacon.position.set(6, 2.65, -1); scene.add(beacon);
  const rig = { eye: new T.Vector3(20, 9, 22), target: new T.Vector3(0, 0, 0) };
  let width = 1, height = 1, raf = 0, last = 0, destroyed = false, paused = false, entered = false, mode = 'human', transitionJob = null, actorJob = null, serial = 0, running = false;
  const frameTimes = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const fallbackView = () => { const narrow = width / height < 1; return { eye: new T.Vector3(narrow ? 28 : 15, narrow ? 32 : 16, narrow ? 36 : 20), target: new T.Vector3(0, 0, 1) }; };
  function resize() {
    width = host.clientWidth; height = host.clientHeight; if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.5 : 2)); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    if (entered && !transitionJob) { const v = fallbackView(); rig.eye.copy(v.eye); rig.target.copy(v.target); }
    invalidate();
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  const smooth = t => t * t * (3 - 2 * t);
  function tweenTo(view, duration = .8) {
    if (destroyed) return Promise.resolve();
    transitionJob?.resolve();
    if (reduced.matches || instant) {
      transitionJob = null; rig.eye.copy(view.eye); rig.target.copy(view.target); updateCamera(performance.now()); invalidate(); return Promise.resolve();
    }
    return new Promise(resolve => { transitionJob = { start: 0, duration: reduced.matches || instant ? 0 : duration, eye: rig.eye.clone(), target: rig.target.clone(), to: view, resolve }; invalidate(); });
  }
  function updateCamera(now) {
    if (transitionJob) {
      const j = transitionJob; j.start ||= now;
      const t = j.duration === 0 ? 1 : Math.min(1, (now - j.start) / (1000 * j.duration));
      rig.eye.lerpVectors(j.eye, j.to.eye, smooth(t)); rig.target.lerpVectors(j.target, j.to.target, smooth(t));
      if (t === 1) { transitionJob = null; j.resolve(); }
    }
    camera.position.copy(rig.eye); camera.lookAt(rig.target); camera.updateMatrixWorld();
  }
  function updateActors(now) {
    if (!actorJob) return;
    const j = actorJob; j.start ||= now;
    const t = reduced.matches || instant ? 1 : Math.min(1, (now - j.start) / (j.duration * 1000));
    j.moves.forEach(m => {
      m.actor.position.lerpVectors(m.from, m.to, smooth(t));
      const delta = m.to.clone().sub(m.from); if (delta.lengthSq() > .01) m.actor.rotation.y = Math.atan2(delta.x, delta.z);
    });
    if (t === 1) { actorJob = null; j.resolve(); }
  }
  function render(now) {
    updateCamera(now); updateActors(now);
    renderer.info.reset(); renderer.render(scene, camera); serial++;
    onFrame?.({ project: projectNode, info: stats() });
  }
  function frame(now) {
    raf = 0; if (destroyed || paused || document.hidden) return;
    if (last && (transitionJob || actorJob)) frameTimes.push(Math.min(1000, now - last)); last = now;
    render(now); if (transitionJob || actorJob) invalidate(); else { last = 0; running = false; }
  }
  function invalidate() {
    if (destroyed || paused || document.hidden) return;
    if (instant) { render(performance.now()); running = false; return; }
    if (!raf) { running = true; raf = requestAnimationFrame(frame); }
  }
  function projectNode(name) {
    const p = new T.Vector3(...NODES[name]); p.y = name === 'relay' ? 2.5 : name === 'receiver' ? 2.9 : 1.8;
    p.project(camera); return { x: (p.x * .5 + .5) * width, y: (-p.y * .5 + .5) * height, visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05 };
  }
  const pickObjects = [];
  const pickGeo = new T.BoxGeometry(2.5, 2.5, 2.5); resources.add(pickGeo);
  const pickMat = new T.MeshBasicMaterial({ visible: false }); materials.push(pickMat);
  for (const [name, pos] of Object.entries(NODES)) { const proxy = new T.Mesh(pickGeo, pickMat); proxy.position.fromArray(pos); proxy.position.y = 1; proxy.userData.node = name; scene.add(proxy); pickObjects.push(proxy); }
  const raycaster = new T.Raycaster();
  renderer.domElement.addEventListener('click', event => {
    const rect = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(pickObjects)[0]; if (hit) onPick?.(hit.object.userData.node);
  }, { signal: listeners.signal });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); paused = true; cancelAnimationFrame(raf); raf = 0; onPick?.('__lost'); }, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; running = false; } else invalidate(); }, { signal: listeners.signal });
  function stats() {
    const sorted = frameTimes.slice(-180).sort((a, b) => a - b);
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), frames: serial, running, p95: sorted.length ? sorted[Math.floor((sorted.length - 1) * .95)] : null };
  }
  function setTask(task) {
    mode = task.mode;
    person.visible = true; if (mode === 'agent') person.position.fromArray(NODES.console);
    bots.forEach(b => b.visible = mode === 'agent');
    rejected.visible = task.evidence.interface?.pass === false;
    lines.forEach(l => { l.visible = !!task.candidate; l.material.color.set(task.accepted ? '#ffc18c' : '#82959f'); l.material.gapSize = task.accepted ? 0 : .2; l.material.needsUpdate = true; });
    beacon.material = task.accepted ? accent : darkMat;
    invalidate();
  }
  async function perform(type, node = 'relay') {
    if (destroyed) return;
    actorJob?.resolve();
    const at = (actor, name, offset = 1.3) => ({ actor, to: new T.Vector3(...NODES[name]).add(new T.Vector3(offset, 0, 1)) });
    const humanDecisions = ['SURVEY', 'DEPLOY', 'ENV_CHANGE'];
    const moves = mode === 'human' ? [at(person, node, 1.5)]
      : humanDecisions.includes(type) ? [at(person, 'console', 1.5)]
      : type === 'FIX' ? [at(bots[0], 'relay')]
      : bots.map((b, i) => at(b, ['relay', 'verify', 'receiver'][i]));
    if (mode === 'human') { const target = new T.Vector3(...NODES[node]); await tweenTo({ eye: target.clone().add(new T.Vector3(8, 7, 10)), target }, .45); }
    if (destroyed) return;
    if (reduced.matches || instant) { actorJob = null; moves.forEach(m => m.actor.position.copy(m.to)); invalidate(); return; }
    await new Promise(resolve => { actorJob = { start: 0, duration: type === 'BUILD' ? 1.2 : .65, moves: moves.map(m => ({ ...m, from: m.actor.position.clone() })), resolve }; invalidate(); });
  }
  function destroy() {
    if (destroyed) return null; destroyed = true; cancelAnimationFrame(raf); raf = 0; running = false;
    transitionJob?.resolve(); actorJob?.resolve(); transitionJob = null; actorJob = null;
    listeners.abort(); ro.disconnect();
    key.shadow.dispose(); resources.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); lineMaterials.forEach(m => m.dispose());
    const memory = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    return { ...memory, contextLost: renderer.getContext().isContextLost(), canvasDetached: !renderer.domElement.isConnected };
  }
  resize(); updateCamera(performance.now());
  try { if (instant) renderer.compile(scene, camera); else await renderer.compileAsync(scene, camera); } catch (error) { destroy(); throw error; }
  render(performance.now());
  return { setTask, perform, stats, destroy, enter: () => { entered = true; return tweenTo(fallbackView(), 1.2); }, overview: () => tweenTo(fallbackView()), focus: node => { const target = new T.Vector3(...NODES[node]); return tweenTo({ eye: target.clone().add(new T.Vector3(8, 7, 10)), target }); }, pause: value => { paused = value; if (value) { cancelAnimationFrame(raf); raf = 0; running = false; last = 0; } else invalidate(); }, resize };
}
