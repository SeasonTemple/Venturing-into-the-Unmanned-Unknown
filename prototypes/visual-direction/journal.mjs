// Reading aids are separate from the unmodified book content. No visits imply mastery.
const sketch = (kind) => {
  const paths = {
    boundary: '<path d="M18 112C65 20 152 10 205 60S235 140 286 102M27 128C82 47 149 35 188 77S225 163 292 123"/><path class="unfinished" d="M206 60C247 27 278 29 303 50M286 102L311 91"/><path class="accent" d="M41 114L105 87L160 108L209 69"/><circle cx="105" cy="87" r="4"/><circle cx="160" cy="108" r="4"/><text x="20" y="160">已表达的条件</text><text x="210" y="26">未表达？</text>',
    fork: '<path d="M30 110H100L160 45H280M100 110L163 142H280"/><path class="accent" d="M30 110H100L160 45H280"/><circle cx="100" cy="110" r="5"/><path class="unfinished" d="M280 45L305 45M280 142H305"/><text x="173" y="30">符合一种解释</text><text x="176" y="167">另一种解释？</text>',
    loop: '<path d="M46 45H260V132H46Z"/><path class="accent" d="M46 45H260V132H130"/><path class="unfinished" d="M130 132H46V45"/><path d="M253 38L260 45L253 52M137 125L130 132L137 139"/><text x="63" y="32">属性 → 检查 → 结果</text><text x="63" y="160">反例 → 回到规格</text>',
    tools: '<path d="M25 53H120M25 92H120M25 131H120M155 30V150H290"/><path class="accent" d="M120 92H155L205 92L248 53H290"/><circle cx="155" cy="92" r="5"/><text x="25" y="30">风险 / 语言 / 成本</text><text x="187" y="176">合适的验证强度</text>',
    lock: '<path d="M45 112H130M190 112H275M135 87V64C135 22 185 22 185 64V87M125 87H195V143H125Z"/><path class="accent" d="M45 112H101M219 112H275"/><path class="unfinished" d="M160 143V175"/><text x="24" y="98">请求 A</text><text x="235" y="98">请求 B</text><text x="132" y="198">互斥？超时？</text>',
  };
  return `<svg class="margin-sketch" viewBox="0 0 330 215" aria-hidden="true">${paths[kind] || paths.boundary}</svg>`;
};
const editorial = [
  ['出发前', '先写下，你想保证什么。', '“正确”太宽泛。带着一个具体风险阅读：并发互斥、内存安全，还是需求被误解？', 'boundary'],
  ['观察 01', '一道光，照不见全部层次。', '下面的层级图可以切换。留意每种证据回答的问题，以及它没有回答的问题。', 'boundary'],
  ['边界批注', '通过检查的，也可能是错误的解释。', '如果规格遗漏了超时，满足互斥的实现就足够了吗？把这个问题带入后面的写锁实例。', 'fork'],
  ['工具袋', '先辨认地形，再选工具。', '阅读工具表时，先找自己的语言与风险；没有合适证明器时，原文也给出了可走的路径。', 'tools'],
  ['证据线索', '反例不是终点。', '沿着流程往回找：失败来自实现，还是暴露了规格没有表达的条件？', 'loop'],
  ['尺度提醒', '模型是一张有取舍的地图。', '建模时省略了哪些状态？哪些省略会影响你准备检查的性质？', 'boundary'],
  ['贯穿实例', '沿着一把锁，追到证据的来处。', '这里的图是原文实例的阅读索引。它表示方法之间的联系，不表示实际执行过任何检查。', 'lock'],
  ['交给 Agent 前', '先给出性质，再交出工具。', '人的判断被写进属性、工具边界和门禁；Agent 的输出仍需要可核对的证据。', 'loop'],
  ['未封口的页边', '带回方法，留下问题。', '即使所有已定义检查都通过，还有哪些真实条件没有进入规格与模型？', 'boundary'],
];
const layers = [
  ['L0', '意图与表达', '需求是否被清晰表达？', '受控写作 / 正反例 / 不变量', '表达清楚，不代表设计已经正确。'],
  ['L1', '设计正确性', '协议与状态转换是否满足性质？', '模型检查 / 状态空间探索', '模型中的保证，仍依赖建模假设。'],
  ['L2', '实现安全与局部正确性', '实现的关键路径是否安全？', '契约 / 有界检查 / 语言级工具', '局部性质，不能代替完整行为验证。'],
  ['L3', '行为符合性', '选定场景中的行为是否符合预期？', '测试 / 场景与属性用例', '已测场景之外，仍可能有遗漏。'],
  ['L4', '持续保证', '这次变更是否破坏已有保证？', 'CI / 自动化回归', '持续执行，不能补上未定义的检查。'],
  ['L5', '可理解性与审计', '结果能否被解释与追溯？', '反例解释 / 文档 / 差异对比', '可追溯的证据，也有适用条件。'],
];
function plate() {
  const figure = document.createElement('figure'); figure.className = 'field-plate journal-extra';
  figure.innerHTML = `<figcaption><span>图版 01 / 保证的切面</span><span>阅读辅助 · 据本章分层模型</span></figcaption><div class="layer-select" role="group" aria-label="选择验证层级">${layers.map((l, i) => `<button aria-pressed="${i === 0}" data-layer="${i}">${l[0]}<span>${l[1]}</span></button>`).join('')}</div><div class="layer-detail"><div class="layer-drawing" aria-hidden="true"><svg viewBox="0 0 360 210"><path class="contour" d="M10 122L85 27L245 13L347 97L277 196L103 185ZM44 118L106 54L230 40L313 102L257 166L119 155ZM83 116L125 82L213 70L275 107L235 138L137 133Z"/><path class="unfinished" d="M245 13L322 6M347 97L360 96M277 196L318 207"/><path class="layer-slice" d="M54 113L108 67L232 56L301 106L252 155L122 148Z"/><text x="123" y="113" id="layer-code">L0 / 表达</text></svg></div><div class="layer-caption"><p class="kicker" id="layer-name"></p><h3 id="layer-question"></h3><p id="layer-method"></p></div></div><p class="layer-limit"><span>光照之外</span><span id="layer-limit"></span></p><p class="sr-only" id="layer-announcement" role="status"></p>`;
  function select(i, announce = false) { const layer = layers[i]; figure.querySelectorAll('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.layer) === i))); for (const [id, value] of [['layer-code', layer[0]], ['layer-name', layer[0] + ' / ' + layer[1]], ['layer-question', layer[2]], ['layer-method', layer[3]], ['layer-limit', layer[4]]]) figure.querySelector('#' + id).textContent = value; figure.style.setProperty('--slice-offset', `${i * 8 - 20}px`); if (announce) figure.querySelector('#layer-announcement').textContent = layer[2] + layer[4]; }
  figure.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => select(Number(b.dataset.layer), true))); select(0); return figure;
}
function casePlate() {
  const figure = document.createElement('figure'); figure.className = 'case-plate journal-extra';
  figure.innerHTML = `<figcaption><span>图版 02 / 一把写锁的证据线</span><span>阅读辅助 · 原文实例索引</span></figcaption><ol>${[['L0', '互斥与超时', '表达性质'], ['L1', '协议模型', '检查设计'], ['L2', '关键路径', '约束实现'], ['L3', '并发与差异', '观察行为'], ['CI', '回归', '持续检查']].map(l => `<li><span>${l[0]}</span><strong>${l[1]}</strong><small>${l[2]}</small></li>`).join('')}</ol><p>每条证据都应能回到最初要保证的性质。</p>`;
  return figure;
}
export function mountJournal({sections, slug, chapter, reduced, openNavigation}) {
  const $ = id => document.getElementById(id);
  document.body.classList.add('field-journal');
  document.querySelector('.wide-outline').hidden = true;
  $('guide').hidden = true;
  const left = document.querySelector('.wide-book'); left.className = 'field-route';
  const isVerification = slug === 'ch3';
  const starts = isVerification ? [0, 3, 5, 7] : [...new Set([0, Math.floor(sections.length / 3), Math.floor(sections.length * 2 / 3)])];
  const labels = isVerification ? [['辨明边界', '定位 / 分层 / 规格歧义'], ['采集证据', '工具选择 / 执行流程'], ['追踪反例', '模型检查 / 写锁实例'], ['带回方法', 'Agent 要点 / 本章要点']] : starts.map((i) => [sections[i]?.querySelector('h2')?.textContent || '正文', '阅读路线']);
  left.removeAttribute('aria-labelledby'); left.setAttribute('aria-label', '本章探索路线');
  left.innerHTML = `<p class="kicker">ROUTE / ${String(chapter.order).padStart(2, '0')}</p><h2>${isVerification ? '验证隘口' : chapter.title}</h2><p class="route-preface">${isVerification ? '从一个模糊的“正确”，<br>走向有边界的保证。' : '沿章节线索，逐步展开。'}</p><div class="route-map"><svg viewBox="0 0 240 420" aria-hidden="true"><g class="map-contours"><path d="M5 50Q75 0 129 51T233 52M0 80Q72 19 126 80T240 80M2 107Q68 53 127 112T240 110M0 210Q100 116 167 182T240 225M0 240Q96 148 157 211T240 250M0 273Q90 180 148 244T240 283M0 355Q64 290 123 339T240 359M0 386Q60 322 120 370T240 390"/></g><path class="map-trail" d="M54 35L75 80L53 132L95 180L69 232L109 282L76 334L119 390"/>${starts.map((_, i) => `<circle data-station="${i}" cx="${[54,95,69,119][i]}" cy="${[35,180,232,390][i]}" r="5"/>`).join('')}</svg><nav aria-label="阅读阶段">${starts.map((index, i) => `<a href="#${sections[index]?.querySelector('h2')?.id || 'body'}" data-route="${i}"><span>0${i + 1}</span><strong>${labels[i][0]}</strong><small>${labels[i][1]}</small></a>`).join('')}</nav></div><p class="route-key"><span>●</span> 当前阅读位置 · 可自由跳读</p><button class="route-book">展开全书章节 ↗</button><a class="route-return" href="./?view=space">返回探索空间 ↗</a>`;
  left.querySelector('.route-book').addEventListener('click', event => openNavigation('book', event.currentTarget));
  left.querySelectorAll('[data-route]').forEach(a => a.addEventListener('click', event => { event.preventDefault(); const h = sections[starts[Number(a.dataset.route)]]?.querySelector('h2'); if (!h) return; scrollTo({top:h.getBoundingClientRect().top + scrollY - 150, behavior:reduced() ? 'instant' : 'smooth'}); h.tabIndex = -1; h.focus({preventScroll:true}); history.replaceState(null,'','#'+h.id); }));
  for (const [i, section] of sections.entries()) {
    section.querySelector('.section-note')?.remove();
    const marker = section.querySelector('.section-marker'); marker.textContent = `原文 / ${String(chapter.order).padStart(2, '0')}.${String(i + 1).padStart(2, '0')}`;
    if (!isVerification) continue;
    const [label, title, text, drawing] = editorial[i];
    const note = document.createElement('aside'); note.className = 'section-note field-note'; note.setAttribute('aria-label', '阅读辅助批注');
    note.innerHTML = `<span class="note-label">${label} / 阅读辅助</span>${sketch(drawing)}<strong>${title}</strong><p>${text}</p>`;
    section.append(note);
    if (i === 1) {
      const content = section.querySelector('.section-content');
      const heading = content.querySelector('h2');
      (heading.parentElement === content ? heading : heading.parentElement).after(plate());
    }
    if (i === 6) section.querySelector('.section-content').after(casePlate());
    if (i === 4) section.classList.add('procedure-entry');
  }
  if (isVerification) {
    $('thesis').innerHTML = '每一份“通过”的证据，<br>都有它照不到的地方。';
    $('chapter-label').textContent = 'FIELD NOTES / 03';
    document.querySelector('.journal-label').textContent = ' / 验证隘口';
    $('description').textContent = '沿着规格、模型与反例，辨认正确性的边界。';
    $('chapter-art').innerHTML = `<svg viewBox="0 0 730 370" role="img" aria-labelledby="field-art-title"><title id="field-art-title">阅读场景示意：一条证据路径穿过有轮廓的已知区域，延伸向没有闭合的未知。</title><g class="cover-contours"><path d="M5 180C80 40 170 45 217 95S329 158 374 103S504 32 563 110S665 170 726 90M4 210C90 67 161 77 210 123S332 190 395 132S504 69 551 136S668 204 729 120M0 242C80 108 160 101 202 154S338 225 410 159S503 104 548 170S666 238 730 151M0 277C89 147 160 137 199 187S347 260 425 192S506 143 545 207S662 273 730 183M0 309C83 183 162 171 201 222S357 295 435 230S500 175 542 243S668 310 730 217"/></g><path class="cover-boundary" d="M480 17L471 85L491 143L478 201L502 272L481 348"/><path class="cover-route" d="M71 268L153 196L233 224L333 158L424 193L480 151"/><path class="cover-unknown" d="M480 151L561 190L625 126L699 148"/><g class="cover-stations"><circle cx="71" cy="268" r="6"/><circle cx="233" cy="224" r="6"/><circle cx="424" cy="193" r="6"/></g><g class="cover-labels"><text x="55" y="305">意图</text><text x="214" y="261">模型</text><text x="405" y="230">证据</text><text x="532" y="58">尚未表达的条件</text><text x="536" y="292">?</text><text x="612" y="248">?</text></g><text class="cover-register" x="22" y="24">FIG. 03 / A PARTIAL SURVEY</text><path class="cover-cross" d="M16 348H42M29 335V361M685 18H711M698 5V31"/></svg><figcaption><span>阅读场景 / 不是实际验证结果</span><span>已知的轮廓，未闭合的边界</span></figcaption>`;
  }
  const end = document.createElement('aside'); end.className = 'open-question journal-extra'; end.innerHTML = `<p class="kicker">CONTINUED / 下一次探索</p><h2>这一页结束，未知还没有。</h2><p>把本章的方法带回项目：你现在能拿出哪些证据？还有哪些条件，尚未被写入规格？</p><span aria-hidden="true">··· →</span>`;
  if (isVerification) $('body').after(end);
  return { update(index) { const phase = Math.max(0, starts.findLastIndex(start => index >= start)); left.querySelectorAll('[data-route]').forEach(a => { if (Number(a.dataset.route) === phase) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); }); left.querySelectorAll('[data-station]').forEach(e => e.classList.toggle('current', Number(e.dataset.station) === phase)); } };
}
