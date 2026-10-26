import { paintInkWash } from './ink-wash.mjs';

export function createReaderAtmosphere(sections) {
  const $ = id => document.getElementById(id);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let preference = false;
  try { preference = sessionStorage.getItem('field-reader-paused') === 'true'; } catch {}
  const stats = { frames: 0, time: 0, enabled: false, outlineOpen: false, disposed: false };
  const canvas = document.createElement('canvas');
  canvas.className = 'ink-atmosphere'; canvas.setAttribute('aria-hidden', 'true');
  const veil = document.createElement('div');
  veil.className = 'reading-veil'; veil.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas, veil);
  const ctx = canvas.getContext('2d', { alpha: true });
  let width = 0, height = 0, frame = 0, last = 0, previous = 0, dirty = true, disposed = false, chromeFrame = 0;
  const enabled = () => !preference && !motion.matches && !document.body.classList.contains('focused') && !document.hidden;
  function paint() {
    if (!ctx) return;
    paintInkWash(ctx, width, height, stats.time); dirty = false; stats.frames++;
  }
  function animate(now) {
    frame = 0;
    if (disposed) return;
    const active = enabled();
    if (now - last >= 83 || dirty) {
      if (active && previous) stats.time += Math.min(.12, (now - previous) / 1000);
      previous = now; last = now; paint();
    }
    if (active) frame = requestAnimationFrame(animate);
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(animate); }
  function resize() {
    const ratio = Math.min(1, 1280 / document.documentElement.clientWidth);
    width = Math.round(document.documentElement.clientWidth * ratio); height = Math.round(innerHeight * ratio);
    canvas.width = width; canvas.height = height; dirty = true; schedule(); syncChrome();
  }
  function sync() {
    stats.enabled = !preference && !motion.matches;
    document.body.classList.toggle('motion-paused', !stats.enabled);
    const toggle = $('motion-toggle');
    toggle.hidden = false; toggle.disabled = motion.matches;
    toggle.title = motion.matches ? '系统已启用减少动态效果' : '';
    toggle.setAttribute('aria-pressed', String(stats.enabled)); toggle.textContent = stats.enabled ? '动效开' : '动效停';
    toggle.setAttribute('aria-label', motion.matches ? '动态效果已按系统偏好关闭' : stats.enabled ? '暂停页面动态效果' : '开启页面动态效果');
    cancelAnimationFrame(frame); frame = 0; previous = 0; dirty = true; schedule();
    document.dispatchEvent(new Event('readingmotionchange'));
  }
  function toggleMotion() {
    preference = stats.enabled;
    try { sessionStorage.setItem('field-reader-paused', String(preference)); } catch {}
    sync();
  }

  const edge = document.createElement('aside');
  edge.className = 'edge-contents'; edge.setAttribute('aria-label', '本章目录与页面跳转');
  const tools = document.createElement('div'); tools.className = 'edge-tools';
  const trigger = $('open-outline');
  trigger.innerHTML = '<span class="edge-caption">小节</span><span class="edge-count">1/' + sections.length + '</span>';
  trigger.setAttribute('aria-label', '展开本章小节'); trigger.title = '本章小节';
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'edge-panel');
  const jumpButton = (id, label, symbol) => {
    const button = document.createElement('button');
    button.id = id; button.className = 'edge-jump'; button.type = 'button';
    button.setAttribute('aria-label', label); button.title = label;
    button.innerHTML = `<span aria-hidden="true">${symbol}</span>`; return button;
  };
  const toTop = jumpButton('edge-top', '回到正文开头', '↑');
  const toBottom = jumpButton('edge-bottom', '直达本章底部', '↓');
  const panel = document.createElement('div');
  panel.id = 'edge-panel'; panel.className = 'edge-panel'; panel.hidden = true;
  panel.innerHTML = '<header><span>本章小节</span><button aria-label="收起本章小节">×</button></header><nav aria-label="页边小节目录"></nav>';
  for (const [i, original] of [...$('outline-panel').children].entries()) {
    const a = document.createElement('a'), number = document.createElement('span');
    a.href = original.href; number.textContent = String(i + 1).padStart(2, '0');
    a.append(number, document.createTextNode(original.textContent));
    a.addEventListener('click', event => { event.preventDefault(); close(false); original.click(); });
    panel.querySelector('nav').append(a);
  }
  tools.append(toTop, trigger, toBottom); edge.append(tools, panel); document.body.append(edge);
  let pinned = false, timer = 0, restoring = false;
  function open() {
    clearTimeout(timer); panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); stats.outlineOpen = true;
  }
  function close(restore = false) {
    clearTimeout(timer); pinned = false; panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false'); stats.outlineOpen = false;
    if (restore) { restoring = true; trigger.focus({ preventScroll: true }); restoring = false; }
  }
  function toggleOutline() { if (pinned) close(false); else { pinned = true; open(); } }
  function enter() { if (fine.matches) open(); }
  function leave() { timer = setTimeout(() => { if (!pinned && !edge.contains(document.activeElement)) close(); }, 180); }
  function focusIn(event) { if (!restoring && (event.target === trigger || panel.contains(event.target))) open(); }
  function focusOut(event) { if (!edge.contains(event.relatedTarget) && !pinned) close(); }
  function escape(event) { if (event.key === 'Escape' && !panel.hidden) close(edge.contains(document.activeElement)); }
  function outside(event) { if (!edge.contains(event.target)) close(); }
  function closeButton() { close(true); }
  function bodyStart() {
    const marker = sections[0].querySelector('.section-marker') || sections[0];
    return Math.max(0, marker.getBoundingClientRect().top + scrollY - document.querySelector('.reader-chrome').offsetHeight - 24);
  }
  function jump(bottom) {
    close();
    const destination = bottom ? document.querySelector('.chapter-end') : sections[0].querySelector('h2');
    destination.tabIndex = -1; destination.focus({ preventScroll: true });
    scrollTo({ top: bottom ? document.documentElement.scrollHeight : bodyStart(), behavior: motion.matches ? 'instant' : 'smooth' });
  }
  toTop.addEventListener('click', () => jump(false)); toBottom.addEventListener('click', () => jump(true));
  trigger.addEventListener('pointerenter', enter); panel.addEventListener('pointerenter', enter);
  edge.addEventListener('pointerleave', leave); edge.addEventListener('focusin', focusIn); edge.addEventListener('focusout', focusOut);
  panel.querySelector('button').addEventListener('click', closeButton);
  document.addEventListener('keydown', escape); document.addEventListener('pointerdown', outside);

  function syncChrome() {
    chromeFrame = 0;
    const opening = $('opening'), chrome = document.querySelector('.reader-chrome');
    const dark = opening.classList.contains('survey-opening') && !document.body.classList.contains('focused')
      && opening.getBoundingClientRect().bottom > chrome.getBoundingClientRect().bottom + 16;
    document.body.classList.toggle('over-survey', dark);
    toTop.disabled = Math.abs(scrollY - bodyStart()) < 4;
    toBottom.disabled = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  }
  function scroll() { if (!chromeFrame) chromeFrame = requestAnimationFrame(syncChrome); }
  const bodyObserver = new MutationObserver(() => { dirty = true; schedule(); syncChrome(); });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const openingObserver = new MutationObserver(syncChrome);
  openingObserver.observe($('opening'), { attributes: true, attributeFilter: ['class'] });
  $('motion-toggle').addEventListener('click', toggleMotion); motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  addEventListener('resize', resize); addEventListener('scroll', scroll, { passive: true });

  function update(index) {
    trigger.querySelector('.edge-count').textContent = `${index + 1}/${sections.length}`;
    [...panel.querySelectorAll('nav a')].forEach((a, i) => {
      if (i === index) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    syncChrome();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stats.disposed = true; clearTimeout(timer);
    cancelAnimationFrame(frame); cancelAnimationFrame(chromeFrame); bodyObserver.disconnect(); openingObserver.disconnect();
    $('motion-toggle').removeEventListener('click', toggleMotion); motion.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync); removeEventListener('resize', resize); removeEventListener('scroll', scroll);
    document.removeEventListener('keydown', escape); document.removeEventListener('pointerdown', outside);
    removeEventListener('pagehide', pagehide); removeEventListener('pageshow', pageshow);
    canvas.remove(); veil.remove(); edge.remove(); document.body.classList.remove('over-survey');
  }
  function pagehide(event) {
    if (!event.persisted) dispose(); else { cancelAnimationFrame(frame); frame = 0; previous = 0; }
  }
  function pageshow() { previous = 0; resize(); sync(); }
  addEventListener('pagehide', pagehide); addEventListener('pageshow', pageshow);
  resize(); sync(); window.__readingStudy.effects = stats;
  return { update, toggleOutline, dispose };
}
