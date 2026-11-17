// Homepage Assembly workbench controller.
// Runs at 0 cost when offscreen or skipped by content-visibility, executes once
// when scrolled into view, then sleeps cleanly at 0 rAF cost until replayed.

import { Clock, Hand, Marks, stageSpace } from './engine.mjs';
import { Crew } from './crew.mjs';

const CREW_NAMES = ['intent-01', 'arch-02', 'impl-03', 'verify-04', 'gate-05'];
const CREW_COLORS = ['#914526', '#2c6b63', '#b07b2c', '#3c6184', '#7a4f7b'];

export function initAssemblyWorkbench() {
  const section = document.getElementById('workbench-section');
  const stage = document.getElementById('workbench-stage');
  if (!section || !stage) return;

  const toggleBtn = section.querySelector('[data-assembly-toggle]');
  const replayBtn = section.querySelector('[data-assembly-replay]');
  const statusEl = section.querySelector('[data-assembly-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const sheetNode = stage.querySelector('.show-sheet');
  const initialMarkup = sheetNode.innerHTML;
  const clock = new Clock();

  let mounted = false;
  let runningCycle = false;
  let cycles = 0;
  let totalConflicts = 0;
  let totalSettled = 0;
  let userPaused = false;
  let visible = false;
  let skipped = true;
  let crew = null;
  let hands = [];

  const canRun = () => visible && !skipped && !document.hidden && !userPaused && !reduced.matches;

  function updateControls() {
    if (reduced.matches) {
      if (toggleBtn) toggleBtn.hidden = true;
      if (replayBtn) replayBtn.hidden = true;
      return;
    }
    if (toggleBtn) {
      toggleBtn.hidden = false;
      toggleBtn.textContent = userPaused ? '继续演示' : '暂停演示';
    }
    if (replayBtn) {
      replayBtn.hidden = false;
      replayBtn.disabled = runningCycle;
    }
  }

  function syncClock() {
    if (!runningCycle) {
      clock.sleep();
      return;
    }
    if (canRun()) clock.wake();
    else clock.sleep();
  }

  function cleanupOverlays() {
    for (const h of hands) h.dispose();
    hands = [];
    stage.querySelectorAll('.marks, .hands').forEach((n) => n.remove());
  }

  async function runCycle() {
    if (runningCycle || reduced.matches) return;
    runningCycle = true;
    mounted = true;
    updateControls();
    await document.fonts.ready;

    cleanupOverlays();
    const sheet = stage.querySelector('.show-sheet');
    sheet.innerHTML = initialMarkup;
    const marksLayer = document.createElement('div');
    marksLayer.className = 'marks';
    const handsLayer = document.createElement('div');
    handsLayer.className = 'hands';
    stage.append(marksLayer, handsLayer);

    const marks = new Marks(marksLayer);
    const space = stageSpace(stage);
    const mid = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
    hands = CREW_NAMES.map(
      (name, i) =>
        new Hand(clock, handsLayer, {
          name,
          colour: CREW_COLORS[i],
          seed: 4100 + i * 29 + cycles * 7,
          start: { x: mid.x + (i - 2) * 32, y: mid.y },
          style: { tempo: 0.52, curl: 0.05, scatter: 0.9 },
        }),
    );

    crew = new Crew(sheet, hands, marks, clock, space);
    crew.onchange = () => {
      totalConflicts = crew.stats.conflicts;
      totalSettled = crew.stats.settled;
      if (statusEl) {
        statusEl.textContent = crew.stats.conflicts
          ? `检测到并发声明冲突并拦截（已消解 ${crew.stats.settled}/${crew.stats.conflicts}）`
          : `正在组装验证账本 · ${crew.stats.done}/${crew.stats.total}`;
      }
    };

    syncClock();
    crew.start();
    await crew.finished;
    await clock.wait(0.6);
    cleanupOverlays();
    runningCycle = false;
    cycles++;
    clock.sleep();
    if (statusEl) {
      statusEl.textContent = '组装完成 · 已通过 L1/L2/L3/L5 门禁消解（静止省电态）';
    }
    updateControls();
  }

  section.addEventListener('contentvisibilityautostatechange', (event) => {
    skipped = event.skipped;
    syncClock();
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      skipped = !visible;
      syncClock();
      if (visible && !mounted && !reduced.matches && !userPaused) {
        runCycle();
      }
    },
    { threshold: 0.25 },
  );
  observer.observe(stage);

  document.addEventListener('visibilitychange', syncClock);
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      userPaused = false;
      cleanupOverlays();
      stage.querySelector('.show-sheet').innerHTML = initialMarkup;
      runningCycle = false;
      clock.sleep();
    }
    updateControls();
  });

  toggleBtn?.addEventListener('click', () => {
    userPaused = !userPaused;
    if (!userPaused && !runningCycle && !mounted) {
      runCycle();
    }
    syncClock();
    updateControls();
  });

  replayBtn?.addEventListener('click', () => {
    userPaused = false;
    runCycle();
  });

  updateControls();

  window.__assemblyWorkbench = {
    stats: () => ({
      mounted,
      running: !clock.asleep && !clock.paused && runningCycle,
      paused: userPaused,
      cycles,
      frames: clock.frames,
      conflicts: totalConflicts,
      settled: totalSettled,
    }),
    replay: () => runCycle(),
    toggle: () => toggleBtn?.click(),
  };
}

if (typeof document !== 'undefined') initAssemblyWorkbench();
