import { createTask, transition, requiredChecks, canDeploy, CHECKS, actionsFor } from './scenario.mjs';
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const snapshots = { human: createTask('human'), agent: createTask('agent') };
const errors = [], mounts = [], disposals = [];
let mode = 'human', world = null, generation = 0, active = false, busy = false, selectedNode = 'relay', chapterLoaded = false, readerTrigger = null, pendingAction = Promise.resolve();
let content;
const phaseNames = { survey: '确认共同任务', ready: '准备生产', candidate: '候选尚待证据', evidence: '检查与修正', operating: '局部秩序恢复', disturbance: '新条件进入边界' };
const initialMessage = '目标：通过兼容接口传输测绘数据，主线路故障后备用接替，异常可隔离并定位。';
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
const contentReady = fetch('/content.json').then(r => { if (!r.ok) throw Error('无法读取章节配置'); return r.json(); }).then(data => {
  content = data;
  $('book-meta').textContent = `${data.version} / BSL 1.1 / ${data.chapters.length} 章`;
  for (const chapter of data.chapters) {
    const link = document.createElement('a'); link.href = canonical(chapter.slug); link.target = '_blank'; link.rel = 'noopener';
    const number = document.createElement('span'); number.textContent = chapter.order === 'A' ? '附录' : `CH ${chapter.order}`;
    link.append(number, document.createTextNode(chapter.title)); $('chapter-links').append(link);
  }
  const chapter = data.chapters.find(c => c.order === '3'); $('method-title').textContent = chapter.title; $('reader-title').textContent = `第 ${chapter.order} 章 · ${chapter.title}`; $('canonical-chapter').href = canonical(chapter.slug);
}).catch(error => { $('load-status').textContent = error.message; errors.push(error.message); });
function canonical(slug) { return `https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/${slug}/`; }
function render() {
  const s = snapshots[mode];
  $('mode-label').textContent = mode === 'human' ? '人类主导 / 到现场判断与实施' : 'AI 原生 / 组织探索与裁决';
  $('phase-label').textContent = phaseNames[s.phase];
  $('responsibility').textContent = mode === 'human' ? '观察 → 判断 → 操作 → 检查 → 修正。自动化工具协助你，工作仍由你组织并直接完成。' : '定义 → 委派 → 约束 → 审阅 → 放行。Agent 在多个位置生产，你维护目标、边界与证据。';
  $('task-message').textContent = s.history.at(-1)?.message || initialMessage;
  $('revision').textContent = s.candidate ? `候选 v${s.revision}` : '尚无候选';
  $('harness-controls').hidden = mode !== 'agent'; $('check-options').replaceChildren();
  for (const key of requiredChecks(s)) {
    const label = document.createElement('label'); label.className = 'check-option';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = s.harness.includes(key); input.disabled = busy || s.accepted;
    input.dataset.check = key; input.addEventListener('change', () => { snapshots[mode] = transition(snapshots[mode], { type: 'SET_CHECK', key, enabled: input.checked }); render(); });
    label.append(input, document.createTextNode(CHECKS[key].label)); $('check-options').append(label);
  }
  $('actions').replaceChildren();
  for (const action of actionsFor(s)) {
    const button = document.createElement('button'); button.textContent = action.label; button.dataset.action = action.type; button.disabled = busy;
    if ($('actions').children.length === 0) button.className = 'primary';
    button.addEventListener('click', () => { pendingAction = act(action); }); $('actions').append(button);
  }
  if (s.accepted && s.disturbed) { const p = document.createElement('p'); p.className = 'note'; p.textContent = '本次已知条件下的恢复完成。带着方法继续探索，未知仍在边界之外。'; $('actions').append(p); }
  $('evidence').replaceChildren();
  for (const key of requiredChecks(s)) {
    const evidence = s.evidence[key], fresh = evidence?.revision === s.revision;
    const li = document.createElement('li'); li.dataset.evidence = key;
    const row = document.createElement('div'), title = document.createElement('span'), status = document.createElement('span'), detail = document.createElement('small');
    title.textContent = CHECKS[key].label; status.textContent = !fresh ? '待证据' : evidence.pass ? '✓ 通过' : '× 未通过'; status.className = fresh ? evidence.pass ? 'pass' : 'failed' : '';
    detail.textContent = fresh ? evidence.detail : '未检查的条件不能被视作通过。'; row.append(title, status); li.append(row, detail); $('evidence').append(li);
  }
  $('history').replaceChildren();
  for (const item of s.history.slice(-12)) { const li = document.createElement('li'); li.textContent = `${String(item.index).padStart(2, '0')} / ${item.message}`; $('history').append(li); }
  for (const id of ['read-chapter', 'overview', 'follow', 'other-mode', 'reset']) $(id).disabled = busy;
  document.querySelectorAll('.scene-tag').forEach(button => { button.disabled = busy; button.setAttribute('aria-pressed', String(button.dataset.node === selectedNode)); });
  if (world) world.setTask(s);
}
function projectLabels({ project }) {
  for (const button of document.querySelectorAll('.scene-tag')) {
    const pos = project(button.dataset.node); button.hidden = !pos.visible;
    button.style.left = `${Math.max(40, Math.min($('world').clientWidth - 40, pos.x))}px`; button.style.top = `${Math.max(90, Math.min($('world').clientHeight - 65, pos.y))}px`;
  }
}
async function start(nextMode = mode) {
  const fromLanding = !active;
  generation++; const stamp = generation;
  disposeWorld(); mode = nextMode; active = true; busy = true; $('experience').hidden = false;
  if (fromLanding) { $('landing').hidden = false; $('experience').classList.add('preparing'); $('experience').setAttribute('aria-hidden', 'true'); }
  $('enter').disabled = true; $('load-status').textContent = '正在准备 Three.js 空间，章节阅读仍可使用…';
  const reveal = () => { $('landing').hidden = true; $('experience').classList.remove('preparing'); $('experience').removeAttribute('aria-hidden'); $('world').scrollIntoView({ block: 'nearest' }); };
  $('world').classList.remove('fallback'); $('world-status').textContent = '正在准备空间…'; render();
  try {
    if (query.has('nowebgl')) throw Error('当前使用无 WebGL 的阅读与任务降级');
    const { createWorld } = await import('./world.mjs'); if (!active || stamp !== generation) return;
    const next = await createWorld($('canvas-host'), { instant: query.has('still'), onFrame: projectLabels, onPick: node => {
      if (node === '__lost') { fallback('三维上下文丢失，任务与阅读仍可继续。'); return; }
      selectNode(node);
    } });
    if (!active || stamp !== generation) { disposals.push(next.destroy()); return; }
    world = next; world.setTask(snapshots[mode]); reveal(); await world.enter();
    if (!active || stamp !== generation) return;
    mounts.push(world.stats()); $('world-status').textContent = '选择空间中的装置查看；任务操作在侧栏。';
  } catch (error) { if (active && stamp === generation) { fallback(error.message); reveal(); } }
  if (stamp === generation && active) { busy = false; $('enter').disabled = false; $('load-status').textContent = ''; render(); $('task-heading').setAttribute('tabindex', '-1'); $('task-heading').focus({ preventScroll: true }); }
}
function fallback(message) {
  disposeWorld(); $('world').classList.add('fallback'); $('world-status').textContent = message;
  document.querySelectorAll('.scene-tag').forEach(button => { button.hidden = false; button.style.left = ''; button.style.top = ''; });
}
function disposeWorld() { if (world) { const previous = world; world = null; disposals.push(previous.destroy()); } }
function exit() {
  generation++; active = false; busy = false; if ($('reader').open) $('reader').close(); disposeWorld();
  $('experience').classList.remove('preparing'); $('experience').removeAttribute('aria-hidden'); $('enter').disabled = false; $('load-status').textContent = '';
  $('experience').hidden = true; $('landing').hidden = false; $('enter').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
}
async function selectNode(node) {
  if (busy || !active) return; selectedNode = node;
  const messages = { source: '源端：明确数据从哪里产生。', relay: '中继：候选连接与接口兼容。', verify: '检查装置：证据只覆盖已执行的条件。', receiver: '接收端：满足当前条件后才接入运行。', console: '意图台：人的目标与边界约束后续工作。' };
  $('world-status').textContent = messages[node]; render(); if (world) await world.focus(node);
}
async function act(action) {
  if (busy || !active) return;
  const stamp = generation; busy = true; render();
  try {
    selectedNode = action.node || 'relay';
    if (world && action.type !== 'CONFIGURE') await world.perform(action.type, selectedNode);
    if (!active || stamp !== generation) return;
    snapshots[mode] = transition(snapshots[mode], { type: action.type });
  } catch (error) { $('world-status').textContent = error.message; errors.push(error.message); }
  finally { if (active && stamp === generation) { busy = false; render(); } }
}
async function openReader() {
  if (busy || !active) return; readerTrigger = document.activeElement;
  world?.pause(true); $('reader').showModal(); $('reader-title').setAttribute('tabindex', '-1'); $('reader-title').focus();
  if (chapterLoaded) return;
  $('chapter-content').setAttribute('aria-busy', 'true'); $('chapter-content').textContent = '正在打开原始章节…';
  try {
    await contentReady;
    const response = await fetch('/chapters/ch3'); if (!response.ok) throw Error('章节暂时无法加载，可使用普通阅读页；本地预览请先完成站点构建。');
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const body = page.querySelector('.sl-markdown-content'); if (!body) throw Error('未找到章节正文');
    body.querySelectorAll('script').forEach(el => el.remove());
    $('chapter-content').replaceChildren(...Array.from(body.childNodes).map(n => document.importNode(n, true)));
    for (const pre of $('chapter-content').querySelectorAll('pre')) {
      const button = document.createElement('button'); button.className = 'copy-code'; button.textContent = '复制代码';
      button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); button.textContent = '已复制'; } catch { button.textContent = '复制失败，可选中文字复制'; } }); pre.before(button);
    }
    for (const link of $('chapter-content').querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) continue;
      link.href = new URL(href, canonical('ch3')).href; link.target = '_blank'; link.rel = 'noopener';
    }
    chapterLoaded = true;
  } catch (error) { $('chapter-content').textContent = error.message; errors.push(error.message); }
  finally { $('chapter-content').setAttribute('aria-busy', 'false'); }
}
$('enter').addEventListener('click', () => { pendingAction = start(document.querySelector('input[name="mode"]:checked').value); });
$('exit').addEventListener('click', exit);
$('other-mode').addEventListener('click', () => { pendingAction = start(mode === 'human' ? 'agent' : 'human'); });
$('reset').addEventListener('click', () => { snapshots[mode] = createTask(mode); render(); });
$('read-chapter').addEventListener('click', () => { pendingAction = openReader(); });
$('close-reader').addEventListener('click', () => $('reader').close());
$('reader').addEventListener('close', () => { if (active) world?.pause(false); readerTrigger?.focus({ preventScroll: true }); });
$('apply-method').addEventListener('click', () => { snapshots[mode] = transition(snapshots[mode], { type: 'CONFIGURE' }); render(); $('reader').close(); });
$('overview').addEventListener('click', () => world?.overview());
$('follow').addEventListener('click', () => world?.focus(selectedNode));
document.querySelectorAll('.scene-tag').forEach(button => button.addEventListener('click', () => selectNode(button.dataset.node)));
window.addEventListener('pagehide', () => { generation++; active = false; disposeWorld(); });
if (query.has('verify')) {
  window.__dualEra = {
    ready: contentReady, start, exit, openReader,
    act: type => act({ type, node: 'verify' }), reset: () => { snapshots[mode] = createTask(mode); render(); },
    state: () => structuredClone(snapshots[mode]), whenIdle: () => pendingAction,
    info: () => ({ errors: [...errors], mounts: [...mounts], disposals: [...disposals], world: world?.stats() || null, readerOpen: $('reader').open, chapterLoaded, busy, active, mode }),
  };
  if (query.has('run')) import('./verify.mjs');
}
