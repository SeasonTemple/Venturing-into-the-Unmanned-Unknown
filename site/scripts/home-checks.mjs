export async function run({send,evaluate,until,pause,check,report}){
 const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown',url=base+'/';
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await until('!!window.__meadowStation&&!!window.__meadowMotion');
 check('production home has one approved painting, title and navigation',await evaluate('document.querySelectorAll(".landscape").length===1&&document.querySelectorAll("h1").length===1&&!document.querySelector(".page>.header")&&document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("site-search").length===1'));
 check('reading, ten chapters, install, releases and text indexes remain available',await evaluate('document.querySelectorAll("#chapters .mt-cell").length===10&&!!document.querySelector("[data-mt-cmd-copy]")&&[...document.querySelectorAll(".mt-rows a")].some(a=>a.href.endsWith("llms.txt"))&&!!document.querySelector(".read-link[href*=ch0]")'));
 check('unreviewed directional animation and old three.js hero are not loaded',await evaluate('!window.__meadowWalk&&!document.querySelector(".field-actor")&&!performance.getEntriesByType("resource").some(e=>/three\.|HeroScene|hero-gate|engineer-actions|meadow-walk/.test(e.name))'));
 const before=await evaluate('window.__meadowMotion.stats()');await pause(1000);const after=await evaluate('window.__meadowMotion.stats()');
 check('desktop environment retains bounded draws and texture sizes',after.frames>before.frames&&after.frames-before.frames<=25&&after.textureCount===2&&after.buffer[0]<=1440,{frames:after.frames-before.frames,buffer:after.buffer});
 const motionPixels=await evaluate(`(async()=>{
  const canvas=document.querySelector('.environment-motion'),gl=canvas.getContext('webgl'),w=canvas.width,h=canvas.height,mask=new Image();mask.src=new URL('motion-mask-v01.png',new URL(document.querySelector('.landscape').dataset.mediaBase,location.href)).href;await mask.decode();
  const buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;const ctx=buffer.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(mask,0,0,w,h);const zones=ctx.getImageData(0,0,w,h).data;
  const capture=t=>{window.__meadowMotion.sample(t);const a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  window.__meadowMotion.pause(true);const frames=[capture(0),capture(2),capture(80),capture(82)],result={};
  for(const [name,a,b]of[['early',frames[0],frames[1]],['late',frames[2],frames[3]]]){
   const counts={cloud:[0,0],water:[0,0],grass:[0,0],fixed:[0,0]};
   for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const m=(y*w+x)*4,i=((h-1-y)*w+x)*4;let zone=zones[m]>200?'cloud':zones[m+1]>140?'water':zones[m+2]>80?'grass':zones[m]===0&&zones[m+1]===0&&zones[m+2]===0?'fixed':null;if(!zone)continue;counts[zone][0]++;if(Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])))>3)counts[zone][1]++;}
   result[name]=Object.fromEntries(Object.entries(counts).map(([k,[n,d]])=>[k,{sampled:n,changed:d,share:n?d/n:0}]));
  }window.__meadowMotion.pause(false);return result;
 })()`);
 report.metrics.motionPixels=motionPixels;
 check('clouds keep moving after the initial minute and grass and water remain visible',motionPixels.early.cloud.share>.01&&motionPixels.late.cloud.share>.01&&motionPixels.early.grass.share>.01&&motionPixels.early.water.share>.01,motionPixels);
 check('environment motion leaves the painted character and architecture fixed',motionPixels.early.fixed.changed===0&&motionPixels.late.fixed.changed===0,motionPixels);
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
 check('station record opens without translating or animating the painted character',await evaluate('window.__meadowStation.stats().observed&&!document.getElementById("field-note").hidden&&document.querySelector(".landscape-art").src.includes("hero-v04")&&!document.querySelector(".field-actor")'));
 check('measurement point uses a ground ring rather than a white text badge',await evaluate('(()=>{const p=document.getElementById("field-pin");return !p.hidden&&!p.textContent.trim()&&getComputedStyle(p).backgroundColor==="rgba(0, 0, 0, 0)"})()'));
 await until('!document.querySelector("site-search button[data-open-modal]").disabled');await evaluate('document.querySelector("site-search button[data-open-modal]").click()');await until('!!document.querySelector(".pagefind-ui__search-input")');await pause(80);
 check('search pauses the environment while keeping the record state',await evaluate('!window.__meadowMotion.stats().running&&window.__meadowStation.stats().observed'));
 await evaluate('const input=document.querySelector(".pagefind-ui__search-input");input.value="形式化验证";input.dispatchEvent(new Event("input",{bubbles:true}));');await until('document.querySelectorAll(".pagefind-ui__result").length>0');
 check('homepage search returns actual indexed chapters',await evaluate('[...document.querySelectorAll(".pagefind-ui__result-link")].every(a=>a.href.includes("/Venturing-into-the-Unmanned-Unknown/"))'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(100);
 check('Escape closes search before leaving station view',await evaluate('!document.querySelector("site-search dialog").open&&window.__meadowStation.stats().active'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(60);
 check('station exit restores title and entry focus',await evaluate('!window.__meadowStation.stats().active&&document.activeElement.id==="enter-field"'));
 await evaluate('document.getElementById("motion-toggle").click()');await pause(100);const stopped=await evaluate('window.__meadowMotion.stats().frames');await pause(200);
 check('explicit pause stops desktop environment draws',await evaluate(`window.__meadowMotion.stats().frames===${stopped}`));
 for(const width of [320,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:2,mobile:true});await send('Page.navigate',{url});await until('document.querySelector(".landscape")?.dataset.motion==="static-mobile"');
  check(`${width}px fresh mobile page loads only the static scene and reading`,await evaluate('!window.__meadowMotion&&!window.__meadowStation&&!document.querySelector(".field-actor")&&!performance.getEntriesByType("resource").some(e=>/meadow-motion.*\.js|meadow-station|engineer-actions|motion-mask/.test(e.name))&&getComputedStyle(document.querySelector("#enter-field")).display==="none"'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Page.navigate',{url});await until('!!window.__meadowMotion');
 const reduced=await evaluate('window.__meadowMotion.stats().frames');await pause(200);
 check('reduced motion leaves a complete still scene',await evaluate(`!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${reduced}`));
 await send('Emulation.setScriptExecutionDisabled',{value:true});await send('Page.navigate',{url});await pause(250);
 check('without JavaScript the full painting, reading and chapters remain',await evaluate('document.querySelector(".landscape-art").naturalWidth===1920&&document.querySelectorAll("#chapters .mt-cell").length===10&&document.querySelector("#enter-field").hidden&&!!document.querySelector(".read-link[href*=ch0]")'));
 await send('Emulation.setScriptExecutionDisabled',{value:false});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:'const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return t==="webgl"?null:original.call(this,t,...args)};'});
 await send('Page.navigate',{url});await until('!!window.__meadowStation');await evaluate('window.__meadowStation.open();window.__meadowStation.action()');
 check('without WebGL station records and the original painting remain usable',await evaluate('document.querySelector(".landscape").dataset.motion==="fallback"&&window.__meadowStation.stats().observed&&document.querySelector(".landscape-art").src.includes("hero-v04")'));
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 check('no production homepage runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
