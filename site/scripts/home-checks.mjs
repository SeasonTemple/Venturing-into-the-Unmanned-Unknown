export async function run({send,evaluate,until,pause,check,report}){
 if(process.argv.includes('--home-surface'))return (await import('./home-surface-checks.mjs')).run({send,evaluate,until,pause,check,report});
 if(process.argv.includes('--home-notebook'))return (await import('./home-notebook-checks.mjs')).run({send,evaluate,until,pause,check,report});
 const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown',url=base+'/';
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await until('!!window.__meadowStation&&!!window.__meadowMotion');
 check('production home has one approved painting, title and navigation',await evaluate('document.querySelectorAll(".landscape").length===1&&document.querySelectorAll("h1").length===1&&!document.querySelector(".page>.header")&&document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("site-search").length===1'));
 check('reading, ten chapters, install, releases and text indexes remain available',await evaluate('document.querySelectorAll("#chapters .mt-cell").length===10&&!!document.querySelector("[data-mt-cmd-copy]")&&[...document.querySelectorAll(".mt-rows a")].some(a=>a.href.endsWith("llms.txt"))&&!!document.querySelector(".read-link[href*=ch0]")'));
 check('unreviewed directional animation and old three.js hero are not loaded',await evaluate('!window.__meadowWalk&&!document.querySelector(".field-actor")&&!performance.getEntriesByType("resource").some(e=>/three\.|HeroScene|hero-gate|engineer-actions|meadow-walk/.test(e.name))'));
 await pause(500);const before=await evaluate('window.__meadowMotion.stats()');await pause(2000);const after=await evaluate('window.__meadowMotion.stats()');
 report.metrics.framePacing={framesInTwoSeconds:after.frames-before.frames,...after};
 check('desktop environment retains one draw and bounded texture sizes at a 30fps budget',after.frames>before.frames&&after.frames-before.frames<=Math.ceil((after.elapsed-before.elapsed)*30)+2&&after.targetFps<=30&&after.textureCount===3&&after.drawsPerFrame===1&&after.buffer[0]<=1152,report.metrics.framePacing);
 check('homepage scrollbar uses the painting palette without a nested scrolling scene',await evaluate('(()=>{const root=document.documentElement,s=getComputedStyle(root),thumb=getComputedStyle(root,"::-webkit-scrollbar-thumb");return s.getPropertyValue("--home-scroll-track").trim()==="#d6e3d5"&&thumb.backgroundColor==="rgb(110, 135, 114)"&&getComputedStyle(document.querySelector(".art-surface")).overflowY!=="scroll"})()'));
 const motionPixels=await evaluate(`(async()=>{
  const canvas=document.querySelector('.environment-motion'),gl=canvas.getContext('webgl'),w=canvas.width,h=canvas.height,mask=new Image();mask.src=new URL('motion-mask-v03.png',new URL(document.querySelector('.landscape').dataset.mediaBase,location.href)).href;await mask.decode();
  const buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;const ctx=buffer.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(mask,0,0,w,h);const zones=ctx.getImageData(0,0,w,h).data;
  const capture=t=>{window.__meadowMotion.sample(t);const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  window.__meadowMotion.pause(true);const frames=[capture(0),capture(2),capture(80),capture(82)],result={};
  for(const [name,a,b]of[['early',frames[0],frames[1]],['late',frames[2],frames[3]]]){
   const counts={cloud:[0,0],water:[0,0],grass:[0,0],light:[0,0],fixed:[0,0]};
   for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const m=(y*w+x)*4,i=((h-1-y)*w+x)*4;const px=x*1920/w,py=y*1080/h,isLight=(px>1210&&px<1365&&py>550&&py<721)||(px>=1709&&px<=1748&&py>=790&&py<=837);let zone=isLight?'light':zones[m]>200?'cloud':zones[m+1]>140?'water':zones[m+2]>80?'grass':zones[m]===0&&zones[m+1]===0&&zones[m+2]===0?'fixed':null;if(!zone)continue;counts[zone][0]++;if(Math.max(...[0,1,2,3].map(k=>Math.abs(a[i+k]-b[i+k])))>3)counts[zone][1]++;}
   result[name]=Object.fromEntries(Object.entries(counts).map(([k,[n,d]])=>[k,{sampled:n,changed:d,share:n?d/n:0}]));
  }
  // Check real pixels, not only the direction label reported by the renderer.
  result.wind=[];
  const dx=12,dt=dx*1920/w/6;
  for(const t of [0,80,190,400,639]){
   const a=capture(t),b=capture(t+dt);let east=0,west=0,still=0,n=0;
   for(let y=30;y<h*.42;y+=7)for(let x=dx+4;x<w-dx-4;x+=7){
    if(zones[(y*w+x)*4]<250||zones[(y*w+x+dx)*4]<250||zones[(y*w+x-dx)*4]<250)continue;
    const i=((h-1-y)*w+x)*4;
    for(let c=0;c<3;c++){east+=Math.abs(a[i+c]-b[i+dx*4+c]);west+=Math.abs(a[i+c]-b[i-dx*4+c]);still+=Math.abs(a[i+c]-b[i+c]);n++;}
   }result.wind.push({t,east:east/n,west:west/n,still:still/n});
  }
  const deviceA=capture(.7),deviceB=capture(2);result.devices={};
  for(const [name,box]of Object.entries({lamp:[1252,590,1335,686],machine:[1709,790,1748,837],vane:[1400,218,1580,318]})){
   let n=0,changed=0;
   for(let y=Math.floor(box[1]*h/1080);y<box[3]*h/1080;y++)for(let x=Math.floor(box[0]*w/1920);x<box[2]*w/1920;x++){
    const i=((h-1-y)*w+x)*4;n++;if(Math.max(...[0,1,2,3].map(c=>Math.abs(deviceA[i+c]-deviceB[i+c])))>3)changed++;
   }result.devices[name]={sampled:n,changed,share:changed/n};
  }
  window.__meadowMotion.pause(false);return result;
 })()`);
 report.metrics.motionPixels=motionPixels;
 check('clouds keep moving after the initial minute and grass and water remain visible',motionPixels.early.cloud.share>.01&&motionPixels.late.cloud.share>.01&&motionPixels.early.grass.share>.01&&motionPixels.early.water.share>.01,motionPixels);
 check('environment motion leaves the painted character and architecture fixed',motionPixels.early.fixed.changed===0&&motionPixels.late.fixed.changed===0,motionPixels);
 check('cloud pixels travel east before and after the loop boundary',motionPixels.wind.every(m=>m.east<m.west*.25&&m.east<m.still*.3),motionPixels.wind);
 check('daylight lamp stays steady across animation phases',motionPixels.devices.lamp.changed===0,motionPixels.devices.lamp);
 for(const name of ['machine','vane'])check(`${name} changes actual pixels across its own animation phases`,motionPixels.devices[name].share>.01,motionPixels.devices[name]);
 if(process.argv.includes('--equipment-only'))return;
 report.metrics.layouts=[];
 for(const width of [320,390,768,1440,2560]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});await pause(120);
  const layout=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,stage:document.querySelector(".landscape").getBoundingClientRect().toJSON(),title:document.querySelector("#book-title").getBoundingClientRect().toJSON(),art:document.querySelector(".art-surface").getBoundingClientRect().toJSON(),enter:getComputedStyle(document.querySelector("#enter-field")).display})');
  report.metrics.layouts.push(layout);check(`${width}px title and artwork fit`,layout.scroll<=width&&layout.title.left>=0&&layout.title.right<=width,layout);
  if(width<700)check(`${width}px painting fills the entire first screen without exploration entry`,Math.abs(layout.stage.height-layout.height)<2&&Math.abs(layout.art.height-layout.height)<2&&layout.enter==='none',layout);
 }
 if(process.argv.includes('--layout-only'))return;
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});await pause(120);
 await evaluate('window.__meadowStation.open();window.__meadowStation.action()');
 await pause(1200);
 check('station camera advances to the worksite without moving a character sprite',await evaluate('window.__meadowStation.stats().camera.view==="archive"&&!window.__meadowStation.stats().camera.transitioning&&!document.querySelector(".field-actor")'));
 await evaluate('document.getElementById("field-pin").focus()');await pause(1200);
 check('focusing a landmark brings it into view without scrolling hidden scene containers',await evaluate('(()=>{const r=document.getElementById("field-pin").getBoundingClientRect(),stage=document.querySelector(".landscape"),art=document.querySelector(".art-surface");return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&stage.scrollLeft===0&&stage.scrollTop===0&&art.scrollLeft===0&&art.scrollTop===0&&scrollY===0})()'));
 check('station record opens without translating or animating the painted character',await evaluate('window.__meadowStation.stats().observed&&!document.getElementById("field-note").hidden&&document.querySelector(".landscape-art").src.includes("hero-v04")&&!document.querySelector(".field-actor")'));
 check('measurement points are accessible ground rings without white text badges',await evaluate('["field-pin","field-reference"].every(id=>{const p=document.getElementById(id);return !p.hidden&&p.tagName==="BUTTON"&&p.getAttribute("aria-label")&&getComputedStyle(p).backgroundColor==="rgba(0, 0, 0, 0)"})'));
 await evaluate('document.getElementById("field-reference").click()');
 check('a reference can be inspected first without inventing the other finding',await evaluate('window.__meadowStation.stats().findings.join() === "reference"&&!window.__meadowStation.stats().clue&&document.getElementById("finding-stake").textContent.includes("尚未")&&document.getElementById("note-title").textContent.includes("风标")'));
 await evaluate('document.getElementById("field-reread").click()');
 check('rereading the archive preserves evidence and does not complete the comparison',await evaluate('window.__meadowStation.stats().view==="archive"&&window.__meadowStation.stats().findings.length===1&&!document.getElementById("note-source").hidden'));
 await evaluate('document.getElementById("field-pin").click()');
 check('two inspections reveal comparison before a clue can be recorded',await evaluate('window.__meadowStation.stats().view==="comparison"&&window.__meadowStation.stats().findings.length===2&&!window.__meadowStation.stats().clue&&document.getElementById("field-action").textContent==="留下待查线索"'));
 await evaluate('document.getElementById("field-action").click()');
 check('recorded clue states uncertainty and discovers verification inside the notebook',await evaluate('window.__meadowStation.stats().clue&&document.getElementById("note-body").textContent.includes("原因尚未确认")&&document.getElementById("field-reading").tagName==="BUTTON"&&window.__meadowStation.stats().notebook.unlocked'));
 await evaluate('window.__meadowStation.close();window.__meadowStation.open()');
 check('leaving and returning retains the observations and clue',await evaluate('window.__meadowStation.stats().clue&&window.__meadowStation.stats().findings.length===2'));
 for(const width of [768,1024,1280,1440,2560]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});await pause(100);
  const layout=await evaluate('(()=>{const note=document.getElementById("field-note").getBoundingClientRect(),pin=document.getElementById("field-pin").getBoundingClientRect(),controls=document.getElementById("field-controls"),r=controls.getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,note:note.toJSON(),pin:pin.toJSON(),controlsOverflow:controls.scrollWidth>controls.clientWidth,dock:r.toJSON(),height:innerHeight}})()');
  check(`${width}px observation notes do not cover the measurement point or overflow`,layout.scroll<=width&&!layout.controlsOverflow&&(layout.note.bottom<=layout.pin.top||layout.note.top>=layout.pin.bottom||layout.note.right<=layout.pin.left||layout.note.left>=layout.pin.right),layout);
  check(`${width}px controls remain within the first screen`,layout.dock.top>=0&&layout.dock.bottom<=layout.height&&layout.dock.left>=0&&layout.dock.right<=width,layout.dock);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await until('!document.querySelector("site-search button[data-open-modal]").disabled');await evaluate('document.querySelector("site-search button[data-open-modal]").click()');await until('!!document.querySelector(".pagefind-ui__search-input")');await pause(80);
 check('search pauses the environment while keeping the record state',await evaluate('!window.__meadowMotion.stats().running&&window.__meadowStation.stats().observed'));
 await evaluate('const input=document.querySelector(".pagefind-ui__search-input");input.value="形式化验证";input.dispatchEvent(new Event("input",{bubbles:true}));');await until('document.querySelectorAll(".pagefind-ui__result").length>0');
 check('homepage search returns actual indexed chapters',await evaluate('[...document.querySelectorAll(".pagefind-ui__result-link")].every(a=>a.href.includes("/Venturing-into-the-Unmanned-Unknown/"))'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(100);
 check('Escape closes search before leaving station view',await evaluate('!document.querySelector("site-search dialog").open&&window.__meadowStation.stats().active'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(60);
 check('station exit restores title and entry focus',await evaluate('!window.__meadowStation.stats().active&&document.activeElement.id==="enter-field"'));
 await evaluate('window.__meadowStation.open();document.getElementById("field-action").click()');
 check('a fresh comparison clears evidence only when requested',await evaluate('!window.__meadowStation.stats().clue&&window.__meadowStation.stats().findings.length===0&&window.__meadowStation.stats().view==="archive"'));
 await evaluate('document.getElementById("field-action").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 check('native keyboard activation inspects a point and retains action focus',await evaluate('window.__meadowStation.stats().findings.join()==="stake"&&document.activeElement.id==="field-action"'),await evaluate('({state:window.__meadowStation.stats(),focus:document.activeElement.id})'));
 await evaluate('document.getElementById("field-action").click();document.getElementById("field-action").click()');
 check('control-strip alternative completes comparison without pointer hotspots',await evaluate('window.__meadowStation.stats().clue&&window.__meadowStation.stats().findings.length===2'));
 await evaluate('window.__meadowStation.close();document.getElementById("chapters").scrollIntoView({behavior:"instant"})');await pause(180);const offscreen=await evaluate('window.__meadowMotion.stats().frames');await pause(180);
 check('scrolling past the scene suspends environment draws',await evaluate(`window.__meadowMotion.stats().frames===${offscreen}&&!window.__meadowMotion.stats().running`));
 await evaluate('window.scrollTo({top:0,behavior:"instant"})');await pause(100);
 // Sustained work in this owned test page exercises automatic load shedding.
 // This never runs in the production module or the user's browser tab.
 await evaluate('(async()=>{const end=performance.now()+9000;while(performance.now()<end){await new Promise(requestAnimationFrame);const busy=performance.now()+80;while(performance.now()<busy){}}})()');await pause(1200);
 check('sustained frame pressure reduces the render budget automatically',await evaluate('window.__meadowMotion.stats().quality!=="balanced"&&window.__meadowMotion.stats().buffer[0]<=896'),await evaluate('window.__meadowMotion.stats()'));
 await evaluate('document.getElementById("motion-toggle").click()');await pause(100);const stopped=await evaluate('window.__meadowMotion.stats().frames');await pause(200);
 check('explicit pause stops desktop environment draws',await evaluate(`window.__meadowMotion.stats().frames===${stopped}`));
 for(const width of [320,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});await send('Page.navigate',{url});await until('document.querySelector(".landscape")?.dataset.motion==="static-mobile"');
  check(`${width}px fresh mobile page loads only the static scene and reading`,await evaluate('!window.__meadowMotion&&!window.__meadowStation&&!document.querySelector(".field-actor")&&!performance.getEntriesByType("resource").some(e=>/meadow-motion.*\.js|meadow-station|engineer-actions|motion-mask|sky-loop/.test(e.name))&&getComputedStyle(document.querySelector("#enter-field")).display==="none"'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Page.navigate',{url});await until('!!window.__meadowMotion');
 const reduced=await evaluate('window.__meadowMotion.stats().frames');await pause(200);
 check('reduced motion leaves a complete still scene',await evaluate(`!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${reduced}`));
 await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url});await pause(250);
 check('without JavaScript the full painting, reading and chapters remain',await evaluate('document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("#chapters .mt-cell").length===10&&document.querySelector("#enter-field").hidden&&!!document.querySelector(".read-link[href*=ch0]")'));
 await send('Emulation.setScriptExecutionDisabled',{value:false});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==="webgl"?null:original.call(this,t,...args)};'});
 await send('Page.navigate',{url});await until('!!window.__meadowStation&&document.querySelector(".landscape").dataset.motion==="fallback"');await evaluate('window.__meadowStation.open();window.__meadowStation.action()');
 check('without WebGL station records and the original painting remain usable',await evaluate('document.querySelector(".landscape").dataset.motion==="fallback"&&window.__meadowStation.stats().observed&&document.querySelector(".landscape-art").src.includes("hero-v04")'));
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 check('no production homepage runtime errors',report.consoleErrors.length===0,report.consoleErrors);
 if(process.argv.includes('--with-lifecycle'))await (await import('./home-lifecycle-checks.mjs')).run({send,evaluate,until,pause,check,report});
 if(process.argv.includes('--with-surface'))await (await import('./home-surface-checks.mjs')).run({send,evaluate,until,pause,check,report});
 if(process.argv.includes('--with-notebook'))await (await import('./home-notebook-checks.mjs')).run({send,evaluate,until,pause,check,report});
}
