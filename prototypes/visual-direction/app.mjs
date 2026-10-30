import { setupInstallation } from './installation.mjs';
const worlds = { territory: () => import('./territory-world.mjs'), outpost: () => import('./outpost-world.mjs'), legacy: () => import('./world.mjs') };
const { createWorld, stations } = await (worlds[document.body.dataset.world]?.() ?? import('./frontier-world.mjs'));
const $ = id => document.getElementById(id), query = new URLSearchParams(location.search);
const territorial = document.body.dataset.world === 'territory';
const actorPreview = query.get('actorPreview') === '1';
const errors = []; let world, book, view = 'home', returnView = 'home', mode = 'agent', currentChapter = territorial ? 'ch1' : 'ch3', currentStation = territorial ? 0 : 2, generation = 0, travelGeneration = 0, busy = false, readerTrigger = null;
window.addEventListener('error', e => errors.push(e.message)); window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
function button(text, action, className = '') { const el = document.createElement('button'); el.textContent = text; el.className = className; el.addEventListener('click', action); return el; }
function updateRouteControls() {
  const previous = $('route-previous'), turn = $('route-turn'), routeStatus = $('space-route-status');
  if (!previous || !turn || !routeStatus || !world?.stats) return;
  const stats = world.stats();
  previous.disabled = !!stats.actorMoving || stats.actorIndex <= 0 || stats.actorFacing !== 'left';
  turn.disabled = !!stats.actorMoving || !stats.actorReady;
  routeStatus.textContent = stats.actorStatus || (stats.actorFacing === 'left' ? '停稳 · 左侧朝向' : '停稳 · 正面朝向');
}
function projected(points) {
  if (territorial) return;
  points.forEach((p, i) => { const el = $(`station-${i}`); if (!el) return; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.hidden = !p.visible; });
}
const contentReady = fetch('/content.json').then(async response => { if (!response.ok) throw Error('无法读取书籍内容'); return response.json(); }).then(data => {
  book = data; $('book-tagline').textContent = data.tagline; $('book-version').textContent = data.version;
  setupInstallation(data);
  for (const chapter of data.chapters) {
    const row = button('', () => readChapter(chapter.slug), 'chapter-row'); row.id = 'read-' + chapter.slug;
    const number = document.createElement('span'); number.className = 'number'; number.textContent = chapter.order.padStart(2, '0');
    const copy = document.createElement('span'), title = document.createElement('strong'), blurb = document.createElement('small'), arrow = document.createElement('span');
    title.textContent = chapter.title; blurb.textContent = chapter.blurb; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true'); copy.append(title, blurb); row.append(number, copy, arrow); $('chapter-index').append(row);
    const nav = button('', () => readChapter(chapter.slug)); const no = document.createElement('span'); no.textContent = chapter.order.padStart(2, '0'); nav.append(no, document.createTextNode(chapter.title)); nav.dataset.chapter = chapter.slug; $('chapter-nav').append(nav);
  }
});
for (const [i, station] of stations.entries()) { const tag = button(station.title, () => selectStation(i), 'station-label'); tag.id = `station-${i}`; tag.setAttribute('aria-pressed', String(i === currentStation)); $('station-labels').append(tag); }
async function showDisplay(next, animate = true) {
  if (busy) return; if (!world) next = 'home'; busy = true; view = next; document.body.dataset.view = next;
  $('leave').disabled = true; $('enter').disabled = true;
  $('display-view').hidden = false; $('reading-view').hidden = true; $('space-ui').hidden = true;
  $('hero-caption').hidden = true; $('enter').hidden = true; $('scroll-cue').hidden = true; $('leave').hidden = next !== 'space';
  window.scrollTo({ top: 0, behavior: 'instant' });
  try { world?.pause(false); await world?.show(next, animate); }
  finally {
    $('space-ui').hidden = next !== 'space'; $('hero-caption').hidden = next !== 'home'; $('enter').hidden = next !== 'home'; $('scroll-cue').hidden = next !== 'home';
    busy = false; $('leave').disabled = false; $('enter').disabled = !world;
    if (next === 'space' && territorial) selectStation(currentStation);
    updateRouteControls();
    if (next === 'space') $('space-title').focus({ preventScroll: true }); else $('enter').focus({ preventScroll: true });
  }
}
async function selectStation(index) {
  if (!stations[index]) return;
  const travelStamp = ++travelGeneration;
  currentStation = index; currentChapter = stations[index].chapter;
  const travel = world?.select?.(index);
  document.querySelectorAll('.station-label').forEach((el, i) => el.setAttribute('aria-pressed', String(index === i)));
  $('space-eyebrow').textContent = `${mode === 'agent' ? 'AI-NATIVE' : 'HUMAN-LED'} / CH ${currentChapter.slice(2).padStart(2, '0')}`;
  const descriptions = {
    ch1: ['让意图有可以核对的边界。', '把需求、歧义与验收标准表达清楚，后续的探索才有可判断的方向。'],
    ch2: ['让分工之间有清晰的接口。', '识别依赖、契约和高风险路径，将局部决定放回整体结构中审视。'],
    ch3: ['证据，只照亮被检查的部分。', '这里恢复的是有条件的局部秩序。未被提出的问题，依然在边界之外。'],
    ch4: ['让生产发生在约束之内。', '人的直接实施与 Agent 的受委派生产，都需要可解释的边界与变更记录。'],
    ch6: ['把经过检查的变更带入运行。', '放行当前版本的产物，同时保留回退与异常定位所需的线索。'],
    ch7: ['让新的未知，成为下一次意图。', '运行反馈会带来新条件。环节可以连通，世界仍然没有被完全测绘。'],
  };
  const [title, copy] = descriptions[currentChapter]; $('space-title').textContent = title; $('space-copy').textContent = copy;
  updateRouteControls();
  if (territorial) {
    const station = stations[index];
    $('journey-place').textContent = `${String(index + 1).padStart(2, '0')} / ${station.place}`;
    $('travel-prev').disabled = index === 0; $('travel-next').disabled = index === stations.length - 1;
    $('travel-prev').textContent = index ? `← ${stations[index - 1].place}` : '起点';
    $('travel-next').textContent = index < stations.length - 1 ? `前往${stations[index + 1].place} →` : '已到观测边界';
    $('station-read').disabled = !!world?.stats().moving;
    $('journey-status').textContent = world?.stats().moving ? '沿路径前往…' : '已抵达';
    await travel;
    if (travelStamp === travelGeneration && view === 'space') { $('station-read').disabled = false; $('journey-status').textContent = '已抵达'; }
  }
  if (!territorial && travel?.then) await travel;
  updateRouteControls();
}
async function readChapter(slug = 'ch3') {
  if (busy) return;
  await contentReady; const chapter = book.chapters.find(c => c.slug === slug); if (!chapter) return;
  const stamp = ++generation;
  if (view !== 'reading') { returnView = view; readerTrigger = document.activeElement; }
  currentChapter = slug; view = 'reading'; document.body.dataset.view = 'reading'; world?.pause(true);
  $('display-view').hidden = true; $('reading-view').hidden = false; $('back-label').textContent = returnView === 'space' ? '返回探索' : '返回首页';
  $('reader-folio').textContent = `${chapter.label} / FIELD GUIDE`; $('reader-title').textContent = chapter.title; $('reader-description').textContent = chapter.blurb;
  $('source-link').href = `https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/${slug}/`;
  document.querySelectorAll('#chapter-nav button').forEach(el => el.setAttribute('aria-current', el.dataset.chapter === slug ? 'page' : 'false'));
  $('chapter-content').textContent = '正在打开章节…'; $('chapter-content').setAttribute('aria-busy', 'true'); $('chapter-toc').replaceChildren();
  window.scrollTo({ top: 0, behavior: 'instant' }); $('reader-title').focus({ preventScroll: true });
  try {
    const response = await fetch(`/chapters/${slug}`); if (!response.ok) throw Error('章节尚未构建，请使用原阅读页。');
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html'); if (stamp !== generation || view !== 'reading') return;
    const original = doc.querySelector('.sl-markdown-content'); if (!original) throw Error('未找到章节正文'); original.querySelectorAll('script').forEach(el => el.remove());
    $('chapter-content').replaceChildren(...Array.from(original.childNodes).map(n => document.importNode(n, true)));
    for (const heading of $('chapter-content').querySelectorAll('h2[id]')) { const link = document.createElement('a'); link.href = '#' + heading.id; const label = heading.cloneNode(true); label.querySelectorAll('.sl-anchor-link').forEach(el => el.remove()); link.textContent = label.textContent; $('chapter-toc').append(link); }
    for (const pre of $('chapter-content').querySelectorAll('pre')) {
      const copy = button('复制代码', async () => { try { await navigator.clipboard.writeText(pre.textContent); copy.textContent = '已复制'; } catch { copy.textContent = '可选中文字复制'; } }, 'copy-code'); pre.before(copy);
    }
    for (const link of $('chapter-content').querySelectorAll('a[href]')) { if (!link.getAttribute('href').startsWith('#')) { link.href = new URL(link.getAttribute('href'), $('source-link').href).href; link.target = '_blank'; link.rel = 'noopener'; } }
    const next = book.chapters[(book.chapters.indexOf(chapter) + 1) % book.chapters.length]; $('reader-next').textContent = `下一章 · ${next.title} ↗`; $('reader-next').dataset.next = next.slug;
  } catch (error) { if (stamp === generation) { $('chapter-content').textContent = error.message; errors.push(error.message); } }
  finally { if (stamp === generation) $('chapter-content').setAttribute('aria-busy', 'false'); }
}
async function backToDisplay() { generation++; busy = false; await showDisplay(returnView, false); readerTrigger?.focus({ preventScroll: true }); }
$('enter').addEventListener('click', () => showDisplay('space')); $('leave').addEventListener('click', () => showDisplay('home'));
$('browse').addEventListener('click', async event => { if (busy) { event.preventDefault(); return; } if (view === 'space') { event.preventDefault(); await showDisplay('home'); $('contents').scrollIntoView({ behavior: 'smooth' }); } });
$('start-reading').addEventListener('click', () => readChapter('ch0')); $('station-read').addEventListener('click', () => readChapter(stations[currentStation].chapter));
if (territorial) { $('travel-prev').addEventListener('click', () => selectStation(Math.max(0, currentStation - 1))); $('travel-next').addEventListener('click', () => selectStation(Math.min(stations.length - 1, currentStation + 1))); }
$('route-previous')?.addEventListener('click', async () => { const index = (world?.stats().actorIndex ?? currentStation) - 1; if (index >= 0) { await world.moveActorTo(index); updateRouteControls(); } });
$('route-turn')?.addEventListener('click', async () => { await world?.turnActor?.(); updateRouteControls(); });
$('reader-back').addEventListener('click', backToDisplay); $('reader-theme').addEventListener('click', () => { const dark = $('reading-view').classList.toggle('dark'); $('reader-theme').textContent = dark ? '浅色阅读' : '深色阅读'; });
$('reader-next').addEventListener('click', () => readChapter($('reader-next').dataset.next)); $('reader-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', () => { if (input.checked) { mode = input.value; world?.setMode(mode); selectStation(currentStation); } }));
window.addEventListener('keydown', event => { if (event.key === 'Escape' && view === 'reading') backToDisplay(); });
window.addEventListener('pagehide', () => world?.destroy());
const ready = contentReady.then(async () => {
  try { world = createWorld($('scene'), { onFrame: projected, onActorStatus: text => { const status = $('space-route-status'); if (status) status.textContent = text; updateRouteControls(); }, actorPreview, still: query.has('still') }); document.body.classList.add('world-ready'); $('space-route').hidden = !actorPreview; $('scene-status').textContent = ''; updateRouteControls(); }
  catch (error) { $('scene-status').textContent = '画面暂不可用，可继续向下阅读。'; $('enter').disabled = true; errors.push(error.message); }
  if (query.get('view') === 'space') { await showDisplay('space', false); await selectStation(territorial ? Math.max(0, Math.min(stations.length - 1, Number(query.get('region')) || 0)) : 2); }
  if (query.get('view') === 'reading') await readChapter(query.get('chapter') || 'ch3');
}).catch(error => { errors.push(error.message); $('scene-status').textContent = '预览内容暂不可用，请先构建站点后刷新。'; $('enter').disabled = true; });
window.__visualStudy = { ready, enter: () => showDisplay('space'), home: () => showDisplay('home'), go: selectStation, read: readChapter, back: backToDisplay, state: () => ({ view, mode, currentChapter, busy, errors: [...errors], world: world?.stats(), bodyWidth: document.documentElement.scrollWidth, viewport: innerWidth }) };
