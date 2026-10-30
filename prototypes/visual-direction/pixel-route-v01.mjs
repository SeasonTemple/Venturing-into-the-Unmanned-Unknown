const manifest = await fetch('pixel-route-v01/manifest.json').then(response => {
  if (!response.ok) throw new Error('路线清单读取失败');
  return response.json();
});

const scene = document.querySelector('#scene');
const actor = document.querySelector('#actor');
const panel = document.querySelector('#route-panel');
const status = document.querySelector('#status');
const position = document.querySelector('#position');
const mode = document.querySelector('#mode');
const facing = document.querySelector('#facing');
const frameText = document.querySelector('#frame');
const pauseButton = document.querySelector('#pause');
const reducedInput = document.querySelector('#reduced');
const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');

const walkImages = await Promise.all(manifest.walk.frames.map(frame => loadImage(frame.file)));
const turnImages = await Promise.all(manifest.turn.frames.map(frame => loadImage(frame.file)));
const stops = Object.fromEntries(manifest.stops.map(stop => [stop.id, stop]));
const walkContactFrames = new Set([0, 4]);
const state = {
  x: manifest.scene.startX,
  target: null,
  mode: 'idle',
  facing: 'left',
  frameIndex: 0,
  distanceSinceFrame: 0,
  stopRequested: false,
  manualHeld: false,
  pendingTurn: null,
  turnFrames: [],
  turnCursor: 0,
  turnClock: 0,
  paused: false,
  reduced: systemReduced.matches,
  ready: true,
  skipped: false
};
let raf = 0;
let previous = 0;
let lastStatus = '';
let lastFrame = '';
let renders = 0;

reducedInput.checked = state.reduced;

function loadImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  return image.decode().then(() => image);
}

function setStatus(text) {
  if (text !== lastStatus) {
    status.textContent = text;
    lastStatus = text;
  }
}

function currentStop() {
  return manifest.stops.reduce((closest, stop) => Math.abs(stop.x - state.x) < Math.abs(closest.x - state.x) ? stop : closest, manifest.stops[0]);
}

function modeLabel() {
  return ({idle:'停稳', manual:'手动行进', auto:'自动行进', turn:'转身', paused:'已暂停'})[state.mode] || state.mode;
}

function render() {
  const width = scene.clientWidth;
  const height = scene.clientHeight;
  if (!width || !height) return;
  renders += 1;
  const scale = (width / manifest.scene.width) * 1.78;
  const spriteWidth = Math.round(128 * scale);
  const spriteHeight = Math.round(196 * scale);
  const baseline = Math.round(height * manifest.scene.groundRatio);
  const left = Math.round(state.x * width - spriteWidth / 2);
  const top = Math.round(baseline - 183 * scale);
  actor.style.width = `${spriteWidth}px`;
  actor.style.height = `${spriteHeight}px`;
  actor.style.left = `${left}px`;
  actor.style.top = `${top}px`;
  const image = state.mode === 'turn' ? turnImages[state.turnFrames[state.turnCursor]] : walkImages[state.reduced ? 0 : state.frameIndex];
  const frame = state.mode === 'turn' ? manifest.turn.frames[state.turnFrames[state.turnCursor]] : manifest.walk.frames[state.reduced ? 0 : state.frameIndex];
  const key = `${state.mode}:${state.turnCursor}:${state.frameIndex}:${state.reduced}`;
  if (lastFrame !== key) {
    actor.src = image.src;
    actor.alt = `${frame.label}，左侧像素人物。`;
    frameText.textContent = state.mode === 'turn' ? `${state.turnCursor + 1} / ${frame.label}` : `${state.frameIndex + 1} / ${frame.label}`;
    lastFrame = key;
  }
  position.textContent = currentStop().label;
  mode.textContent = modeLabel();
  facing.textContent = state.facing === 'left' ? '左侧' : '正面';
  for (const button of document.querySelectorAll('[data-target]')) {
    const target = stops[button.dataset.target];
    button.disabled = state.facing !== 'left' || state.mode === 'turn' || target.x >= state.x - 0.01;
  }
  for (const button of document.querySelectorAll('[data-stop]')) {
    button.setAttribute('aria-current', Math.abs(stops[button.dataset.stop].x - state.x) < 0.018 ? 'true' : 'false');
  }
}

