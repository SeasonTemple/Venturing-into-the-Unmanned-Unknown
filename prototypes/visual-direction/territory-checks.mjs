export async function run({send,evaluate,until,pause,check,report}){
  await send('Page.navigate',{url:'http://127.0.0.1:4395/territory.html'});await until('!!window.__visualStudy');await evaluate('window.__visualStudy.ready');
  report.metrics.home=await evaluate('window.__visualStudy.state()');
  check('continuous world initializes without errors',report.metrics.home.errors.length===0,report.metrics.home.errors);
  if(!report.metrics.home.world)throw Error('Territory failed to initialize');
  check('homepage renders one perspective world',report.metrics.home.world.art==='continuous-territory'&&report.metrics.home.world.canvasCount===1&&report.metrics.home.world.calls>0);
  check('homepage retains the complete reading and installation paths',await evaluate('document.querySelectorAll(".chapter-row").length===10 && document.getElementById("install-command").textContent.includes("git clone") && document.getElementById("space-ui").hidden'));
  await pause(180);const idle=await evaluate('window.__visualStudy.state().world.frames');await pause(220);
  check('static homepage has no idle render loop',await evaluate(`window.__visualStudy.state().world.frames===${idle}&&!window.__visualStudy.state().world.loopScheduled`));
  await evaluate('window.__territoryCanvas=document.querySelector("canvas");window.__visualStudy.enter()');
  const entry=await evaluate('window.__visualStudy.state().world');report.metrics.entry=entry;
  check('entry reaches the forecourt in the original canvas',await evaluate('window.__visualStudy.state().world.arrived===0&&!window.__visualStudy.state().world.moving&&document.querySelector("canvas")===window.__territoryCanvas&&!document.getElementById("space-ui").hidden'));
  await evaluate('window.__journey=window.__visualStudy.go(1);void 0');
  check('travel exposes its pending state and waits before reading',await evaluate('window.__visualStudy.state().world.moving&&window.__visualStudy.state().world.arrived===0&&document.getElementById("station-read").disabled'));
  await pause(250);report.metrics.travelMidpoint=await evaluate('window.__visualStudy.state().world.eye');
  await evaluate('window.__journey');
  report.metrics.bridge=await evaluate('window.__visualStudy.state().world');
  check('a new area has a genuinely different camera location',Math.hypot(...entry.eye.map((v,i)=>v-report.metrics.bridge.eye[i]))>25&&report.metrics.bridge.arrived===1);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  report.metrics.locations=[];
  for(let i=0;i<6;i++){
    await evaluate(`window.__visualStudy.go(${i})`);const state=await evaluate('window.__visualStudy.state()');report.metrics.locations.push(state.world);
    check(`region ${i+1} reaches its own observation point and chapter`,state.world.arrived===i&&!state.world.moving&&!state.world.loopScheduled&&state.currentChapter===['ch1','ch2','ch4','ch3','ch6','ch7'][i]);
  }
  check('the world extends well beyond the first view',report.metrics.locations[5].eye[2]<entry.eye[2]-150&&new Set(report.metrics.locations.map(s=>JSON.stringify(s.eye))).size===6);
  const sightlines=report.metrics.locations.map(s=>s.visibility.filter(a=>a.inFrame&&!a.occluded).map(a=>a.index));
  check('observation points have different central sightlines',new Set(sightlines.map(s=>JSON.stringify(s))).size>=4&&sightlines.every(s=>s.length<6),sightlines);
  await evaluate('window.__visualStudy.go(3)');const atVerification=await evaluate('window.__visualStudy.state().world.eye');
  await evaluate('document.getElementById("station-read").focus();document.getElementById("station-read").click()');await until('window.__visualStudy.state().view==="reading"&&document.getElementById("chapter-content").getAttribute("aria-busy")==="false"');
  check('region opens the complete verification chapter',await evaluate('window.__visualStudy.state().currentChapter==="ch3"&&document.getElementById("chapter-content").textContent.length>3000'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('window.__visualStudy.state().view==="space"&&!window.__visualStudy.state().busy');
  check('reading returns to the same region and focus',await evaluate(`JSON.stringify(window.__visualStudy.state().world.eye)===${JSON.stringify(JSON.stringify(atVerification))}&&document.activeElement.id==="station-read"`));
  report.metrics.layouts=[];
  for(const[width,height]of[[390,844],[320,740],[768,1024],[1440,960],[2560,1440]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:width<760});await pause(120);await evaluate('window.__visualStudy.home()');
    const home=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector(".hero-caption h1").scrollWidth,titleAvailable:document.querySelector(".hero-caption h1").clientWidth})');
    check(`${width}px homepage fits`,home.scroll<=width&&home.title<=home.titleAvailable,home);
    await evaluate('window.__visualStudy.enter()');
    const layout=await evaluate('({width:innerWidth,labels:Array.from(document.querySelectorAll(".station-label"),e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}),dock:document.querySelector(".space-dock").getBoundingClientRect().top,route:document.querySelector(".journey-route").getBoundingClientRect().bottom,buttons:Array.from(document.querySelectorAll(".journey-travel button"),e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})})');
    check(`${width}px area navigation remains usable`,layout.labels.every((a,i)=>a.x>=0&&a.x+a.w<=width&&layout.labels.slice(i+1).every(b=>a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y))&&layout.buttons.every(a=>a.y>layout.route&&a.y+a.h<layout.dock),layout);
    report.metrics.layouts.push({home,space:layout});
  }
  check('no runtime or shader errors',report.consoleErrors.length===0&&(await evaluate('window.__visualStudy.state().errors.length===0')),report.consoleErrors);
  report.metrics.lifecycle=await evaluate(`(async()=>{const{createWorld}=await import('/territory-world.mjs');const host=document.createElement('div');host.style.cssText='position:fixed;top:0;left:-2000px;width:960px;height:640px';document.body.append(host);const results=[];try{for(let i=0;i<3;i++){const w=createWorld(host,{still:true});await w.show('space',false);await w.select(3);const before=w.stats();w.destroy();const frames=w.stats().frames;await new Promise(r=>setTimeout(r,50));results.push({geometries:before.geometries,textures:before.textures,remaining:host.querySelectorAll('canvas').length,loop:w.stats().loopScheduled,framesAfterDestroy:w.stats().frames-frames});}}finally{host.remove();}return results;})()`);
  check('repeated mounts dispose canvases and keep resource counts stable',report.metrics.lifecycle.every(s=>s.remaining===0&&!s.loop&&s.framesAfterDestroy===0&&s.geometries===report.metrics.lifecycle[0].geometries&&s.textures===report.metrics.lifecycle[0].textures),report.metrics.lifecycle);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/territory-review.html'});await until('!!document.querySelector("#territory-map a")');
  check('site plan links six actual places',await evaluate('document.querySelectorAll("#territory-map a").length===6&&Array.from(document.querySelectorAll("#territory-map a")).every(a=>a.getAttribute("href").includes("region="))'));
  await until('Array.from(document.querySelectorAll(".frames iframe")).every(e=>e.contentWindow.__visualStudy?.state().world)');
  check('comparison renders the former section and continuous world',await evaluate('document.querySelectorAll(".frames iframe")[0].contentWindow.__visualStudy.state().world.art==="engineering-section"&&document.querySelectorAll(".frames iframe")[1].contentWindow.__visualStudy.state().world.art==="continuous-territory"'));
  check('review fits a phone viewport',await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)};`});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/territory.html?fallback=1'});await until('!!window.__visualStudy');await evaluate('window.__visualStudy.ready');
  check('WebGL failure preserves the world diagram and open reading',await evaluate('!window.__visualStudy.state().world&&getComputedStyle(document.querySelector(".scene-fallback")).display!=="none"&&document.querySelectorAll(".chapter-row").length===10&&document.getElementById("enter").disabled'));
  await evaluate('window.__visualStudy.read("ch3")');await evaluate('window.__visualStudy.back()');
  check('fallback reading returns to a usable homepage',await evaluate('window.__visualStudy.state().view==="home"&&!document.getElementById("hero-caption").hidden&&document.getElementById("enter").disabled'));
}
