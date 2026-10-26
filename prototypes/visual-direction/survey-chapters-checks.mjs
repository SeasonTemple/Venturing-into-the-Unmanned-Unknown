export async function run({send,evaluate,until,pause,check,report}) {
  const chapters=[['ch0','导论','人/Agent/协作'],['ch1','意图与需求','问题/边界/验收'],['ch2','设计与架构','分解/契约/决策'],['ch3','验证','意图/模型/证据'],['ch4','实现','契约/模块/代码'],['ch5','测试与质量保障','场景/属性/反例'],['ch6','集成与交付','集成/门禁/发布'],['ch7','持续演进','反馈/变更/回归'],['ch8','工具与技能生态','选择/组织/维护'],['chA','清单 / 术语 / 反模式','清单/术语/反模式']];
  report.metrics.chapterSurveys=[];
  for(const width of [1440,390])for(const [slug,title,nodes] of chapters) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await send('Page.navigate',{url:'http://127.0.0.1:4395/reading.html?chapter='+slug});
    await until('window.__readingStudy?.ready && window.__readingStudy.artwork?.status==="ready"');
    await until('window.__readingStudy.artwork.controller.stats.frames>0');await pause(40);
    const m=await evaluate(`(()=>{const h=document.getElementById('opening').getBoundingClientRect(),copy=document.querySelector('.opening-copy').getBoundingClientRect();return {chapter:window.__readingStudy.chapter,title:document.getElementById('chapter-title').textContent,nodes:[...document.querySelectorAll('.terrain-label')].map(e=>e.textContent).join('/'),width:innerWidth,page:document.documentElement.scrollWidth,copyFraction:(copy.bottom-h.top)/h.height,canvas:document.querySelectorAll('#chapter-art canvas').length,landmarks:window.__readingStudy.artwork.controller.stats.landmarks,lighting:window.__readingStudy.artwork.controller.stats.lighting,errors:window.__readingStudy.errors};})()`);
    report.metrics.chapterSurveys.push(m);
    check(`${slug} ${width}px: chapter-specific survey, relief lighting and compact title fit`,m.title===title&&m.nodes===nodes&&m.canvas===1&&m.landmarks===3&&m.lighting==='directional-relief'&&m.page<=width&&m.copyFraction<.42&&m.errors.length===0,m);
    if(width===1440) {
      const equal=await evaluate(`(async()=>{const source=new DOMParser().parseFromString(await(await fetch('/chapters/${slug}')).text(),'text/html').querySelector('.sl-markdown-content');source.querySelectorAll('script').forEach(e=>e.remove());const text=[...document.querySelectorAll('.section-content')].map(e=>{const c=e.cloneNode(true);c.querySelectorAll('.copy-source,.table-hint,.journal-extra').forEach(e=>e.remove());return c.textContent}).join('');return text.replace(/\\s/g,'')===source.textContent.replace(/\\s/g,'');})()`);
      check(`${slug}: all original prose, tables and code remain in order`,equal);
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/reading.html?section=2'});await until('window.__readingStudy?.ready');
  const slices=await evaluate(`(()=>{const states=[];for(const b of document.querySelectorAll('[data-layer]')){b.click();states.push({beam:document.getElementById('layer-beam').getAttribute('d'),plane:document.getElementById('lit-plane').getAttribute('transform'),evidence:document.getElementById('layer-evidence').textContent,pressed:document.querySelectorAll('[data-layer][aria-pressed=true]').length});}return states;})()`);
  check('each evidence layer changes the illuminated plane, beam and actual evidence description',slices.length===6&&new Set(slices.map(s=>s.beam)).size===6&&new Set(slices.map(s=>s.plane)).size===6&&new Set(slices.map(s=>s.evidence)).size===6&&slices.every(s=>s.pressed===1),slices);
}