function canTick() {
  return state.ready && !state.paused && !state.skipped && !document.hidden;
}

function schedule() {
  if (canTick() && !raf) raf = requestAnimationFrame(tick);
}

function haltClock() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  previous = 0;
}

function setIdle(message = '停稳，可选择左侧停点或聚焦后按住 ←。') {
  const queuedTurn = state.pendingTurn;
  state.mode = 'idle';
  state.target = null;
  state.stopRequested = false;
  state.manualHeld = false;
  state.pendingTurn = null;
  state.frameIndex = walkContactFrames.has(state.frameIndex) ? state.frameIndex : 0;
  setStatus(message);
  render();
  haltClock();
  if (queuedTurn) beginTurn(queuedTurn);
}

function beginMove(kind, target = null) {
  if (state.facing !== 'left') {
    setStatus('当前朝向正面；先按 → 或“转身”回到左侧，才继续沿路行进。');
    return;
  }
  if (state.reduced) {
    state.x = target === null ? Math.max(manifest.scene.minX, state.x - 0.12) : target;
    state.frameIndex = 0;
    setIdle('减少动态：已将人物放到目标停点。');
    return;
  }
  state.mode = kind;
  state.target = target;
  state.stopRequested = false;
  state.distanceSinceFrame = 0;
  setStatus(kind === 'auto' ? '自动行进中；按住 ← 可立即接管。' : '手动行进中；松开 ← 在落脚时收步。');
  render();
  schedule();
}

function requestStop() {
  if (state.mode !== 'manual' && state.mode !== 'auto') return;
  state.stopRequested = true;
  if (walkContactFrames.has(state.frameIndex) && state.distanceSinceFrame > 0.01) setIdle('已在落脚处收步。');
  else setStatus('收步请求已记录，等下一次落脚。');
}

function beginTurn(to = state.facing === 'left' ? 'front' : 'left') {
  if (state.mode === 'turn') return;
  state.mode = 'turn';
  state.target = null;
  state.pendingTurn = to;
  state.turnFrames = to === 'front' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  state.turnCursor = 0;
  state.turnClock = 0;
  setStatus(to === 'front' ? '转身到正面；右向完整步态仍待另行绘制。' : '转回左侧；可继续沿维护路行进。');
  render();
  schedule();
}

function finishTurn() {
  state.facing = state.pendingTurn;
  state.pendingTurn = null;
  state.mode = 'idle';
  state.frameIndex = 0;
  setStatus(state.facing === 'front' ? '已转向正面；右向步态资产未制作，当前停在这里。' : '已转回左侧，可继续沿维护路行进。');
  render();
  haltClock();
}

function stepWalk(dt) {
  const target = state.target === null ? manifest.scene.minX : state.target;
  const distance = Math.min(manifest.scene.speed * dt, Math.max(0, state.x - target));
  state.x -= distance;
  state.distanceSinceFrame += distance;
  if (state.distanceSinceFrame >= manifest.scene.speed / manifest.walk.fps) {
    state.distanceSinceFrame = 0;
    state.frameIndex = (state.frameIndex + 1) % manifest.walk.frames.length;
  }
  if (state.x <= target + 0.0005 || (state.stopRequested && walkContactFrames.has(state.frameIndex))) {
    state.x = state.x <= target + 0.0005 ? target : state.x;
    setIdle(state.stopRequested ? '已在落脚处收步。' : '已抵达停点，保留当前位置。');
  }
}

