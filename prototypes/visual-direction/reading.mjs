const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const layout = params.get('layout') === 'journal' ? 'journal' : 'atlas';
const slug = /^ch[0-8A]$/.test(params.get('chapter')) ? params.get('chapter') : 'ch3';
document.body.dataset.layout = layout;
$('preview-name').textContent = `${layout === 'journal' ? '探索手记' : '图解技术书'} · 阅读样张`;
const state = { ready: false, errors: [], chapter: slug, layout, sections: 0, focused: false };
window.__readingStudy = state;
const canonical = `https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/${slug}/`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const notes = new Map([
  [1, ['阅读线索', '先区分“要保证什么”。', 'L0–L5 是不同层面的保证。不能把一次测试通过，等同于所有层次都已覆盖。']],
  [2, ['剩余未知', '规格本身也有边界。', '本节指出理解冲突与规格偏差是常态。检查通过，仍需追问哪些条件没有被表达。']],
  [4, ['证据记录', '让结果能够被追溯。', '把可执行属性、检查结果与反例解释放在一起，才能判断当前产物是在什么条件下被接受。']],
  [6, ['回到实例', '看完整链条，不只看工具。', '资源写锁的例子贯穿表达、模型、实现、测试与回归。沿着这条线检查证据是否连贯。']],
]);
const button = (label, action, className) => { const el = document.createElement('button'); el.textContent = label; if (className) el.className = className; el.addEventListener('click', action); return el; };
function showTab(name, focus = false) {
  for (const key of ['book', 'outline']) { const active = key === name; $(`${key}-tab`).setAttribute('aria-selected', String(active)); $(`${key}-tab`).tabIndex = active ? 0 : -1; $(`${key}-panel`).hidden = !active; }
  if (focus) $(`${name}-tab`).focus();
}
function openNavigation(tab = 'book') { showTab(tab); $('navigation').showModal(); }
$('open-navigation').addEventListener('click', () => openNavigation());
$('open-outline').addEventListener('click', () => openNavigation('outline'));
$('close-navigation').addEventListener('click', () => $('navigation').close());
for (const key of ['book', 'outline']) {
  $(`${key}-tab`).addEventListener('click', () => showTab(key));
  $(`${key}-tab`).addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); showTab(event.key === 'Home' ? 'book' : event.key === 'End' ? 'outline' : key === 'book' ? 'outline' : 'book', true); } });
}
$('navigation').addEventListener('click', event => { if (event.target === $('navigation')) { const box = $('navigation').getBoundingClientRect(); if (event.clientX < box.left || event.clientY < box.top || event.clientX > box.right || event.clientY > box.bottom) $('navigation').close(); } });
$('focus').addEventListener('click', () => {
  const anchor = document.querySelector('.article-section[data-current=true]') || $('body');
  const inBody = window.scrollY > $('opening').offsetTop + $('opening').offsetHeight;
  state.focused = document.body.classList.toggle('focused'); $('focus').setAttribute('aria-pressed', String(state.focused)); $('focus').textContent = state.focused ? '完整阅读' : '专注阅读';
  if (inBody) anchor.scrollIntoView({ behavior: 'instant', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'instant' });
  updatePosition();
});
$('top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced() ? 'instant' : 'smooth' }));
let queued = false, sections = [], activeSection = null;
function updatePosition() {
  queued = false; const height = document.documentElement.scrollHeight - innerHeight;
  $('progress').style.transform = `scaleX(${height > 0 ? Math.max(0, Math.min(1, scrollY / height)) : 0})`;
  const current = sections.findLast(section => section.getBoundingClientRect().top < 175) || sections[0];
  if (current && current !== activeSection) {
    activeSection = current; sections.forEach(section => section.dataset.current = String(section === current)); const heading = current.querySelector('h2'); $('current-section').textContent = heading.textContent; $('current-section').href = '#' + heading.id;
    for (const link of $('wide-outline-links').children) { if (link.hash.slice(1) === encodeURIComponent(heading.id) || decodeURIComponent(link.hash.slice(1)) === heading.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }
    const note = current.querySelector('.section-note'); $('wide-note').hidden = !note; $('wide-note').replaceChildren(...(note ? Array.from(note.childNodes, child => child.cloneNode(true)) : []));
  }
}
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(updatePosition); } };
addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule);
try {
  const responses = await Promise.all([fetch('/content.json'), fetch(`/chapters/${slug}`)]);
  if (responses.some(response => !response.ok)) throw Error('章节暂不可用，请先构建站点。');
  const [book, html] = await Promise.all([responses[0].json(), responses[1].text()]);
  const chapter = book.chapters.find(chapter => chapter.slug === slug);
  const source = new DOMParser().parseFromString(html, 'text/html').querySelector('.sl-markdown-content');
  if (!source || !chapter) throw Error('未找到完整章节。');
  source.querySelectorAll('script').forEach(script => script.remove());
  $('chapter-title').textContent = chapter.title; $('running-title').textContent = chapter.title;
  $('chapter-label').textContent = `${chapter.label} / ${String(chapter.order).padStart(2, '0')}`;
  $('running-number').textContent = chapter.order.padStart(2, '0'); $('description').textContent = chapter.blurb;
  document.title = `${chapter.title} · ${layout === 'journal' ? '探索手记' : '图解技术书'}`;
  if (slug !== 'ch3') { $('thesis').textContent = chapter.blurb; $('description').hidden = true; $('chapter-art').hidden = true; $('guide').hidden = true; }
  $('body').replaceChildren(); let group, content, ordinal = 0;
  for (const node of Array.from(source.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) { if (content) content.append(node.cloneNode()); continue; }
    const heading = node.nodeType === Node.ELEMENT_NODE && (node.matches('h2') ? node : node.querySelector('h2'));
    if (heading || !group) {
      group = document.createElement('section'); group.className = 'article-section';
      const marker = document.createElement('span'); marker.className = 'section-marker'; marker.setAttribute('aria-hidden', 'true'); marker.textContent = String(++ordinal).padStart(2, '0');
      content = document.createElement('div'); content.className = 'section-content'; group.append(marker, content); $('body').append(group);
      if (slug === 'ch3' && notes.has(ordinal - 1)) { const [label, title, text] = notes.get(ordinal - 1); const note = document.createElement('aside'); note.className = 'section-note'; const eyebrow = document.createElement('span'); eyebrow.className = 'note-label'; eyebrow.textContent = label; const name = document.createElement('strong'); name.textContent = title; note.append(eyebrow, name, document.createTextNode(text)); group.append(note); }
    }
    // Original prose, tables, links and headings retain their order and IDs.
    content.append(document.importNode(node, true));
  }
  for (const section of $('body').querySelectorAll('.article-section')) {
    const heading = section.querySelector('h2'); if (!heading) continue;
    const label = heading.cloneNode(true); label.querySelectorAll('.sl-anchor-link').forEach(anchor => anchor.remove());
    for (const target of ['outline-panel', 'wide-outline-links']) {
      const link = document.createElement('a'); link.href = '#' + heading.id; link.textContent = label.textContent;
      link.addEventListener('click', event => { event.preventDefault(); if ($('navigation').open) $('navigation').close(); window.scrollTo({ top: heading.getBoundingClientRect().top + scrollY - 140, behavior: reduced() ? 'instant' : 'smooth' }); if (reduced()) updatePosition(); heading.tabIndex = -1; heading.focus({ preventScroll: true }); history.replaceState(null, '', '#' + heading.id); }); $(target).append(link);
    }
  }
  for (const table of $('body').querySelectorAll('table')) { const wrapper = document.createElement('div'); wrapper.className = 'table-scroll'; wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', '可横向滚动的章节表格'); const hint = document.createElement('span'); hint.className = 'table-hint'; hint.textContent = '横向滑动查看完整表格 →'; table.before(hint, wrapper); wrapper.append(table); }
  for (const pre of $('body').querySelectorAll('pre')) {
    const copy = button('复制代码 ↗', async () => { try { await navigator.clipboard.writeText(pre.textContent); copy.textContent = '已复制'; $('status').textContent = '代码已复制'; } catch { copy.textContent = '可选择代码后复制'; } }, 'copy-source'); pre.before(copy);
  }
  for (const link of $('body').querySelectorAll('a[href]')) if (!link.getAttribute('href').startsWith('#')) { link.href = new URL(link.getAttribute('href'), canonical).href; link.target = '_blank'; link.rel = 'noopener'; }
  for (const chapter of book.chapters) { const link = document.createElement('a'); link.href = `?layout=${layout}&chapter=${chapter.slug}`; const number = document.createElement('span'); number.textContent = chapter.order.padStart(2, '0'); link.append(number, document.createTextNode(chapter.title)); if (chapter.slug === slug) link.setAttribute('aria-current', 'page'); $('book-panel').append(link); $('wide-book-links').append(link.cloneNode(true)); }
  const next = book.chapters[(book.chapters.indexOf(chapter) + 1) % book.chapters.length]; $('next-chapter').href = `?layout=${layout}&chapter=${next.slug}`; $('next-chapter').replaceChildren(document.createTextNode(next.title)); const arrow = document.createElement('span'); arrow.textContent = '↗'; $('next-chapter').append(arrow);
  sections = Array.from($('body').querySelectorAll('.article-section')); state.sections = sections.length; updatePosition();
  const initialHeading = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : params.has('section') ? sections[Number(params.get('section')) - 1]?.querySelector('h2') : null;
  // Scroll this document only; scrollIntoView would also move an embedding review page.
  if (initialHeading) window.scrollTo({ top: initialHeading.getBoundingClientRect().top + scrollY - 140, behavior: 'instant' });
  updatePosition();
} catch (error) { state.errors.push(error.message); $('body').textContent = error.message; }
finally { state.ready = true; $('body').setAttribute('aria-busy', 'false'); }
