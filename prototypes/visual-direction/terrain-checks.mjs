export async function run({send,evaluate,until,pause,check,report}) {
  const navigate=async chapter=>{await send('Page.navigate',{url:`http://127.0.0.1:4395/reading.html?chapter=${chapter}`});await until(`window.__readingStudy?.ready && window.__readingStudy.chapter==='${chapter}'`);};
  report.metrics.routes=[];
  for(const chapter of ['ch0','ch3'])for(const [width,height] of [[1251,1262],[1440,900],[1600,720],[2560,1440],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});await navigate(chapter);await pause(100);
    const data=await evaluate(`(()=>{const r=document.querySelector('.field-route'),b=r.getBoundingClientRect();return {chapter:window.__readingStudy.chapter,width:innerWidth,height:innerHeight,page:document.documentElement.scrollWidth,railWidth:r.clientWidth,railScrollWidth:r.scrollWidth,railHeight:r.clientHeight,railScrollHeight:r.scrollHeight,overflowX:getComputedStyle(r).overflowX,overflowY:getComputedStyle(r).overflowY,position:getComputedStyle(r).position,links:[...r.querySelectorAll('[data-route]')].map(a=>{const q=a.getBoundingClientRect();return {x:q.left-b.left,right:q.right-b.left,text:a.textContent}})}})()`);
    report.metrics.routes.push(data);
    check(`${chapter} ${width}×${height}: route has no internal scrollbar or clipped links`,data.railScrollWidth<=data.railWidth+1 && data.railScrollHeight<=data.railHeight+1 && data.page<=width && data.links.every(l=>l.x>=-1&&l.right<=data.railWidth+1) && !['auto','scroll'].includes(data.overflowX) && !['auto','scroll'].includes(data.overflowY),data);
    if(width>=1200&&data.railHeight>height-130)check(`${chapter}: short viewport uses document flow`,data.position==='static');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate('ch3');
  await until('window.__readingStudy.artwork?.status !== "loading"');
  check('chapter artwork creates one real Three.js terrain',await evaluate('window.__readingStudy.artwork.status==="ready" && document.querySelectorAll("#chapter-art canvas").length===1'));
  await until('window.__readingStudy.artwork.controller.stats.frames>0');
  await (await import('./header-checks.mjs')).run({send,evaluate,until,pause,check,report});
  report.metrics.terrain=await evaluate('window.__readingStudy.artwork.controller.stats');
  check('terrain stays within geometry, point and draw budgets',report.metrics.terrain.calls<=40&&report.metrics.terrain.triangles<50000&&report.metrics.terrain.points>100&&report.metrics.terrain.pixelRatio<=2,report.metrics.terrain);
  const idle=await evaluate('window.__readingStudy.artwork.controller.stats.frames');await pause(250);
  check('visible terrain continuously waves at a bounded frame rate',await evaluate(`window.__readingStudy.artwork.controller.stats.frames>${idle} && window.__readingStudy.artwork.controller.stats.frames-${idle}<=9 && window.__readingStudy.artwork.controller.stats.time>0`));
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1100,y:320});await pause(600);
  check('pointer parallax preserves the animated terrain',await evaluate(`window.__readingStudy.artwork.controller.stats.frames>${idle}`));
  await (await import('./atmosphere-checks.mjs')).run({send,evaluate,until,pause,check,report});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(150);
  const reduced=await evaluate('window.__readingStudy.artwork.controller.stats.frames');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:850,y:400});await pause(150);
  check('reduced motion leaves terrain still',await evaluate(`window.__readingStudy.artwork.controller.stats.frames===${reduced}`));
  const inkTime=await evaluate('window.__readingStudy.effects.time');await pause(180);
  check('reduced motion also leaves ink diffusion still',await evaluate(`window.__readingStudy.effects.time===${inkTime}`));
  await send('Emulation.setEmulatedMedia',{features:[]});await pause(100);
  await evaluate('document.getElementById("body").scrollIntoView({behavior:"instant"})');await pause(120);
  const off=await evaluate('window.__readingStudy.artwork.controller.stats.frames');await pause(180);
  check('offscreen artwork stops rendering',await evaluate(`!window.__readingStudy.artwork.controller.stats.visible && window.__readingStudy.artwork.controller.stats.frames===${off}`));
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');await pause(120);
  const lifecycle=await evaluate(`(async()=>{const mount=(await import('./journal-terrain.mjs')).createJournalTerrain,figure=document.getElementById('chapter-art'),runs=[];let controller=window.__readingStudy.artwork.controller;for(let i=0;i<3;i++){await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const before={...controller.stats};controller.dispose();runs.push({before,after:{...controller.stats},canvas:figure.querySelectorAll('canvas').length});controller=mount(figure);}window.__readingStudy.artwork.controller=controller;return runs;})()`);
  report.metrics.lifecycle=lifecycle;
  check('three mount/dispose cycles release GPU geometry and restore fallback',lifecycle.every(r=>r.after.disposed&&r.after.geometries===0&&r.after.textures===0&&r.canvas===0)&&new Set(lifecycle.map(r=>r.before.geometries)).size===1,lifecycle);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});await pause(150);
  check('mobile terrain resizes without overflow and caps DPR',await evaluate('document.documentElement.scrollWidth<=390 && document.querySelector(".terrain-view canvas").clientWidth<=390 && window.__readingStudy.artwork.controller.stats.pixelRatio===1.5'));
  const fallbackScript=await send('Page.addScriptToEvaluateOnNewDocument',{source:`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);}`});
  await navigate('ch3');await until('window.__readingStudy.artwork?.status === "fallback"');
  check('unavailable WebGL preserves the SVG and all original sections',await evaluate('document.querySelectorAll("#chapter-art canvas").length===0 && document.querySelector("#chapter-art > svg")!==null && document.querySelectorAll("#body h2").length===9 && window.__readingStudy.errors.length===0'));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fallbackScript.identifier});
  await (await import('./installation-checks.mjs')).run({send,evaluate,until,pause,check,report});
  check('no application runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
