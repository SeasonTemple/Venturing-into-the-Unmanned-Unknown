export async function run({send,evaluate,until,pause,check,report}){
 await send('Page.navigate',{url:'http://127.0.0.1:4395/rift.html'});await until('window.__riftStudy?.ready');
 const initial=await evaluate('window.__riftStudy.state()');report.metrics.home=initial;
 check('scene opens without runtime or shader errors',initial.errors.length===0&&report.consoleErrors.length===0,initial.errors);
 check('one canvas renders the rock and infrastructure',initial.world.canvasCount===1&&initial.world.calls>0&&initial.world.triangles>20000,initial.world);
 const idle=await evaluate('window.__riftStudy.state().world.frames');await pause(250);
 check('settled homepage has no idle loop',await evaluate(`window.__riftStudy.state().world.frames===${idle}&&!window.__riftStudy.state().world.loopScheduled`));
 await evaluate('window.__originalRiftCanvas=document.querySelector("canvas");window.__riftStudy.select(1,false)');const start=await evaluate('window.__riftStudy.state().world');
 await evaluate('window.__journey=window.__riftStudy.select(2);void 0');await pause(1000);const mid=await evaluate('window.__riftStudy.state().world');report.metrics.mid=mid;
 check('walking moves the visible person instead of teleporting to the destination',mid.moving&&mid.actor.walk>0&&Math.hypot(...mid.actor.human.map((n,i)=>n-start.actor.human[i]))>.2&&mid.actor.human[2]>-33,mid.actor);
 check('camera follows the journey in the original canvas',await evaluate('document.querySelector("canvas")===window.__originalRiftCanvas')&&Math.hypot(...mid.eye.map((n,i)=>n-start.eye[i]))>.5);
 await evaluate('window.__riftStudy.pause()');const paused=await evaluate('window.__riftStudy.state().world');await pause(250);const held=await evaluate('window.__riftStudy.state().world');
 check('stop mid-journey freezes both character and camera',held.paused&&held.frames===paused.frames&&JSON.stringify(held.eye)===JSON.stringify(paused.eye)&&JSON.stringify(held.actor.human)===JSON.stringify(paused.actor.human));
 await evaluate('window.__riftStudy.pause();window.__journey');
 check('resuming reaches the passage and stops the loop',await evaluate('!window.__riftStudy.state().world.moving&&!window.__riftStudy.state().world.loopScheduled&&window.__riftStudy.state().world.actor.human[2]===-33'));
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 report.metrics.shots=[];
 for(let i=0;i<6;i++){await evaluate(`window.__riftStudy.select(${i})`);const s=await evaluate('window.__riftStudy.state().world');report.metrics.shots.push(s);check(`shot ${i+1} has a settled scene and real chapter link`,!s.moving&&!s.loopScheduled&&await evaluate('document.getElementById("read-chapter").href.includes("/Venturing-into-the-Unmanned-Unknown/ch")'));}
 check('six views occupy different camera positions',new Set(report.metrics.shots.map(s=>JSON.stringify(s.eye))).size===6);
 await evaluate('window.__riftStudy.select(3);window.__riftStudy.mode("agent")');
 check('Agent mode uses three non-human task units at the worksite',await evaluate('window.__riftStudy.state().world.actor.agentUnits===3&&!document.getElementById("mode-controls").hidden'));
 await evaluate('window.__riftStudy.mode("human")');
 check('human-led mode retains the person and removes task proxies',await evaluate('window.__riftStudy.state().world.actor.agentUnits===0&&document.getElementById("mode-description").textContent.includes("直接实施")'));
 await evaluate('window.__riftStudy.mode("agent");window.__riftStudy.select(4)');
 check('edge leaves only the human and offers a return view',await evaluate('window.__riftStudy.state().world.actor.agentUnits===0&&document.getElementById("walk-next").textContent.includes("回望")&&document.getElementById("playback-status").textContent.includes("通路边缘")'));
 check('edge looks down the unresolved canyon instead of at the opposite wall',await evaluate('window.__riftStudy.state().world.aim[2]<-220'));
 report.metrics.layouts=[];
 for(const width of [320,390,768,1440,2560]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width<760?844:960,deviceScaleFactor:1,mobile:width<760});await pause(100);
  for(const index of [0,3,4]){
   await evaluate(`window.__riftStudy.select(${index},false)`);const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:Array.from(document.querySelectorAll("#shots button"),b=>{const r=b.getBoundingClientRect();return{x:r.x,right:r.right,h:r.height}}),title:(document.getElementById("hero-copy").hidden?document.getElementById("shot-title"):document.querySelector("h1")).getBoundingClientRect().toJSON()})');
   check(`${width}px shot ${index+1} keeps layout and navigation in bounds`,layout.scroll<=width&&layout.title.x>=0&&layout.title.right<=width&&layout.buttons.every(b=>b.x>=0&&b.right<=width&&b.h>=40),layout);report.metrics.layouts.push(layout);
  }
 }
 check('no errors during all scene switches and viewports',await evaluate('window.__riftStudy.state().errors.length===0')&&report.consoleErrors.length===0,report.consoleErrors);
 report.metrics.lifecycle=await evaluate(`(async()=>{const{createRift}=await import('/rift-scene.mjs');const host=document.createElement('div');host.style.cssText='position:fixed;left:-2000px;top:0;width:960px;height:640px';document.body.append(host);const results=[];for(let i=0;i<3;i++){const w=createRift(host,{still:true});await w.select(3,false);const before=w.stats();w.destroy();const frames=w.stats().frames;await new Promise(r=>setTimeout(r,40));results.push({geometries:before.geometries,textures:before.textures,remaining:host.querySelectorAll('canvas').length,loop:w.stats().loopScheduled,framesAfterDestroy:w.stats().frames-frames});}host.remove();return results;})()`);
 check('three mounts release canvases and keep resource counts stable',report.metrics.lifecycle.every(s=>s.remaining===0&&!s.loop&&s.framesAfterDestroy===0&&s.geometries===report.metrics.lifecycle[0].geometries&&s.textures===report.metrics.lifecycle[0].textures),report.metrics.lifecycle);
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return /webgl/i.test(t)?null:original.call(this,t,...args)};'});
 await send('Page.navigate',{url:'http://127.0.0.1:4395/rift.html'});await until('!!window.__riftStudy');
 check('WebGL failure leaves the design notes and direct reading available',await evaluate('!window.__riftStudy.ready&&document.getElementById("enter").disabled&&document.getElementById("rift-status").textContent.includes("直接打开章节")&&!!document.querySelector(".masthead a[href*=ch0]")'));
}
