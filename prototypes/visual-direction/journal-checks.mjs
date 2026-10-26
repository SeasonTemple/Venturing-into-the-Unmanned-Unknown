export async function run({ send, evaluate, until, pause, check, report }) {
  const open = async (url) => { await send('Page.navigate', {url:'http://127.0.0.1:4395/' + url}); await until('window.__readingStudy?.ready'); };
  const equal = slug => evaluate(`(async()=>{const source=new DOMParser().parseFromString(await(await fetch('/chapters/${slug}')).text(),'text/html').querySelector('.sl-markdown-content');source.querySelectorAll('script').forEach(e=>e.remove());const actual=Array.from(document.querySelectorAll('.section-content'),e=>{const c=e.cloneNode(true);c.querySelectorAll('.copy-source,.table-hint,.journal-extra').forEach(e=>e.remove());return c.textContent}).join('');return actual.replace(/\\s/g,'')===source.textContent.replace(/\\s/g,'')})()`);
  await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Emulation.setDeviceMetricsOverride', {width:2560,height:1440,deviceScaleFactor:1,mobile:false});
  await open('reading.html?section=2');
  check('journal is the default and chapter source is complete in original order', await equal('ch3') && await evaluate('window.__readingStudy.layout==="journal" && window.__readingStudy.errors.length===0'));
  check('route replaces the ten-chapter rail; the right outline is removed', await evaluate('document.querySelectorAll("[data-route]").length===4 && !document.getElementById("wide-book-links") && getComputedStyle(document.querySelector(".wide-outline")).display==="none"'));
  check('nine contextual notes, layer diagram and case diagram span the actual body', await evaluate('document.querySelectorAll(".field-note").length===9 && document.querySelectorAll(".field-plate").length===1 && document.querySelectorAll(".case-plate").length===1 && document.querySelectorAll("#body table").length===3'));
  for (const width of [2560,2048,1707,1440,1024,760,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1152,deviceScaleFactor:1,mobile:width===390}); await pause(80);
    const metric = await evaluate(`({viewport:innerWidth,page:document.documentElement.scrollWidth,body:document.querySelector('.section-content').getBoundingClientRect().width,prose:document.querySelector('.section-content > p').getBoundingClientRect().width,font:getComputedStyle(document.querySelector('.section-content')).fontSize,note:document.querySelector('.field-note').getBoundingClientRect().width,route:getComputedStyle(document.querySelector('.field-route')).position})`);
    report.metrics[width] = metric;
    check(`${width}px: reading and annotations stay within page with bounded prose measure`, metric.page<=metric.viewport && metric.body>250 && metric.prose<=800,metric);
  }
  await evaluate('document.querySelector(\'[data-layer="4"]\').focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  const layerResult = await evaluate('({code:document.getElementById("layer-code").textContent,pressed:document.querySelectorAll(".layer-select [aria-pressed=true]").length,limit:document.getElementById("layer-limit").textContent,announcement:document.getElementById("layer-announcement").textContent,active:document.activeElement.outerHTML})');
  check('keyboard layer switch explains the uncovered condition and announces it',layerResult.code==='L4' && layerResult.pressed===1 && layerResult.limit.includes('未定义') && layerResult.announcement.length>0,layerResult);
  await evaluate('document.querySelectorAll("[data-route]")[2].click()'); await pause(90);
  check('route navigation focuses the original heading and marks the reading phase', await evaluate('document.activeElement.tagName==="H2" && document.activeElement.textContent.includes("模型检查") && document.querySelector(\'[data-route="2"]\').getAttribute("aria-current")==="location"'));
  await evaluate('document.getElementById("open-navigation").click(); document.getElementById("book-tab").focus()');
  check('all chapters remain openly accessible in the dialog',await evaluate('document.getElementById("navigation").open && document.querySelectorAll("#book-panel a").length===10'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  check('keyboard tab exposes every original subsection',await evaluate('document.activeElement.id==="outline-tab" && !document.getElementById("outline-panel").hidden && document.querySelectorAll("#outline-panel a").length===9'));
  await evaluate('document.querySelectorAll("#outline-panel a")[1].click()');
  check('outline jump closes the dialog and focuses real heading',await evaluate('!document.getElementById("navigation").open && document.activeElement.tagName==="H2" && document.activeElement.getBoundingClientRect().top>=120'));
  await evaluate('document.getElementById("focus").click()');
  check('focused reading hides aids while preserving the full book content',await equal('ch3') && await evaluate('window.__readingStudy.focused && [...document.querySelectorAll(".journal-extra,.field-note,.field-route")].every(e=>getComputedStyle(e).display==="none")'));
  await evaluate('document.getElementById("focus").click(); document.getElementById("open-navigation").click()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  check('Escape closes the modal and restores its trigger', await evaluate('!document.getElementById("navigation").open && document.activeElement.id==="open-navigation"'));
  await evaluate('document.getElementById("next-chapter").click()'); await until('window.__readingStudy?.ready && window.__readingStudy.chapter==="ch4"');
  check('another chapter remains complete and does not inherit verification-specific aids',await equal('ch4') && await evaluate('document.getElementById("chapter-art").hidden && document.querySelectorAll(".field-note,.field-plate,.case-plate").length===0 && window.__readingStudy.errors.length===0'));
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1200,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/reading-wide.html'}); await until('document.getElementById("preview")?.contentWindow.__readingStudy?.ready');
  check('2K board embeds a full journal viewport without scrolling the parent',await evaluate('scrollY===0 && document.getElementById("preview").contentWindow.innerWidth===2560 && document.getElementById("preview").contentWindow.scrollY>300'));
  await evaluate('document.getElementById("case").click()'); await until('document.getElementById("preview").contentWindow.__readingStudy?.ready && document.getElementById("preview").contentWindow.location.search.includes("section=7")');
  check('case preview reveals the evidence chain and keeps parent in place',await evaluate('scrollY===0 && document.getElementById("preview").contentDocument.querySelector(".case-plate").getBoundingClientRect().top<1000'));
  const lum = hex => { const v=hex.match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722; };
  const pairs=[['202e33','f0eee7'],['515f61','f0eee7'],['914526','f0eee7'],['c0cbc1','14252b'],['e5e8dc','14252b'],['eeb480','14252b']];
  report.metrics.contrast=pairs.map(([a,b])=>Number(((Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)).toFixed(2)));
  check('all journal text pairs meet 4.5 contrast',report.metrics.contrast.every(n=>n>=4.5),report.metrics.contrast);
  check('no browser runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
