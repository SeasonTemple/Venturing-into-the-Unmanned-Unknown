export async function run({send,evaluate,until,pause,check,report}){
  const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown';
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const chapters=['ch0','ch1','ch2','ch3','ch4','ch5','ch6','ch7','ch8','chA'];
  report.metrics.chapters=[];
  for(const slug of chapters){
    await send('Page.navigate',{url:`${base}/${slug}/`});await until('window.__readingStudy?.ready');
    const result=await evaluate(`(async()=>{const original=new DOMParser().parseFromString(await(await fetch(location.href)).text(),'text/html').querySelector('#body');const actual=document.querySelector('#body').cloneNode(true);actual.querySelectorAll('.journal-extra,.section-note,.section-marker').forEach(n=>n.remove());const normalize=s=>s.replace(/\s+/g,'');return{slug:${JSON.stringify(slug)},same:normalize(original.textContent)===normalize(actual.textContent),h1:document.querySelectorAll('h1').length,sections:window.__readingStudy.sections,errors:window.__readingStudy.errors,title:document.querySelector('#_top').textContent,headings:document.querySelectorAll('#body h2').length,copy:!!document.querySelector('#mt-raw-md'),links:Array.from(document.querySelectorAll('#book-panel a')).every(a=>a.href.includes('/Venturing-into-the-Unmanned-Unknown/ch'))};})()`);
    check(`${slug} retains SSR original, single title, canonical chapters and copy source`,result.same&&result.h1===1&&result.sections===result.headings&&result.errors.length===0&&result.copy&&result.links,result);report.metrics.chapters.push(result);
  }
  await send('Page.navigate',{url:`${base}/ch3/`});await until('window.__readingStudy?.ready');await until('window.__readingStudy.artwork.status!=="loading"');
  check('accepted relief renders with complete readable fallback',await evaluate('window.__readingStudy.artwork.status==="ready"&&!!document.querySelector("#chapter-art svg")'),await evaluate('window.__readingStudy.artwork'));
  check('verification plate follows its subject after the chapter expansion',await evaluate('document.querySelector(".field-plate").closest(".article-section").querySelector("h2").textContent.includes("分层验证模型")'));
  const texts=await evaluate('Array.from(document.querySelectorAll(".field-plate button"),b=>b.textContent)');
  await evaluate('document.querySelectorAll(".field-plate button")[4].click()');
  check('layer plate changes the selected evidence layer',await evaluate('document.querySelectorAll(".field-plate button")[4].getAttribute("aria-selected")==="true"||document.querySelectorAll(".field-plate button")[4].getAttribute("aria-pressed")==="true"'),texts);
  await evaluate('document.getElementById("open-navigation").click()');
  check('chapter dialog opens with ten working canonical chapter links',await evaluate('document.getElementById("navigation").open&&document.querySelectorAll("#book-panel a").length===10'));
  await evaluate('document.getElementById("outline-tab").click()');
  check('outline tab exposes current real headings',await evaluate('!document.getElementById("outline-panel").hidden&&document.querySelectorAll("#outline-panel a").length===document.querySelectorAll("#body h2").length'));
  await evaluate('document.getElementById("close-navigation").click();document.getElementById("body").scrollIntoView({behavior:"instant"})');await until('window.__readingStudy.effects.surface');
  check('reading background uses the covered lower map',await evaluate('window.__readingStudy.effects.surface==="layered-transmission"'),await evaluate('window.__readingStudy.effects'));
  const count=await evaluate('window.__readingStudy.effects.frames');await pause(350);
  check('reduced motion leaves background still',await evaluate(`window.__readingStudy.effects.frames===${count}`));
  await evaluate('window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"});document.getElementById("edge-top").click()');await pause(100);
  check('up button returns to body rather than chapter masthead',await evaluate('scrollY>100&&Math.abs(document.getElementById("body").getBoundingClientRect().top-document.querySelector(".reader-chrome").offsetHeight)<100'));
  await evaluate('document.getElementById("focus").click()');
  check('focused reading hides the masthead and reading aids',await evaluate('document.body.classList.contains("focused")&&getComputedStyle(document.getElementById("opening")).display==="none"'));
  await evaluate('document.getElementById("focus").click()');
  // Real clipboard permission and content, rather than just a changed label.
  await send('Browser.grantPermissions',{origin:'http://127.0.0.1:4395',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await send('Page.bringToFront');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate('document.querySelector("[data-mt-copy]").click()');await pause(120);
  const copied=await evaluate('(async()=>({actual:await navigator.clipboard.readText(),expected:JSON.parse(document.getElementById("mt-raw-md").textContent),label:document.querySelector("[data-mt-copy]").textContent,state:document.querySelector("[data-mt-copy]").dataset.state,focused:document.hasFocus()}))()');
  check('Markdown copy preserves original source after OS newline normalization',copied.actual.replace(/\r\n/g,'\n')===copied.expected.replace(/\r\n/g,'\n'),{actualLength:copied.actual.length,expectedLength:copied.expected.length,label:copied.label,state:copied.state,focused:copied.focused});
  await until('!document.querySelector("site-search button[data-open-modal]").disabled');
  await evaluate('document.querySelector("site-search button[data-open-modal]").click()');await until('!!document.querySelector(".pagefind-ui__search-input")');
  await evaluate('const input=document.querySelector(".pagefind-ui__search-input");input.value="形式化验证";input.dispatchEvent(new Event("input",{bubbles:true}));');
  await until('document.querySelectorAll(".pagefind-ui__result").length>0');
  check('Pagefind still returns real search results',await evaluate('document.querySelectorAll(".pagefind-ui__result").length>0'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await evaluate('document.documentElement.dataset.theme="dark";document.getElementById("body").scrollIntoView({behavior:"instant"})');
  check('dark reading keeps legible surfaces and visible original code controls',await evaluate('getComputedStyle(document.body).getPropertyValue("--rd-ink").trim()==="#e5e8dc"&&getComputedStyle(document.body).getPropertyValue("--rd-paper").trim()==="#17262c"&&Array.from(document.querySelectorAll(".expressive-code .copy")).every(n=>getComputedStyle(n).display!=="none")'));
  await evaluate('document.documentElement.dataset.theme="light"');
  report.metrics.layouts=[];
  for(const width of [320,390,768,1440,2560]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:width<760?844:960,deviceScaleFactor:1,mobile:width<760});await pause(120);
    await evaluate('scrollTo({top:0,behavior:"instant"})');await pause(80);
    const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,hero:document.getElementById("opening").getBoundingClientRect().height,title:document.getElementById("_top").getBoundingClientRect().toJSON(),header:document.querySelector(".reader-chrome").getBoundingClientRect().height})');
    check(`${width}px reading viewport fits without clipping title`,layout.scroll<=width&&layout.title.x>=0&&layout.title.right<=width,layout);report.metrics.layouts.push(layout);
    check(`${width}px reading tools keep horizontal labels and usable targets`,await evaluate('Array.from(document.querySelectorAll(".reader-chrome nav>button")).every(b=>{const r=b.getBoundingClientRect();return r.height>=44&&r.width>=30&&getComputedStyle(b).whiteSpace==="nowrap"})'));
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await evaluate('document.getElementById("body").scrollIntoView({behavior:"instant"})');await pause(120);
  const active=await evaluate('window.__readingStudy.effects.frames');await pause(350);
  check('background visibly advances only when motion is enabled',await evaluate(`window.__readingStudy.effects.frames>${active}`));
  await evaluate('document.getElementById("motion-toggle").click()');await pause(100);const stopped=await evaluate('window.__readingStudy.effects.frames');await pause(200);
  check('shared motion control stops the background',await evaluate(`window.__readingStudy.effects.frames===${stopped}`));
  await evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:false}))');
  check('page exit disposes the two visual surfaces',await evaluate('window.__readingStudy.disposed&&window.__readingStudy.effects.disposed&&window.__readingStudy.artwork.disposed&&!document.querySelector(".ink-atmosphere")&&!document.querySelector(".relief-canvas")'));
  const home=await evaluate(`(async()=>{const text=await(await fetch(${JSON.stringify(base+'/')})).text();return !text.includes('id="production-journal"')&&!text.includes('/journal/production.css')&&text.includes('id="meadow-home-layout"')&&text.includes('hero-v04.webp')})()`);
  check('production homepage uses the accepted meadow independently of reading layout',home);
  await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url:`${base}/ch3/`});await pause(400);
  check('without JavaScript the full chapter and book navigation remain',await evaluate('document.querySelectorAll("#body h2").length===10&&document.getElementById("body").textContent.length>4000&&!!document.querySelector("#journal-book a")'));
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return /webgl/i.test(t)?null:original.call(this,t,...args)};'});
  await send('Page.navigate',{url:`${base}/ch1/`});await until('window.__readingStudy?.ready');await until('window.__readingStudy.artwork.status!=="loading"');
  check('WebGL failure keeps original prose, navigation and SVG',await evaluate('window.__readingStudy.artwork.status==="fallback"&&document.getElementById("body").textContent.length>1000&&getComputedStyle(document.querySelector("#chapter-art svg")).visibility!=="hidden"'));
  check('no runtime or shader errors',report.consoleErrors.filter(e=>!e.includes('Error creating WebGL context')).length===0,report.consoleErrors);
}
