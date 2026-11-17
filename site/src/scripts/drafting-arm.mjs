// Hand-drawn articulated drafting arm for desktop component first-scroll placement.
// Strict guardrails:
// - Desktop fine-pointer viewports only (>= 981px, hover: hover, pointer: fine)
// - Respects prefers-reduced-motion, #motion-toggle, focused mode, and search modal
// - Zero WebGL / <canvas>, zero layout reads inside requestAnimationFrame
// - Excludes homepage hero (.landscape) and Assembly workbench (#workbench-section)

const SVG_NS = 'http://www.w3.org/2000/svg';
const DESKTOP_QUERY = '(min-width: 981px) and (hover: hover) and (pointer: fine)';
const REDUCED_QUERY = '(prefers-reduced-motion: no-preference)';
const MAX_CARRY = 3;
const MAX_TOTAL_RIGS = 5;
const WRIST_STANDOFF = 15;
const DIRS = ['right-high', 'left-low', 'right-crane', 'left-high', 'right-low', 'left-crane'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const minJerk = (t) => {
  const u = clamp(t, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
};
const deg = (rad) => (rad * 180) / Math.PI;
const fix = (n) => n.toFixed(1);

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function clearElementInlineStyles(el) {
  el.removeAttribute('data-arm-carrying');
  el.style.removeProperty('opacity');
  el.style.removeProperty('transform');
  el.style.removeProperty('transform-origin');
  el.style.removeProperty('will-change');
}

function markManaged(el, dir) {
  el.dataset.armManaged = 'true';
  el.dataset.armTarget = dir;
  el.classList.remove('mt-pre', 'mt-in');
  for (const child of el.querySelectorAll('[data-mt-reveal]')) {
    child.dataset.armManaged = 'true';
    child.classList.remove('mt-pre', 'mt-in');
  }
}

function collectTargets(mode, root) {
  const list = [];
  const seen = new Set();
  const push = (el, dir, opts = {}) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    markManaged(el, dir);
    list.push({
      el,
      dir,
      onDark: Boolean(opts.onDark),
      horizontalOnly: Boolean(opts.horizontalOnly),
    });
  };

  if (mode === 'home') {
    // Excludes .landscape hero scene and #workbench-section (owned by Assembly crew).
    push(root.querySelector('#install'), 'right-high');
    push(root.querySelector('#chapters .mt-grid-chapters'), 'left-high');
    push(root.querySelector('.mt-band .mt-path'), 'right-low', { onDark: true });
    push(root.querySelector('section[aria-labelledby="mt-h-art"] .mt-rows'), 'left-crane');
    push(root.querySelector('section[aria-labelledby="mt-h-agent"] .mt-rows'), 'right-crane');
    push(document.querySelector('.observatory-colophon'), 'left-high');
  } else if (mode === 'journal') {
    push(root.querySelector('#body > .chapter-lead'), 'left-high', { horizontalOnly: true });
    const nodes = root.querySelectorAll(
      '#body .field-plate, #body .expressive-code, #body .table-scroll, #body blockquote, .chapter-end .journal-pagination',
    );
    let idx = 0;
    for (const node of nodes) {
      push(node, DIRS[idx % DIRS.length]);
      idx++;
    }
  }
  return list;
}

function createRigVisual(rigNo, L1, L2, rect0, onDark, isFromLeft) {
  const group = svgEl('g', { class: onDark ? 'arm-task is-on-dark' : 'arm-task' });

  // Target registration corners, center crosshair reticle & locked stamp
  const slotGuide = svgEl('g', { class: 'arm-slot-guide', opacity: '0' });
  const w = Math.max(32, rect0.width);
  const h = Math.max(32, rect0.height);
  const tick = 16;
  const mx = w * 0.5;
  const my = h * 0.5;
  slotGuide.append(
    svgEl('rect', { class: 'arm-slot-box', x: 0, y: 0, width: fix(w), height: fix(h), rx: '3' }),
    svgEl('path', {
      class: 'arm-slot-corner',
      d: `M0 ${tick}V0H${tick} M${fix(w - tick)} 0H${fix(w)}V${tick} M0 ${fix(h - tick)}V${fix(h)}H${tick} M${fix(w - tick)} ${fix(h)}H${fix(w)}V${fix(h - tick)}`,
    }),
    svgEl('path', {
      class: 'arm-strut',
      d: `M${fix(mx - 12)} ${fix(my)}H${fix(mx + 12)} M${fix(mx)} ${fix(my - 12)}V${fix(my + 12)}`,
    }),
    svgEl('circle', { class: 'arm-arc', cx: fix(mx), cy: fix(my), r: '5.5' }),
    svgEl('text', { class: 'arm-label', x: '2', y: '-8' }, `RIG-0${rigNo} // LOCKED ±0.0mm`),
  );

  // Viewport bezel mounting turret at x = 0 (left) or x = vw (right)
  const bezel = svgEl('g', { class: 'arm-bezel' });
  const flipX = isFromLeft ? 1 : -1;
  bezel.append(
    svgEl('rect', { class: 'arm-cyl', x: fix(-2 * flipX - (isFromLeft ? 0 : 14)), y: '-34', width: '16', height: '68', rx: '2' }),
    svgEl('path', {
      class: 'arm-rail',
      d: `M0 -30H${fix(12 * flipX)}M0 30H${fix(12 * flipX)}M0 -10H${fix(16 * flipX)}M0 10H${fix(16 * flipX)}`,
    }),
    svgEl('circle', { class: 'arm-bolt', cx: fix(6 * flipX), cy: '-22', r: '2.2' }),
    svgEl('circle', { class: 'arm-bolt', cx: fix(6 * flipX), cy: '22', r: '2.2' }),
  );

  // Upper boom (1st rigid link): substantial tapered body + Warren truss + hydraulic cylinder
  const boom1 = svgEl('g', { class: 'arm-boom-1' });
  const xEnd1 = Math.max(80, L1 - 16);
  let trussD = '';
  const step1 = 38;
  for (let x = 28, up = true; x + step1 < xEnd1 - 12; x += step1, up = !up) {
    trussD += up
      ? `M${fix(x)} -11L${fix(x + step1)} 10.5`
      : `M${fix(x)} 10.5L${fix(x + step1)} -11`;
  }
  const labelX1 = L1 * 0.54;
  const boom1Label = svgEl(
    'text',
    { class: 'arm-label', x: fix(labelX1), y: '-26', 'text-anchor': 'middle' },
    `RIG-0${rigNo} // HEAVY JIG`,
  );
  const cylEnd = Math.min(L1 * 0.48, 178);
  boom1.append(
    svgEl('path', { class: 'arm-halo', d: `M0 0L${fix(L1)} 0` }),
    svgEl('polygon', {
      class: 'arm-body',
      points: `0,-14 ${fix(L1)},-10 ${fix(L1)},10 0,14`,
    }),
    svgEl('path', {
      class: 'arm-rail',
      d: `M14 -14L${fix(xEnd1)} -10.5M14 14L${fix(xEnd1)} 10.5`,
    }),
    svgEl('path', {
      class: 'arm-rail-sketch',
      d: `M20 -12.2L${fix(xEnd1 - 6)} -8.9M20 12.2L${fix(xEnd1 - 6)} 8.9`,
    }),
    svgEl('path', { class: 'arm-strut', d: trussD }),
    // Auxiliary hydraulic damper cylinder & piston rod
    svgEl('rect', { class: 'arm-cyl', x: '34', y: '-21', width: fix(cylEnd - 34), height: '6.5', rx: '1.5' }),
    svgEl('path', { class: 'arm-rail', d: `M${fix(cylEnd)} -17.7H${fix(L1 - 24)}M${fix(L1 - 24)} -17.7V-10.5` }),
    svgEl('circle', { class: 'arm-bolt', cx: '26', cy: '0', r: '2.2' }),
    svgEl('circle', { class: 'arm-bolt', cx: fix(xEnd1 - 8), cy: '0', r: '2.2' }),
    boom1Label,
  );

  // Forearm (2nd rigid link): solid caliper arm running full length L2 into spherical wrist joint
  const boom2 = svgEl('g', { class: 'arm-boom-2', 'data-arm-tip-x': fix(L2) });
  let tickD = '';
  for (let x = 28; x < L2 - 14; x += 20) {
    const tLen = x % 40 === 28 ? 5.2 : 3.0;
    tickD += `M${fix(x)} -7.5L${fix(x)} ${fix(-7.5 - tLen)}`;
  }
  boom2.append(
    svgEl('path', { class: 'arm-halo', d: `M0 0L${fix(L2)} 0` }),
    svgEl('polygon', {
      class: 'arm-body',
      points: `0,-10 ${fix(L2)},-6.5 ${fix(L2)},6.5 0,10`,
    }),
    svgEl('path', {
      class: 'arm-rail',
      d: `M12 -10L${fix(L2)} -6.5M12 10L${fix(L2)} 6.5`,
    }),
    svgEl('path', {
      class: 'arm-rail-sketch',
      d: `M18 -8.2L${fix(L2 - 4)} -5.2M18 8.2L${fix(L2 - 4)} 5.2`,
    }),
    svgEl('path', { class: 'arm-strut', d: tickD }),
    // Parallel pantograph tie-rod with clevis pins
    svgEl('path', { class: 'arm-rail-sketch', d: `M6 -15L${fix(L2 - 6)} -12` }),
    svgEl('circle', { class: 'arm-pin', cx: '6', cy: '-15', r: '2.8' }),
    svgEl('circle', { class: 'arm-pin', cx: fix(L2 - 6), cy: '-12', r: '2.6' }),
  );

  // Copper hydraulic routing cable arching across elbow
  const cable = svgEl('path', { class: 'arm-cable', d: 'M0 0Q0 0 0 0' });

  // Heavy drafted shoulder & elbow bearing housings
  const makeJoint = (rBear, rPin) => {
    const j = svgEl('g');
    j.append(
      svgEl('circle', { class: 'arm-arc', r: fix(rBear + 11), cx: 0, cy: 0 }),
      svgEl('circle', { class: 'arm-joint', r: fix(rBear), cx: 0, cy: 0 }),
      svgEl('circle', { class: 'arm-strut', r: fix(rBear - 5), cx: 0, cy: 0 }),
      svgEl('path', {
        class: 'arm-strut',
        d: `M-${rBear + 5} 0H${rBear + 5}M0 -${rBear + 5}V${rBear + 5}`,
      }),
      svgEl('circle', { class: 'arm-pin', r: fix(rPin), cx: 0, cy: 0 }),
    );
    return j;
  };
  const shoulder = makeJoint(18, 5.5);
  const elbow = makeJoint(16, 5.2);

  // Spherical wrist bearing at (0,0) coupled to boom2 tip, plus standoff caliper saddle (contact at x = +15)
  const wrist = svgEl('g', { class: 'arm-wrist' });
  const jawUp = svgEl('g');
  jawUp.append(
    svgEl('path', { class: 'arm-jaw', d: 'M4 -6L14 -20L25 -14L25 -7L14 -11L6 -4Z' }),
    svgEl('rect', { class: 'arm-pad', x: '15', y: '-14', width: '10', height: '5', rx: '1' }),
    svgEl('circle', { class: 'arm-bolt', cx: '13', cy: '-14', r: '1.8' }),
  );
  const jawLo = svgEl('g');
  jawLo.append(
    svgEl('path', { class: 'arm-jaw', d: 'M4 6L14 20L25 14L25 7L14 11L6 4Z' }),
    svgEl('rect', { class: 'arm-pad', x: '15', y: '9', width: '10', height: '5', rx: '1' }),
    svgEl('circle', { class: 'arm-bolt', cx: '13', cy: '14', r: '1.8' }),
  );
  wrist.append(
    jawUp,
    jawLo,
    svgEl('rect', { class: 'arm-joint', x: '0', y: '-11', width: '12', height: '22', rx: '2.5' }),
    svgEl('rect', { class: 'arm-pad', x: '12', y: '-18', width: '6', height: '36', rx: '1.5' }),
    svgEl('circle', { class: 'arm-joint', cx: '0', cy: '0', r: '9.5' }),
    svgEl('circle', { class: 'arm-pin', cx: '0', cy: '0', r: '3.8' }),
  );

  group.append(slotGuide, bezel, cable, boom1, boom2, shoulder, elbow, wrist);
  return { group, slotGuide, bezel, boom1, boom1Label, labelX1, boom2, cable, shoulder, elbow, wrist, jawUp, jawLo };
}

export function initDraftingArms({ mode, root, signal } = {}) {
  if (typeof window === 'undefined' || !root) {
    return { dispose() {} };
  }

  const desktopMedia = matchMedia(DESKTOP_QUERY);
  const noPrefMedia = matchMedia(REDUCED_QUERY);

  let disposed = false;
  let layer = null;
  let observer = null;
  let bodyObserver = null;
  let raf = 0;
  let frames = 0;
  let placedCount = 0;
  let nextRig = 1;
  const initScrollY = window.scrollY;
  let firstIoDone = false;
  let targets = [];
  const pendingMap = new Map();
  const activeTasks = new Set();
  const waitQueue = [];

  const countCarrying = () => {
    let n = 0;
    for (const t of activeTasks) {
      if (!t.seated) n++;
    }
    return n;
  };

  const canAnimate = () =>
    !disposed &&
    desktopMedia.matches &&
    noPrefMedia.matches &&
    !document.hidden &&
    !document.body.classList.contains('motion-paused') &&
    !document.body.classList.contains('focused') &&
    !document.body.hasAttribute('data-search-modal-open') &&
    !window.__meadowMotion?.stats?.().userPaused;

  const stats = () => ({
    enabled: desktopMedia.matches && noPrefMedia.matches,
    desktop: desktopMedia.matches,
    active: activeTasks.size,
    placed: placedCount,
    pending: pendingMap.size,
    queued: waitQueue.length,
    frames,
    running: raf !== 0,
  });

  function settlePending(el, tag = 'skipped') {
    pendingMap.delete(el);
    el.removeAttribute('data-arm-pending');
    clearElementInlineStyles(el);
    if (!el.dataset.armPlaced) el.dataset.armPlaced = tag;
    observer?.unobserve(el);
  }

  function seatTask(task, tag = 'true', countPlaced = true) {
    if (task.seated) return false;
    task.seated = true;
    if (countPlaced) placedCount++;
    task.appliedX = 0;
    task.appliedY = 0;
    clearElementInlineStyles(task.el);
    task.el.dataset.armPlaced = tag;
    return true;
  }

  function flushActive() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    while (waitQueue.length > 0) {
      settlePending(waitQueue.shift().el, 'skipped');
    }
    for (const task of [...activeTasks]) {
      if (!seatTask(task, 'flushed', false)) {
        clearElementInlineStyles(task.el);
      }
      task.visual.group.remove();
      activeTasks.delete(task);
    }
  }

  function flushAll() {
    flushActive();
    for (const [el] of [...pendingMap.entries()]) {
      settlePending(el, 'flushed');
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    flushAll();
    observer?.disconnect();
    bodyObserver?.disconnect();
    layer?.remove();
    layer = null;
    observer = null;
    bodyObserver = null;
  }

  window.__draftingArm = { stats, flush: flushAll, dispose };

  if (!desktopMedia.matches || !noPrefMedia.matches) {
    return { dispose };
  }

  targets = collectTargets(mode, root);
  if (!targets.length) {
    return { dispose };
  }

  layer = svgEl('svg', {
    class: 'drafting-arm-layer',
    'aria-hidden': 'true',
  });
  document.body.append(layer);

  function spawnTask(spec, rect0) {
    if (!layer || rect0.width <= 0 || rect0.height <= 0) {
      settlePending(spec.el, 'skipped');
      return;
    }

    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const isFromLeft = spec.dir.startsWith('left');
    const isLow = spec.dir.endsWith('low');
    const isCrane = spec.dir.endsWith('crane');

    // Start 100% outside the left or right viewport bezel to eliminate overlapping ghost traces.
    const offX = isFromLeft ? -(rect0.right + 44) : vw - rect0.left + 44;
    const offY = spec.horizontalOnly ? 0 : isLow ? 68 : isCrane ? -135 : -72;
    const offDeg = spec.horizontalOnly
      ? isFromLeft
        ? -0.9
        : 0.9
      : isLow
        ? isFromLeft
          ? 1.8
          : -1.8
        : isFromLeft
          ? -2.0
          : 2.0;

    // Choose a viewport-safe rim grip anchored on the inner leading portion facing the viewport.
    const topSafe = mode === 'journal' ? 124 : 48;
    const topClipped = rect0.top < topSafe;
    const tallCard = rect0.height > Math.min(280, vh * 0.40);
    const useSideGrip = (isLow && tallCard) || (!isLow && topClipped);
    let gripLocalX;
    let gripLocalY;
    let gripAngle;

    if (useSideGrip) {
      gripLocalX = isFromLeft ? 0 : rect0.width;
      const visTop = Math.max(0, topSafe - rect0.top);
      gripLocalY = clamp(visTop + Math.min(72, rect0.height * 0.28), 32, Math.max(32, rect0.height - 32));
      gripAngle = isFromLeft ? 0 : Math.PI;
    } else {
      const inset = clamp(rect0.width * 0.26, Math.min(32, rect0.width * 0.25), 220);
      gripLocalX = isFromLeft ? inset : rect0.width - inset;
      gripLocalY = isLow ? rect0.height : 0;
      gripAngle = isLow ? -Math.PI / 2 : Math.PI / 2;
    }

    const bezelX = isFromLeft ? 0 : vw;
    const t0Wx = rect0.left + gripLocalX + offX - Math.cos(gripAngle) * WRIST_STANDOFF;
    // Keep shoulder pivot strictly behind t=0 grip so dx never crosses zero and elbow never flips 180deg.
    const shoulderX = isFromLeft ? Math.min(-64, t0Wx - 72) : Math.max(vw + 64, t0Wx + 72);
    const shoulderOffsetY = useSideGrip ? 72 : isLow ? 88 : isCrane ? -110 : -78;
    const initialSy = clamp(rect0.top + gripLocalY + shoulderOffsetY, 68, vh - 68);
    const S = { x: shoulderX, y: initialSy };

    // Keep link length balanced so the elbow stays comfortably inside viewport while spanning up to 2560px.
    const reachX = Math.abs(rect0.left + gripLocalX - shoulderX) + 40;
    const reachMax = Math.hypot(reachX, Math.abs(shoulderOffsetY) + 180);
    const linkLen = Math.max(360, reachMax * 0.56);
    const rigNo = ((nextRig - 1) % 6) + 1;
    nextRig++;

    const durationMs = clamp(1420 + Math.abs(offX) * 0.36, 1550, 2050);
    const visual = createRigVisual(rigNo, linkLen, linkLen, rect0, spec.onDark, isFromLeft);

    const task = {
      el: spec.el,
      rect0,
      appliedX: 0,
      appliedY: 0,
      S,
      bezelX,
      shoulderOffsetY,
      vw,
      isFromLeft,
      isLow,
      useSideGrip,
      horizontalOnly: spec.horizontalOnly,
      gripLocalX,
      gripLocalY,
      gripAngle,
      offX,
      offY,
      offDeg,
      linkLen,
      durationMs,
      start: performance.now(),
      seated: false,
      visual,
    };

    // Apply solid initial transform synchronously and position Frame-0 SVG before mounting.
    spec.el.dataset.armCarrying = 'true';
    spec.el.style.transformOrigin = '50% 50%';
    spec.el.style.willChange = 'transform';
    spec.el.style.opacity = '1';
    spec.el.removeAttribute('data-arm-pending');

    updateTask(task, task.start, rect0);
    layer.append(visual.group);

    activeTasks.add(task);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function updateTask(task, now, liveBox) {
    const elapsed = Math.max(0, now - task.start);
    const p = clamp(elapsed / task.durationMs, 0, 1);
    const { el, rect0, S, linkLen, isFromLeft, isLow, visual } = task;

    const vh = document.documentElement.clientHeight || window.innerHeight;
    const restCx = liveBox.left + liveBox.width * 0.5 - task.appliedX;
    const restCy = liveBox.top + liveBox.height * 0.5 - task.appliedY;
    const restLeft = restCx - rect0.width * 0.5;
    const restTop = restCy - rect0.height * 0.5;
    if (restTop + rect0.height < -48) {
      // Card scrolled completely above the viewport; retire arm without dangling.
      const justSeated = seatTask(task, 'skipped', false);
      return { done: true, justSeated };
    }
    const restGripX = restLeft + task.gripLocalX;
    const restGripY = restTop + task.gripLocalY;
    // Place spherical wrist joint outside card border by WRIST_STANDOFF so jaws kiss rim cleanly.
    const baseWx = restGripX - Math.cos(task.gripAngle) * WRIST_STANDOFF;
    const baseWy = restGripY - Math.sin(task.gripAngle) * WRIST_STANDOFF;
    const liveSy = clamp(restGripY + task.shoulderOffsetY, 68, vh - 68);
    const Sx = S.x;

    let wx = baseWx;
    let wy = baseWy;
    let jawOpen = 0;
    let guideAlpha = 0;
    let armOpacity = 1;
    let retractFrac = 0;
    let radOffset = 0;
    let justSeated = false;

    if (p <= 0.54) {
      // Phase 1: Unhurried curved carry-in of solid card from outside viewport bezel
      const u = minJerk(p / 0.54);
      const arcLift = task.horizontalOnly ? 0 : -Math.sin(u * Math.PI) * 18;
      const curX = task.offX * (1 - u);
      const curY = task.offY * (1 - u) + arcLift;
      const curDeg = task.offDeg * (1 - u);
      radOffset = (curDeg * Math.PI) / 180;
      task.appliedX = curX;
      task.appliedY = curY;
      el.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0) rotate(${curDeg.toFixed(2)}deg)`;
      const lx = task.gripLocalX - rect0.width * 0.5;
      const ly = task.gripLocalY - rect0.height * 0.5;
      const cosR = Math.cos(radOffset);
      const sinR = Math.sin(radOffset);
      const rotGripX = restCx + curX + lx * cosR - ly * sinR;
      const rotGripY = restCy + curY + lx * sinR + ly * cosR;
      wx = rotGripX - Math.cos(task.gripAngle + radOffset) * WRIST_STANDOFF;
      wy = rotGripY - Math.sin(task.gripAngle + radOffset) * WRIST_STANDOFF;
      guideAlpha = Math.min(0.68, p / 0.16) * 0.68;
    } else if (p <= 0.68) {
      // Phase 2: Seat & Lock Hold (~240ms dwell while registration corners flash LOCKED)
      if (seatTask(task, 'true', true)) justSeated = true;
      jawOpen = 0;
      wx = baseWx;
      wy = baseWy;
      guideAlpha = 0.95;
    } else if (p <= 0.80) {
      // Phase 3: Unclamp wide & clear caliper jaws off card border
      if (seatTask(task, 'true', true)) justSeated = true;
      const v = minJerk((p - 0.68) / 0.12);
      jawOpen = v;
      wx = baseWx - Math.cos(task.gripAngle) * 22 * v;
      wy = baseWy - Math.sin(task.gripAngle) * 22 * v;
      guideAlpha = 0.9 * (1 - v * 0.35);
    } else {
      // Phase 4: Fold & retract smoothly back behind the viewport bezel
      if (seatTask(task, 'true', true)) justSeated = true;
      const r = minJerk((p - 0.80) / 0.20);
      retractFrac = r;
      const startRx = baseWx - Math.cos(task.gripAngle) * 22;
      const startRy = baseWy - Math.sin(task.gripAngle) * 22;
      const endRx = isFromLeft ? -60 : task.vw + 60;
      const endRy = liveSy;
      wx = startRx + (endRx - startRx) * r;
      wy = startRy + (endRy - startRy) * r;
      jawOpen = 1 - r * 0.35;
      guideAlpha = 0.58 * Math.max(0, 1 - r * 1.6);
      armOpacity = p > 0.90 ? Math.max(0, (1 - p) / 0.10) : 1;
    }

    // Solve Symmetric 2-Bone Analytical IK (L1 === L2) from liveSy bezel carriage
    const dx = wx - Sx;
    const dy = wy - liveSy;
    const rawD = Math.hypot(dx, dy) || 1;
    const D = clamp(rawD, 16, 2 * linkLen - 10);
    const thetaSW = Math.atan2(dy, dx);
    const cosA = clamp(D / (2 * linkLen), 0.02, 0.996);
    // Top and side grips arch elbow away from edges; under-slung arms arch downward beneath rim.
    const bendSign = task.useSideGrip
      ? isFromLeft
        ? -1
        : 1
      : isLow
        ? isFromLeft
          ? 1
          : -1
        : isFromLeft
          ? -1
          : 1;
    const theta1 = thetaSW + bendSign * Math.acos(cosA);
    const ex = Sx + linkLen * Math.cos(theta1);
    const ey = liveSy + linkLen * Math.sin(theta1);
    const theta2 = Math.atan2(wy - ey, wx - ex);
    // Hard-couple rendered wrist pivot to exact forearm tip so boom2->wrist never detaches.
    const endWx = ex + linkLen * Math.cos(theta2);
    const endWy = ey + linkLen * Math.sin(theta2);

    visual.group.setAttribute('opacity', armOpacity.toFixed(3));
    visual.slotGuide.setAttribute('opacity', guideAlpha.toFixed(3));
    visual.slotGuide.setAttribute('transform', `translate(${fix(restLeft)} ${fix(restTop)})`);

    // Slide the bezel flange along the screen edge to track where the active boom enters viewport.
    let bezelY = liveSy;
    if ((Sx <= task.bezelX && ex >= task.bezelX) || (Sx >= task.bezelX && ex <= task.bezelX)) {
      const denom = ex - Sx;
      if (Math.abs(denom) > 1) bezelY = liveSy + (ey - liveSy) * ((task.bezelX - Sx) / denom);
    } else if ((ex <= task.bezelX && endWx >= task.bezelX) || (ex >= task.bezelX && endWx <= task.bezelX)) {
      const denom = endWx - ex;
      if (Math.abs(denom) > 1) bezelY = ey + (endWy - ey) * ((task.bezelX - ex) / denom);
    }
    visual.bezel.setAttribute('transform', `translate(${fix(task.bezelX)} ${fix(clamp(bezelY, 36, vh - 36))})`);
    visual.shoulder.setAttribute('transform', `translate(${fix(Sx)} ${fix(liveSy)})`);
    visual.elbow.setAttribute('transform', `translate(${fix(ex)} ${fix(ey)})`);
    visual.boom1.setAttribute('transform', `translate(${fix(Sx)} ${fix(liveSy)}) rotate(${deg(theta1).toFixed(2)})`);
    visual.boom2.setAttribute('transform', `translate(${fix(ex)} ${fix(ey)}) rotate(${deg(theta2).toFixed(2)})`);

    if (Math.cos(theta1) < 0) {
      visual.boom1Label.setAttribute('transform', `rotate(180 ${fix(visual.labelX1)} -26)`);
    } else {
      visual.boom1Label.removeAttribute('transform');
    }

    // Flexible copper hose arching outside elbow joint
    const mx1 = Sx + (ex - Sx) * 0.44;
    const my1 = liveSy + (ey - liveSy) * 0.44;
    const mx2 = ex + (endWx - ex) * 0.56;
    const my2 = ey + (endWy - ey) * 0.56;
    const nx = Math.cos(thetaSW + (bendSign * Math.PI) / 2);
    const ny = Math.sin(thetaSW + (bendSign * Math.PI) / 2);
    const cx = ex + nx * 36;
    const cy = ey + ny * 36;
    visual.cable.setAttribute('d', `M${fix(mx1)} ${fix(my1)}Q${fix(cx)} ${fix(cy)} ${fix(mx2)} ${fix(my2)}`);

    let wristRad = task.gripAngle + radOffset;
    if (retractFrac > 0) {
      const diff = Math.atan2(Math.sin(theta2 - task.gripAngle), Math.cos(theta2 - task.gripAngle));
      wristRad += diff * retractFrac * 0.72;
    }
    visual.wrist.setAttribute('transform', `translate(${fix(endWx)} ${fix(endWy)}) rotate(${deg(wristRad).toFixed(2)})`);
    const jawLift = jawOpen * 9.0;
    const jawRot = jawOpen * 18;
    visual.jawUp.setAttribute('transform', `translate(0 ${(-jawLift).toFixed(2)}) rotate(${(-jawRot).toFixed(2)})`);
    visual.jawLo.setAttribute('transform', `translate(0 ${jawLift.toFixed(2)}) rotate(${jawRot.toFixed(2)})`);

    return { done: p >= 1, justSeated };
  }

  function drainQueue() {
    if (!waitQueue.length || !canAnimate()) return;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    while (waitQueue.length > 0 && countCarrying() < MAX_CARRY && activeTasks.size < MAX_TOTAL_RIGS) {
      const spec = waitQueue.shift();
      const rect = spec.el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.top >= vh) {
        pendingMap.set(spec.el, spec);
        observer?.observe(spec.el);
      } else if (rect.bottom < 48) {
        settlePending(spec.el, 'skipped');
      } else {
        spawnTask(spec, rect);
      }
    }
  }

  function tick(now) {
    raf = 0;
    if (!canAnimate()) {
      flushActive();
      return;
    }
    const boxes = new Map();
    for (const task of activeTasks) {
      boxes.set(task, task.el.getBoundingClientRect());
    }
    frames++;
    let shouldDrain = false;
    for (const task of [...activeTasks]) {
      const { done, justSeated } = updateTask(task, now, boxes.get(task));
      if (justSeated) shouldDrain = true;
      if (done) {
        clearElementInlineStyles(task.el);
        task.visual.group.remove();
        activeTasks.delete(task);
        shouldDrain = true;
      }
    }
    if (shouldDrain) drainQueue();
    if (activeTasks.size > 0) {
      raf = requestAnimationFrame(tick);
    }
  }

  for (const spec of targets) {
    spec.el.setAttribute('data-arm-pending', 'true');
    pendingMap.set(spec.el, spec);
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (!noPrefMedia.matches) {
        flushAll();
        return;
      }
      if (!canAnimate()) {
        flushActive();
        for (const entry of entries) {
          if (entry.isIntersecting && pendingMap.has(entry.target)) {
            settlePending(entry.target, 'skipped');
          }
        }
        return;
      }

      const isInitialRest = !firstIoDone && Math.abs(window.scrollY - initScrollY) < 4;
      firstIoDone = true;

      if (isInitialRest) {
        for (const entry of entries) {
          const r = entry.boundingClientRect;
          if (entry.isIntersecting || (r.width > 0 && r.height > 0 && r.bottom <= window.innerHeight * 0.95)) {
            settlePending(entry.target, 'initial');
          }
        }
        return;
      }

      const candidates = [];
      for (const entry of entries) {
        const spec = pendingMap.get(entry.target);
        if (!spec || !entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        pendingMap.delete(entry.target);
        if (entry.boundingClientRect.bottom < 24) {
          settlePending(entry.target, 'skipped');
          continue;
        }
        candidates.push({ spec, rect: entry.boundingClientRect });
      }

      if (!candidates.length) return;
      const focusY = window.innerHeight * 0.48;
      candidates.sort(
        (a, b) =>
          Math.abs(a.rect.top + a.rect.height * 0.5 - focusY) -
          Math.abs(b.rect.top + b.rect.height * 0.5 - focusY),
      );

      let launched = 0;
      const slots = Math.max(0, Math.min(MAX_CARRY - countCarrying(), MAX_TOTAL_RIGS - activeTasks.size));
      for (const item of candidates) {
        if (launched < slots) {
          spawnTask(item.spec, item.rect);
          launched++;
        } else {
          waitQueue.push(item.spec);
        }
      }
      drainQueue();
    },
    { rootMargin: '0px 0px -2% 0px', threshold: 0.01 },
  );

  for (const spec of targets) {
    observer.observe(spec.el);
  }

  const checkMotionState = () => {
    if (!noPrefMedia.matches) {
      flushAll();
    } else if (!canAnimate()) {
      flushActive();
    }
  };

  const onResize = () => {
    if (!noPrefMedia.matches) {
      flushAll();
    } else {
      flushActive();
    }
  };

  const onPageHide = (event) => {
    if (!event.persisted) dispose();
    else flushAll();
  };

  const eventOpts = signal ? { signal } : undefined;
  addEventListener('resize', onResize, eventOpts);
  addEventListener('pagehide', onPageHide, eventOpts);
  document.addEventListener('visibilitychange', checkMotionState, eventOpts);
  document.addEventListener('readingmotionchange', checkMotionState, eventOpts);
  document.getElementById('motion-toggle')?.addEventListener('click', () => setTimeout(checkMotionState, 0), eventOpts);
  desktopMedia.addEventListener('change', checkMotionState, eventOpts);
  noPrefMedia.addEventListener('change', checkMotionState, eventOpts);

  bodyObserver = new MutationObserver(checkMotionState);
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-search-modal-open'],
  });
  const toggleBtn = document.getElementById('motion-toggle');
  if (toggleBtn) {
    bodyObserver.observe(toggleBtn, {
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });
  }

  return { dispose };
}
