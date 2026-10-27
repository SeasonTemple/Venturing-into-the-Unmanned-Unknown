export async function run({send,evaluate,until,pause,check,report}){
  const url='http://127.0.0.1:4395/meadow-study.html';
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});await until('!!window.__meadowMotion');
  await until('!!window.__meadowWalk');
  check('one environment canvas and one idle actor layer over the raster fallback',await evaluate('document.querySelectorAll(".environment-motion").length===1&&document.querySelectorAll(".field-actor").length===1&&document.querySelector("canvas").classList.contains("ready")&&document.querySelector(".landscape-art").naturalWidth===1920&&!window.__meadowWalk.stats().loaded&&!window.__meadowWalk.stats().loopScheduled'));
  const before=await evaluate('window.__meadowMotion.stats()');await pause(3000);const after=await evaluate('window.__meadowMotion.stats()');
  report.metrics.active=after;report.metrics.observedFps=(after.frames-before.frames)/3;
  check('environment advances within the 24fps budget',after.frames>before.frames&&report.metrics.observedFps<=25,report.metrics.observedFps);
  check('single draw, two textures and capped resolution',after.drawsPerFrame===1&&after.textureCount===2&&after.buffer[0]<=1440,after);
  await evaluate('document.querySelector("#motion-toggle").click()');await pause(70);const paused=await evaluate('window.__meadowMotion.stats()');await pause(250);
  check('pause freezes time and stops redraws',await evaluate(`!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${paused.frames}&&window.__meadowMotion.stats().elapsed===${paused.elapsed}`));
  report.metrics.pixelChanges=await evaluate(`(()=>{
    const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl'),w=canvas.width,h=canvas.height;
    const capture=t=>{window.__meadowMotion.sample(t);const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
    const a=capture(0),c=capture(1.3),b=capture(18),areas={sky:[0,0,1200,500],roof:[1460,370,1900,520],path:[460,850,650,955],feet:[1220,830,1300,863],person:[1210,675,1305,865],grass:[0,860,300,1080],water:[460,1035,780,1080]},counts={};
    for(const[name,box]of Object.entries(areas)){let changed=0,total=0;for(let y=Math.ceil(box[1]*h/1080);y<Math.floor(box[3]*h/1080);y++)for(let x=Math.ceil(box[0]*w/1920);x<Math.floor(box[2]*w/1920);x++){const i=((h-1-y)*w+x)*4;total++;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||(name==='person'&&(a[i]!==c[i]||a[i+1]!==c[i+1]||a[i+2]!==c[i+2])))changed++;}counts[name]={changed,total};}
    return counts;
  })()`);
  const diff=report.metrics.pixelChanges;
  check('clouds, selected grass and water actually change pixels',diff.sky.changed>100&&diff.grass.changed>10&&diff.water.changed>10,diff);
  check('roof, road and whole person remain unchanged across motion phases',diff.roof.changed===0&&diff.path.changed===0&&diff.feet.changed===0&&diff.person.changed===0,diff);
  await evaluate('window.__meadowMotion.pause(false)');await pause(60);const resume=await evaluate('window.__meadowMotion.stats()');
  check('resuming preserves the sampled timeline',resume.elapsed>=18&&resume.elapsed<18.3,resume.elapsed);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(100);const reduced=await evaluate('window.__meadowMotion.stats()');await pause(150);
  check('system reduced motion stops redraws and retains artwork',await evaluate(`!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${reduced.frames}&&document.querySelector('#motion-toggle').disabled&&document.querySelector('.landscape-art').complete`));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  report.metrics.layouts=[];
  for(const width of [320,390,768,1440,2560]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});await pause(120);
    const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll(".masthead a,.masthead button")].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right}}),buffer:window.__meadowMotion.stats().buffer})');report.metrics.layouts.push(layout);
    check(`${width}px layout and navigation fit`,layout.scroll<=width&&layout.controls.every(r=>r.left>=0&&r.right<=width),layout);
  }
  await evaluate('document.body.style.paddingBottom=innerHeight+"px";document.querySelector("#cast").scrollIntoView({behavior:"instant"})');await pause(200);const off=await evaluate('window.__meadowMotion.stats()');await pause(200);
  check('offscreen canvas stops drawing',await evaluate(`!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${off.frames}`));
  await evaluate('window.scrollTo({top:0,behavior:"instant"});document.body.style.paddingBottom=""');await pause(150);
  check('returning to artwork resumes motion',await evaluate('window.__meadowMotion.stats().running'));
  await evaluate('window.__contextTest=document.querySelector("canvas").getContext("webgl").getExtension("WEBGL_lose_context");window.__contextTest.loseContext()');await pause(150);
  check('context loss reveals the intact raster fallback',await evaluate('document.querySelector(".landscape").dataset.motion==="fallback"&&!document.querySelector("canvas").classList.contains("ready")&&document.querySelector(".landscape-art").naturalWidth===1920'));
  await evaluate('window.__contextTest.restoreContext()');await pause(300);
  await until('document.querySelector("canvas").classList.contains("ready")');
  check('restored context rebuilds the scene',await evaluate('window.__meadowMotion.stats().running'));
  await (await import('./meadow-walk-checks.mjs')).run({send,evaluate,until,pause,check,report});
  check('direct reading target is available',(await fetch('http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/ch0/')).status===200);
  const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:'const originalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==="webgl"?null:originalContext.call(this,type,...args)};'});
  await send('Page.navigate',{url});await until('document.querySelector(".landscape")?.dataset.motion==="fallback"');
  check('WebGL unavailable still loads complete artwork and reading link',await evaluate('document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelector("#motion-toggle").hidden&&!!document.querySelector(".read-link[href]")'));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  check('no application runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