function tick(now) {
  raf = 0;
  if (!canTick()) { previous = 0; return; }
  const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
  previous = now;
  if (state.mode === 'turn') {
    state.turnClock += dt;
    const interval = 1 / manifest.turn.fps;
    if (state.turnClock >= interval) {
      state.turnClock = 0;
      state.turnCursor += 1;
      if (state.turnCursor >= state.turnFrames.length) { finishTurn(); return; }
    }
  } else if (state.mode === 'manual' || state.mode === 'auto') {
    stepWalk(dt);
  }
  render();
  schedule();
}

function targetFromPointer(event) {
  const rect = scene.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const candidate = manifest.stops.filter(stop => stop.x < state.x - 0.01).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  if (candidate) beginMove('auto', candidate.x);
  else setStatus('这里只接受人物左侧的维护路停点；返回方向等右向帧完成后再开放。');
}

scene.addEventListener('click', event => {
  if (event.target.closest('button')) return;
  if (state.mode !== 'turn') targetFromPointer(event);
  scene.focus({preventScroll: true});
});
scene.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (state.facing !== 'left') { if (!event.repeat) beginTurn('left'); return; }
    if (event.repeat && state.mode === 'manual') { state.manualHeld = true; return; }
    state.manualHeld = true;
    beginMove('manual');
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (!event.repeat && state.mode === 'idle') beginTurn();
    else if (state.mode === 'manual' || state.mode === 'auto') { state.pendingTurn = 'front'; requestStop(); }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    requestStop();
  } else if (event.key === ' ') {
    event.preventDefault();
    if (!event.repeat) pauseButton.click();
  }
});
window.addEventListener('keyup', event => {
  if (event.key === 'ArrowLeft' && state.manualHeld) { state.manualHeld = false; requestStop(); }
});
scene.addEventListener('blur', () => { if (state.manualHeld) requestStop(); });
document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => { beginMove('auto', stops[button.dataset.target].x); scene.focus({preventScroll: true}); }));
document.querySelectorAll('[data-stop]').forEach(button => button.addEventListener('click', () => { beginMove('auto', stops[button.dataset.stop].x); scene.focus({preventScroll: true}); }));
document.querySelector('#stop').addEventListener('click', requestStop);
document.querySelector('#turn').addEventListener('click', () => { if (state.mode === 'idle') { beginTurn(); scene.focus({preventScroll: true}); } });
document.querySelector('#reset').addEventListener('click', () => { haltClock(); state.x = manifest.scene.startX; state.facing = 'left'; state.frameIndex = 0; state.mode = 'idle'; state.paused = false; state.target = null; pauseButton.setAttribute('aria-pressed', 'false'); setStatus('已回到观测站门前。'); render(); });
pauseButton.addEventListener('click', () => { state.paused = !state.paused; pauseButton.textContent = state.paused ? '继续' : '暂停'; pauseButton.setAttribute('aria-pressed', String(state.paused)); setStatus(state.paused ? '已暂停；位置和时间都被冻结。' : '继续当前路线。'); if (state.paused) haltClock(); else schedule(); render(); });
reducedInput.addEventListener('change', () => { state.reduced = reducedInput.checked; haltClock(); if (state.reduced) { state.frameIndex = 0; if (state.mode === 'manual' || state.mode === 'auto') setIdle('减少动态已开启；请重新选择停点。'); } render(); });
systemReduced.addEventListener('change', event => { reducedInput.checked = event.matches; reducedInput.dispatchEvent(new Event('change')); });
window.addEventListener('resize', render);
window.addEventListener('blur', () => { if (state.manualHeld) requestStop(); haltClock(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) haltClock(); else schedule(); });
new IntersectionObserver(([entry]) => { state.skipped = !entry.isIntersecting; if (state.skipped) haltClock(); else schedule(); }, {rootMargin:'120px'}).observe(panel);
panel.addEventListener('contentvisibilityautostatechange', event => { state.skipped = event.skipped; if (state.skipped) haltClock(); else schedule(); });

render();
window.pixelRoute = Object.freeze({ snapshot: () => ({...state, status: lastStatus, renders, resources: walkImages.length + turnImages.length + 1}) });
