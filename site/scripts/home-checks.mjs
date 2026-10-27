export async function run(context){
  const {send,evaluate,until,pause,check,report}=context;
  const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown',url=base+'/';
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});await until('!!window.__meadowWalk&&!!window.__meadowMotion');
  check('production home has one painting, one title and a single navigation',await evaluate('document.querySelectorAll(".landscape").length===1&&document.querySelectorAll("h1").length===1&&!document.querySelector(".page>.header")&&document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("site-search").length===1'));
  check('chapters, installation, releases and agent files remain directly accessible',await evaluate('document.querySelectorAll("#chapters .mt-cell").length===10&&!!document.querySelector("[data-mt-cmd-copy]")&&[...document.querySelectorAll(".mt-rows a")].some(a=>a.href.endsWith("llms.txt"))&&!!document.querySelector(".read-link[href*=ch0]")'));
  check('homepage does not load the old three.js hero',await evaluate('!performance.getEntriesByType("resource").some(e=>/three\.|HeroScene|hero-gate/.test(e.name))'));
  const before=await evaluate('window.__meadowMotion.stats()');await pause(1000);const after=await evaluate('window.__meadowMotion.stats()');
  check('environment runs within its frame and texture budget',after.frames>before.frames&&after.frames-before.frames<=25&&after.textureCount===2&&after.buffer[0]<=1440,{frames:after.frames-before.frames,buffer:after.buffer});
  report.metrics.layouts=[];
  for(const width of [320,390,768,1440,2560]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<700});await pause(120);
    const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('#book-title').getBoundingClientRect().toJSON(),art:document.querySelector('.art-surface').getBoundingClientRect().toJSON(),overflow:[...document.querySelectorAll('.meadow-home *')].filter(e=>!e.closest('.mt-path-list,dialog')&&e.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,12).map(e=>({tag:e.tagName,classes:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})),links:[...document.querySelectorAll('.masthead a,.masthead button,.entry-links a,.entry-links button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right}})})`);
    report.metrics.layouts.push(layout);check(`${width}px production title, artwork and controls fit`,layout.scroll<=width&&layout.title.left>=0&&layout.title.right<=width&&layout.links.every(r=>r.left>=0&&r.right<=width),layout);
  }
  if(process.argv.includes('--layout-only'))return;
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await evaluate('window.__meadowWalk.open()');await evaluate('window.__meadowWalk.action()');
  await until('!document.querySelector("site-search button[data-open-modal]").disabled');await evaluate('document.querySelector("site-search button[data-open-modal]").click()');await until('!!document.querySelector(".pagefind-ui__search-input")');await pause(80);
  const hidden=await evaluate('window.__meadowWalk.stats()');await pause(180);
  check('search suspends the route and background without resetting position',await evaluate(`!window.__meadowWalk.stats().loopScheduled&&window.__meadowWalk.stats().distance===${hidden.distance}&&!window.__meadowMotion.stats().running`));
  await evaluate('const searchInput=document.querySelector(".pagefind-ui__search-input");searchInput.value="形式化验证";searchInput.dispatchEvent(new Event("input",{bubbles:true}));');await until('document.querySelectorAll(".pagefind-ui__result").length>0');
  check('homepage search returns actual indexed chapters',await evaluate('document.querySelectorAll(".pagefind-ui__result").length>0&&[...document.querySelectorAll(".pagefind-ui__result-link")].every(a=>a.href.includes("/Venturing-into-the-Unmanned-Unknown/"))'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(100);
  check('escape closes search and resumes exploration rather than leaving it',await evaluate('!document.querySelector("site-search dialog").open&&window.__meadowWalk.stats().active&&window.__meadowWalk.stats().loopScheduled'));
  await evaluate('window.__meadowWalk.close()');
  const data=await(await fetch(base+'/meadow/engineer-actions-v03.json')).json();
  check('published gait pairs opposite hands and feet and articulates torso and head',data.joints.every(j=>j.leftFootOffset*j.leftHandOffset<=0&&j.rightFootOffset*j.rightHandOffset<=0)&&Math.max(...data.joints.map(j=>j.torsoAngle))-Math.min(...data.joints.map(j=>j.torsoAngle))>.06&&data.joints.some(j=>Math.abs(j.headAngle)>.02));
  await (await import('../../prototypes/visual-direction/meadow-walk-checks.mjs')).run({...context,url,scrollSelector:'#chapters',mediaBase:base+'/meadow/'});
  await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url});await pause(200);
  check('without JavaScript the full painting, reading and ten chapters remain',await evaluate('document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("#chapters .mt-cell").length===10&&document.querySelector("#enter-field").hidden&&!!document.querySelector(".read-link[href*=ch0]")'));
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==="webgl"?null:original.call(this,t,...args)};'});
  await send('Page.navigate',{url});await until('!!window.__meadowWalk');await evaluate('window.__meadowWalk.open()');
  check('without WebGL the clean plate and 2D exploration still work',await evaluate('document.querySelector(".landscape").dataset.motion==="fallback"&&window.__meadowWalk.stats().active&&document.querySelector(".landscape-art").src.includes("walk-plate")'));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  check('no production homepage runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
