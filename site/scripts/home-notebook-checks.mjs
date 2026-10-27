export async function run({send,evaluate,until,pause,check,report}){
 const url='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/';
 const viewport=(width,height=960)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=700});
 await viewport(1440);await send('Page.navigate',{url});await until('!!window.__meadowStation&&!!window.__meadowMotion');
 await evaluate('localStorage.removeItem("unmapped-field-notebook-v1")');await send('Page.navigate',{url});await until('!!window.__meadowStation&&!!window.__meadowMotion');
 await evaluate('window.__meadowStation.open()');await pause(1200);
 const context=await evaluate('({url:location.href,scrollY,width:document.documentElement.clientWidth,camera:window.__meadowStation.stats().camera.view})');
 await evaluate('document.getElementById("field-reading").focus();document.getElementById("field-reading").click()');await pause(120);
 check('opening the notebook is a modal action in the same scene',await evaluate(`document.getElementById('field-reading').tagName==='BUTTON'&&document.getElementById('field-notebook').matches(':modal')&&location.href===${JSON.stringify(context.url)}&&window.__meadowStation.stats().active`));
 check('no chapter is silently granted or fetched before a discovery',await evaluate('document.getElementById("notebook-chapter").disabled&&window.__meadowStation.stats().notebook.entries.length===0&&!performance.getEntriesByType("resource").some(e=>e.name.endsWith("/ch3/"))'));
 const frames=await evaluate('window.__meadowMotion.stats().frames');await pause(150);
 check('opening the notebook stops environment and camera motion without changing pause preference',await evaluate(`window.__meadowMotion.stats().frames===${frames}&&!window.__meadowMotion.stats().running&&!window.__meadowMotion.stats().userPaused&&!window.__meadowStation.stats().camera.transitioning`));
 check('modal keeps the page scrollbar width and scroll position',await evaluate(`document.documentElement.clientWidth===${context.width}&&scrollY===${context.scrollY}&&getComputedStyle(document.body).overflowY!=='hidden'`));
 for(let i=0;i<12;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});}
 check('native Tab navigation stays within the open notebook',await evaluate('document.getElementById("field-notebook").contains(document.activeElement)'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(120);
 check('Escape closes the notebook before exiting and restores its invoker',await evaluate('!document.getElementById("field-notebook").open&&window.__meadowStation.stats().active&&document.activeElement.id==="field-reading"&&!document.querySelector(".landscape").hasAttribute("data-notebook-open")'));
 check('closing restores the same scene view',await evaluate(`window.__meadowStation.stats().camera.view===${JSON.stringify(context.camera)}&&location.href===${JSON.stringify(context.url)}`));
 await evaluate('window.__meadowStation.action();document.getElementById("field-reference").click()');
 check('only observed locations are appended to both carriers',await evaluate('window.__meadowStation.stats().notebook.entries.map(e=>e.type).join()==="archive,reference"&&!window.__meadowStation.stats().notebook.unlocked'));
 await evaluate('document.getElementById("field-reread").click();document.getElementById("field-reference").click()');
 check('rereading and reinspecting do not duplicate the same evidence',await evaluate('window.__meadowStation.stats().notebook.entries.length===2'));
 await evaluate('document.getElementById("field-pin").click()');
 check('seeing both points still requires explicitly recording the clue',await evaluate('!window.__meadowStation.stats().notebook.unlocked&&window.__meadowStation.stats().notebook.entries.length===3'));
 await evaluate('window.__meadowStation.action();document.getElementById("field-archive").focus();document.getElementById("field-archive").click()');await pause(120);
 check('device opens source-labelled archive records rather than a reading route',await evaluate('document.getElementById("field-notebook").dataset.carrier==="agent"&&document.querySelectorAll(".notebook-entry-meta").length===8&&document.getElementById("notebook-entries").textContent.includes("OBS-0001")&&!document.getElementById("notebook-chapter").disabled'));
 await evaluate('window.__entriesBefore=JSON.stringify(window.__meadowStation.stats().notebook.entries);document.getElementById("notebook-addition").value="补查定位。<img src=x onerror=alert(1)>";document.getElementById("notebook-append").requestSubmit()');
 check('supplementary archive data appends a new version without rewriting evidence',await evaluate('JSON.stringify(window.__meadowStation.stats().notebook.entries.slice(0,-1))===window.__entriesBefore&&window.__meadowStation.stats().notebook.entries.at(-1).source.includes("设备档案")&&document.getElementById("notebook-entries").textContent.includes("<img")&&!document.querySelector("#notebook-entries img")'));
 await evaluate('document.getElementById("notebook-human").click()');
 check('human notebook retains narrative findings and the newly discovered chapter',await evaluate('document.getElementById("notebook-entries").textContent.includes("檐下，读到")&&document.getElementById("notebook-chapter").textContent.includes("展开章节")'));
 await evaluate('document.getElementById("notebook-chapter").click()');await until('window.__meadowStation.stats().notebook.chapterLoaded');
 const chapter=await evaluate(`(async()=>{const body=document.getElementById('notebook-chapter-body'),source=new DOMParser().parseFromString(await(await fetch(document.getElementById('field-notebook').dataset.chapterUrl)).text(),'text/html').querySelector('.sl-markdown-content');return {visible:!document.getElementById('notebook-chapter-page').hidden,length:body.textContent.length,hasSection:body.textContent.includes('什么是形式化验证'),sameUrl:location.href===${JSON.stringify(context.url)},headingsComplete:body.querySelectorAll('h2').length===source.querySelectorAll('h2').length,codeComplete:body.querySelectorAll('pre').length===source.querySelectorAll('pre').length}})()`);
 check('discovered chapter opens its original content inside the notebook',chapter.visible&&chapter.length>2000&&chapter.hasSection&&chapter.sameUrl&&chapter.headingsComplete&&chapter.codeComplete,chapter);
 check('chapter contains reading content without page controls or hidden anchor labels',await evaluate('!document.querySelector("#notebook-chapter-body script,#notebook-chapter-body iframe,#notebook-chapter-body a[href],#notebook-chapter-body button")&&!document.getElementById("notebook-chapter-body").textContent.includes("Section titled")'));
 await evaluate('document.getElementById("notebook-return").click()');
 check('returning from a chapter keeps the collected records',await evaluate('document.getElementById("notebook-chapter-page").hidden&&window.__meadowStation.stats().notebook.entries.length===5'));
 for(const [width,height]of [[768,600],[2560,1440]]){
  await viewport(width,height);await pause(150);
  check(`${width}px notebook remains inside the viewport`,await evaluate('(()=>{const d=document.getElementById("field-notebook"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()'));
 }
 await viewport(390,844);await pause(200);
 check('mobile transition closes the modal and releases its scene resources',await evaluate('!document.getElementById("field-notebook").open&&!window.__meadowStation&&!document.querySelector(".landscape").hasAttribute("data-notebook-open")&&document.activeElement.classList.contains("read-link")'));
 await viewport(1440);await until('!!window.__meadowStation&&!!window.__meadowMotion');
 check('desktop return preserves notebook history and discovery',await evaluate('window.__meadowStation.stats().notebook.entries.length===5&&window.__meadowStation.stats().notebook.unlocked'));
 await send('Page.navigate',{url});await until('!!window.__meadowStation&&!!window.__meadowMotion');
 check('browser-local discoveries and appended evidence survive refresh',await evaluate('window.__meadowStation.stats().notebook.entries.length===5&&window.__meadowStation.stats().notebook.unlocked&&!window.__meadowStation.stats().active'));
 check('direct reading and all chapters remain openly available',await evaluate('document.querySelector(".read-link").href.endsWith("/ch0/")&&document.querySelectorAll("#chapters .mt-cell").length===10'));
 report.metrics.notebook=await evaluate('window.__meadowStation.stats().notebook');
 check('no runtime errors in notebook flow',report.consoleErrors.length===0,report.consoleErrors);
}
