export async function run({send,evaluate,until,pause,check,report}) {
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:970,deviceScaleFactor:1,mobile:false});
  for (const layout of ['atlas','journal']) {
    await send('Page.navigate',{url:`http://127.0.0.1:4395/reading.html?layout=${layout}`});
    await until(`window.__readingStudy?.ready && window.__readingStudy.layout==="${layout}"`);
    const data=await evaluate(`(async()=>{
      const doc=new DOMParser().parseFromString(await(await fetch('/chapters/ch3')).text(),'text/html');
      const expected=doc.querySelector('.sl-markdown-content');expected.querySelectorAll('script').forEach(e=>e.remove());
      const sections=Array.from(document.querySelectorAll('.section-content'),e=>{const c=e.cloneNode(true);c.querySelectorAll('.copy-source,.table-hint,.journal-extra').forEach(e=>e.remove());return c.textContent}).join('');
      return {equal:sections.replace(/\s/g,'')===expected.textContent.replace(/\s/g,''),headings:document.querySelectorAll('#body h2').length,tables:document.querySelectorAll('#body table').length,outline:document.querySelectorAll('#outline-panel a').length,width:innerWidth,page:document.documentElement.scrollWidth,canvas:document.querySelectorAll('canvas').length,notes:document.querySelectorAll('.section-note').length,errors:window.__readingStudy.errors};
    })()`);
    report.metrics[layout]=data;
    check(`${layout}: complete original prose, table content, code and ordering preserved`,data.equal && data.headings===9 && data.tables===3,data);
    check(`${layout}: navigation stays on demand and optional artwork does not overflow reading`,data.outline===9 && data.page<=data.width && data.canvas<=(layout==='journal'?2:0) && !await evaluate('document.getElementById("navigation").open'));
    await evaluate('document.getElementById("open-navigation").click()');
    check(`${layout}: chapter menu exposes ten genuine chapters`,await evaluate('document.getElementById("navigation").open && document.querySelectorAll("#book-panel a").length===10'));
    await evaluate('document.getElementById("book-tab").focus()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    check(`${layout}: outline tabs work with the keyboard`,await evaluate('document.activeElement.id==="outline-tab" && document.getElementById("outline-tab").getAttribute("aria-selected")==="true"'));
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate('document.querySelectorAll("#outline-panel a")[1].click()');
    check(`${layout}: outline navigation reaches the requested heading and closes menu`,await evaluate('!document.getElementById("navigation").open && document.activeElement.tagName==="H2" && document.activeElement.textContent.includes("分层验证模型") && document.activeElement.getBoundingClientRect().top>=120'));
    await evaluate('document.getElementById("focus").click()');
    check(`${layout}: focused reading removes opening and marginal notes`,await evaluate('window.__readingStudy.focused && getComputedStyle(document.getElementById("opening")).display==="none" && Array.from(document.querySelectorAll(".section-note"),e=>getComputedStyle(e).display).every(e=>e==="none")'));
    await evaluate('document.getElementById("focus").click()');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true}); await pause(150);
    check(`${layout}: 390px article has no page overflow and table scrolls locally`,await evaluate('innerWidth===390 && document.documentElement.scrollWidth<=390 && Array.from(document.querySelectorAll(".table-scroll")).every(e=>e.clientWidth<=346 && e.scrollWidth>=e.clientWidth)'));
    await evaluate('document.getElementById("open-outline").click()');
    check(`${layout}: mobile outline fits and contains all sections`,await evaluate(layout==='journal'?'!document.getElementById("edge-panel").hidden && document.getElementById("edge-panel").getBoundingClientRect().width<=366 && document.querySelectorAll("#edge-panel nav a").length===9':'document.getElementById("navigation").open && document.getElementById("navigation").getBoundingClientRect().width<=390 && !document.getElementById("outline-panel").hidden'));
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    check(`${layout}: Escape closes mobile navigation`,await evaluate('!document.getElementById("navigation").open && (!document.getElementById("edge-panel") || document.getElementById("edge-panel").hidden)'));
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:970,deviceScaleFactor:1,mobile:false});
  }
  await evaluate('document.getElementById("next-chapter").click()');
  await until('window.__readingStudy?.ready && window.__readingStudy.chapter==="ch4"');
  check('next chapter opens the complete implementation article without reusing verification artwork',await evaluate(`(async()=>{const source=new DOMParser().parseFromString(await(await fetch('/chapters/ch4')).text(),'text/html').querySelector('.sl-markdown-content');source.querySelectorAll('script').forEach(e=>e.remove());const actual=Array.from(document.querySelectorAll('.section-content'),e=>{const c=e.cloneNode(true);c.querySelectorAll('.copy-source,.table-hint').forEach(e=>e.remove());return c.textContent}).join('');return document.getElementById('chapter-title').textContent==='实现' && document.getElementById('chapter-art').hidden && actual.replace(/\s/g,'')===source.textContent.replace(/\s/g,'')})()`));
  await send('Page.navigate',{url:'http://127.0.0.1:4395/reading-review.html'});
  await until('document.querySelectorAll(".comparison iframe").length===4 && Array.from(document.querySelectorAll(".comparison iframe"),e=>e.contentWindow.__readingStudy?.ready).every(Boolean)');
  await pause(200);
  const review=await evaluate('({scroll:scrollY,title:document.querySelector("h1").getBoundingClientRect().top,width:innerWidth,page:document.documentElement.scrollWidth,frames:Array.from(document.querySelectorAll(".comparison iframe"),e=>({width:e.clientWidth,scroll:e.contentWindow.scrollY,ready:e.contentWindow.__readingStudy.ready}))})');
  report.metrics.review=review;
  check('comparison page stays at its opening while embedded body samples scroll independently',review.scroll===0 && review.title>=0 && review.frames.slice(2).every(e=>e.scroll>400),review);
  await evaluate('document.querySelectorAll(".area-choices button")[3].click()');
  check('spatial proposal pairs a distinct area with human and Agent responsibilities',await evaluate('document.getElementById("area-title").textContent.includes("验证") && document.getElementById("area-agent").textContent.includes("harness") && document.querySelectorAll(".area-choices button[aria-pressed=true]").length===1'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true}); await pause(150);
  check('390px review page keeps the spatial diagram in a local scroll region',await evaluate('document.documentElement.scrollWidth<=390 && document.querySelector(".map-scroll").scrollWidth>=700 && document.querySelectorAll(".area-choices button").length===6'));
  check('no browser runtime errors',report.consoleErrors.length===0,report.consoleErrors);

}
