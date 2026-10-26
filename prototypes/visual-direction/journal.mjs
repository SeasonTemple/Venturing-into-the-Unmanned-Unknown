import { createReaderAtmosphere } from './reader-atmosphere.mjs';
import { chapterSurveys } from './chapter-surveys.mjs';
import { createLayerPlate as plate } from './layer-plate.mjs';
// Reading aids are separate from the unmodified book content. No visits imply mastery.
const editorial = [
  ['出发前', '先写下，你想保证什么。', '“正确”太宽泛。带着一个具体风险阅读：并发互斥、内存安全，还是需求被误解？'],
  ['观察 01', '一道光，照不见全部层次。', '下面的层级图可以切换。留意每种证据回答的问题，以及它没有回答的问题。'],
  ['边界批注', '通过检查的，也可能是错误的解释。', '如果规格遗漏了超时，满足互斥的实现就足够了吗？把这个问题带入后面的写锁实例。'],
  ['工具袋', '先辨认地形，再选工具。', '阅读工具表时，先找自己的语言与风险；没有合适证明器时，原文也给出了可走的路径。'],
  ['证据线索', '反例不是终点。', '沿着流程往回找：失败来自实现，还是暴露了规格没有表达的条件？'],
  ['尺度提醒', '模型是一张有取舍的地图。', '建模时省略了哪些状态？哪些省略会影响你准备检查的性质？'],
  ['贯穿实例', '沿着一把锁，追到证据的来处。', '这里的图是原文实例的阅读索引。它表示方法之间的联系，不表示实际执行过任何检查。'],
  ['交给 Agent 前', '先给出性质，再交出工具。', '人的判断被写进属性、工具边界和门禁；Agent 的输出仍需要可核对的证据。'],
  ['未封口的页边', '带回方法，留下问题。', '即使所有已定义检查都通过，还有哪些真实条件没有进入规格与模型？'],
];
function casePlate() {
  const figure = document.createElement('figure'); figure.className = 'case-plate journal-extra';
  figure.innerHTML = `<figcaption><span>图版 02 / 一把写锁的证据线</span><span>阅读辅助 · 原文实例索引</span></figcaption><ol>${[['L0', '互斥与超时', '表达性质'], ['L1', '协议模型', '检查设计'], ['L2', '关键路径', '约束实现'], ['L3', '并发与差异', '观察行为'], ['CI', '回归', '持续检查']].map(l => `<li><span>${l[0]}</span><strong>${l[1]}</strong><small>${l[2]}</small></li>`).join('')}</ol><p>每条证据都应能回到最初要保证的性质。</p>`;
  return figure;
}
export function mountJournal({sections, slug, chapter, reduced, openNavigation}) {
  const $ = id => document.getElementById(id);
  document.body.classList.add('field-journal');
  $('top').textContent = '回到正文开头 ↑';
  document.querySelector('.wide-outline').hidden = true;
  $('guide').hidden = true;
  const left = document.querySelector('.wide-book'); left.className = 'field-route';
  const atmosphere = createReaderAtmosphere(sections);
  const isVerification = slug === 'ch3';
  const starts = isVerification ? [0, 3, 5, 7] : [...new Set([0, Math.floor(sections.length / 3), Math.floor(sections.length * 2 / 3)])];
  const labels = isVerification ? [['辨明边界', '定位 / 分层 / 规格歧义'], ['采集证据', '工具选择 / 执行流程'], ['追踪反例', '模型检查 / 写锁实例'], ['带回方法', 'Agent 要点 / 本章要点']] : starts.map((i) => [sections[i]?.querySelector('h2')?.textContent || '正文', '阅读路线']);
  left.removeAttribute('aria-labelledby'); left.setAttribute('aria-label', '本章探索路线');
  left.innerHTML = `<p class="kicker">ROUTE / ${String(chapter.order).padStart(2, '0')}</p><h2>${isVerification ? '验证隘口' : chapter.title}</h2><p class="route-preface">${isVerification ? '从一个模糊的“正确”，<br>走向有边界的保证。' : '沿章节线索，逐步展开。'}</p><div class="route-map"><svg viewBox="0 0 240 420" aria-hidden="true"><g class="map-contours"><path d="M5 50Q75 0 129 51T233 52M0 80Q72 19 126 80T240 80M2 107Q68 53 127 112T240 110M0 210Q100 116 167 182T240 225M0 240Q96 148 157 211T240 250M0 273Q90 180 148 244T240 283M0 355Q64 290 123 339T240 359M0 386Q60 322 120 370T240 390"/></g><path class="map-trail" d="M54 35L75 80L53 132L95 180L69 232L109 282L76 334L119 390"/>${starts.map((_, i) => `<circle data-station="${i}" cx="${[54,95,69,119][i]}" cy="${[35,180,232,390][i]}" r="5"/>`).join('')}</svg><nav aria-label="阅读阶段">${starts.map((index, i) => `<a href="#${sections[index]?.querySelector('h2')?.id || 'body'}" data-route="${i}"><span>0${i + 1}</span><strong>${labels[i][0]}</strong><small>${labels[i][1]}</small></a>`).join('')}</nav></div><p class="route-key"><span>●</span> 当前阅读位置 · 可自由跳读</p><button class="route-book">展开全书章节 ↗</button><a class="route-return" href="./?view=space">返回探索空间 ↗</a>`;
  left.querySelector('.route-book').addEventListener('click', event => openNavigation('book', event.currentTarget));
  // A short viewport scrolls the whole page instead of creating a second scrollbar.
  const fitRoute = () => left.classList.toggle('route-flow', left.offsetHeight > innerHeight - 130);
  const routeSize = new ResizeObserver(fitRoute); routeSize.observe(left);
  addEventListener('resize', fitRoute); fitRoute();
  addEventListener('pagehide', event => { if (!event.persisted) { routeSize.disconnect(); removeEventListener('resize', fitRoute); } });
  left.querySelectorAll('[data-route]').forEach(a => a.addEventListener('click', event => { event.preventDefault(); const h = sections[starts[Number(a.dataset.route)]]?.querySelector('h2'); if (!h) return; scrollTo({top:h.getBoundingClientRect().top + scrollY - 150, behavior:reduced() ? 'instant' : 'smooth'}); h.tabIndex = -1; h.focus({preventScroll:true}); history.replaceState(null,'','#'+h.id); }));
  for (const [i, section] of sections.entries()) {
    section.querySelector('.section-note')?.remove();
    const marker = section.querySelector('.section-marker'); marker.textContent = `原文 / ${String(chapter.order).padStart(2, '0')}.${String(i + 1).padStart(2, '0')}`;
    if (!isVerification) continue;
    const [label, title, text] = editorial[i];
    const note = document.createElement('aside'); note.className = 'section-note field-note'; note.setAttribute('aria-label', '阅读辅助批注');
    note.innerHTML = `<span class="note-label">${label} / 阅读辅助</span><strong>${title}</strong><p>${text}</p>`;
    section.append(note);
    if (i === 1) {
      const content = section.querySelector('.section-content');
      const heading = content.querySelector('h2');
      (heading.parentElement === content ? heading : heading.parentElement).after(plate());
    }
    if (i === 6) section.querySelector('.section-content').after(casePlate());
    if (i === 4) section.classList.add('procedure-entry');
  }
  {
    const survey = chapterSurveys[slug];
    $('opening').classList.add('survey-opening');
    $('opening').classList.toggle('long-title', chapter.title.length > 4);
    $('thesis').replaceChildren(document.createTextNode(survey.thesis[0]),document.createElement('br'),document.createTextNode(survey.thesis[1]));
    $('chapter-label').textContent = 'FIELD NOTES / ' + String(chapter.order).padStart(2,'0');
    document.querySelector('.journal-label').textContent = ' / ' + (isVerification?'验证隘口':chapter.title);
    $('description').hidden = false;
    $('description').textContent = isVerification?'沿着规格、模型与反例，辨认正确性的边界。':chapter.blurb;
    $('chapter-art').hidden = false;
    $('chapter-art').surveyConfig = survey;
    $('chapter-art').innerHTML = `<svg viewBox="0 0 730 370" role="img" aria-labelledby="field-art-title"><title id="field-art-title">阅读场景示意：一条证据路径穿过有轮廓的已知区域，延伸向没有闭合的未知。</title><g class="cover-contours"><path d="M5 180C80 40 170 45 217 95S329 158 374 103S504 32 563 110S665 170 726 90M4 210C90 67 161 77 210 123S332 190 395 132S504 69 551 136S668 204 729 120M0 242C80 108 160 101 202 154S338 225 410 159S503 104 548 170S666 238 730 151M0 277C89 147 160 137 199 187S347 260 425 192S506 143 545 207S662 273 730 183M0 309C83 183 162 171 201 222S357 295 435 230S500 175 542 243S668 310 730 217"/></g><path class="cover-boundary" d="M480 17L471 85L491 143L478 201L502 272L481 348"/><path class="cover-route" d="M71 268L153 196L233 224L333 158L424 193L480 151"/><path class="cover-unknown" d="M480 151L561 190L625 126L699 148"/><g class="cover-stations"><circle cx="71" cy="268" r="6"/><circle cx="233" cy="224" r="6"/><circle cx="424" cy="193" r="6"/></g><g class="cover-labels"><text x="55" y="305">意图</text><text x="214" y="261">模型</text><text x="405" y="230">证据</text><text x="532" y="58">尚未表达的条件</text><text x="536" y="292">?</text><text x="612" y="248">?</text></g><text class="cover-register" x="22" y="24">FIG. 03 / A PARTIAL SURVEY</text><path class="cover-cross" d="M16 348H42M29 335V361M685 18H711M698 5V31"/></svg><figcaption>测绘示意 · 不是实际验证结果</figcaption>`;
  }
  {
    const labels = $('chapter-art').querySelectorAll('.cover-labels text');
    labels.forEach((label,i)=>{if(i<3)label.textContent=chapterSurveys[slug].nodes[i];else if(i===3)label.textContent=chapterSurveys[slug].unknown;});
    $('chapter-art').querySelector('.cover-register').textContent='FIG. '+String(chapter.order).padStart(2,'0')+' / A PARTIAL SURVEY';
    $('chapter-art').querySelector('figcaption').textContent = isVerification?'局部测绘 / 沿证据路径辨认边界':'局部测绘 / '+chapter.title;
    const artwork = { status: 'loading', errors: [] }; window.__readingStudy.artwork = artwork;
    // The book opens independently; failed WebGL keeps the original SVG illustration.
    import('./journal-terrain.mjs').then(module => {
      artwork.controller = module.createJournalTerrain($('chapter-art'));
      artwork.status = artwork.controller ? 'ready' : 'fallback';
    }).catch(error => { artwork.status = 'fallback'; artwork.errors.push(error.message); });
  }
  const end = document.createElement('aside'); end.className = 'open-question journal-extra'; end.innerHTML = `<p class="kicker">CONTINUED / 下一次探索</p><h2>这一页结束，未知还没有。</h2><p>把本章的方法带回项目：你现在能拿出哪些证据？还有哪些条件，尚未被写入规格？</p><span aria-hidden="true">··· →</span>`;
  if (isVerification) $('body').after(end);
  return { toggleOutline: atmosphere.toggleOutline, update(index) { atmosphere.update(index); const phase = Math.max(0, starts.findLastIndex(start => index >= start)); left.querySelectorAll('[data-route]').forEach(a => { if (Number(a.dataset.route) === phase) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); }); left.querySelectorAll('[data-station]').forEach(e => e.classList.toggle('current', Number(e.dataset.station) === phase)); } };
}
