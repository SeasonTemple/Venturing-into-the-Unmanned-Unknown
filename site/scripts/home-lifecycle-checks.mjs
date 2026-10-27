// Exercise cancellation and actual GPU object lifetime in one owned browser.
export async function run({send,evaluate,until,pause,check,report}){
 const url='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/';
 const viewport=width=>send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<=700});
 const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__gpu={textures:new Set(),programs:new Set(),buffers:new Set(),peakTextures:0};
  for(const [kind,name]of [['Texture','textures'],['Program','programs'],['Buffer','buffers']]){
   const proto=WebGLRenderingContext.prototype,create=proto['create'+kind],remove=proto['delete'+kind];
   proto['create'+kind]=function(...args){const item=create.apply(this,args);if(item)window.__gpu[name].add(item);window.__gpu.peakTextures=Math.max(window.__gpu.peakTextures,window.__gpu.textures.size);return item;};
   proto['delete'+kind]=function(item){window.__gpu[name].delete(item);return remove.call(this,item);};
  }
  window.__holdSky=true;let release;const gate=new Promise(r=>release=r);window.__releaseSky=()=>{window.__holdSky=false;release();};
  const decode=HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode=function(){const decoded=decode.call(this);return this.src.includes('sky-loop')&&window.__holdSky?Promise.all([decoded,gate]):decoded;};
 `});
 await viewport(1440);await send('Page.navigate',{url});
 await until('!!window.__releaseSky&&!!document.querySelector(".landscape")');await pause(700);
 check('records are usable while the optional sky texture is still decoding',await evaluate('!!window.__meadowStation&&!document.getElementById("enter-field").hidden&&!window.__meadowMotion'));
 check('waiting for texture decode does not allocate GPU scene objects',await evaluate('window.__gpu.textures.size===0&&window.__gpu.programs.size===0'));
 await viewport(390);await pause(150);await evaluate('window.__releaseSky()');await pause(500);
 check('crossing to mobile cancels a pending desktop initialization',await evaluate('!window.__meadowMotion&&window.__gpu.textures.size===0&&document.querySelector(".landscape").dataset.motion==="static-mobile"'));
 await viewport(1440);await until('!!window.__meadowStation&&!!window.__meadowMotion');await pause(120);
 await evaluate('window.__retiredMotion=window.__meadowMotion;window.__retiredStation=window.__meadowStation;window.__meadowStation.open();window.__meadowStation.action();document.getElementById("field-reference").click();document.getElementById("field-action").focus()');
 await viewport(390);await pause(200);
 check('mobile transition releases live GPU textures programs and buffers',await evaluate('window.__gpu.textures.size===0&&window.__gpu.programs.size===0&&window.__gpu.buffers.size===0'),await evaluate('({textures:window.__gpu.textures.size,programs:window.__gpu.programs.size,buffers:window.__gpu.buffers.size})'));
 check('mobile transition stops the old loop and removes invisible keyboard focus',await evaluate('!window.__retiredMotion.stats().running&&!window.__meadowMotion&&!window.__meadowStation&&document.activeElement.classList.contains("read-link")'));
 for(let i=0;i<3;i++){
  await viewport(1440);await until('!!window.__meadowStation&&!!window.__meadowMotion');
  check(`desktop return ${i+1} retains findings with exactly one GPU scene`,await evaluate('window.__meadowStation.stats().findings.join()==="reference"&&window.__gpu.textures.size===3&&window.__gpu.programs.size===1&&window.__gpu.buffers.size===1'));
  await viewport(390);await pause(150);
 }
 await viewport(1440);await until('!!window.__meadowStation&&!!window.__meadowMotion');
 check('retired station handlers cannot reopen the scene',await evaluate('window.__retiredStation.open();!document.querySelector(".landscape").classList.contains("exploring")'));
 await evaluate('window.__meadowStation.open();window.__meadowMotion.pause(true)');await viewport(390);await pause(120);await viewport(1440);await until('!!window.__meadowMotion&&!!window.__meadowStation');
 const frames=await evaluate('window.__meadowMotion.stats().frames');await pause(180);
 check('explicit pause survives desktop teardown and reentry',await evaluate(`window.__meadowMotion.stats().userPaused&&!window.__meadowMotion.stats().running&&window.__meadowMotion.stats().frames===${frames}`));
 await evaluate('window.__meadowStation.open();window.__beforeRestore=window.__meadowStation;window.__contextLoss=document.querySelector(".environment-motion").getContext("webgl").getExtension("WEBGL_lose_context");window.__contextLoss.loseContext()');
 await until('document.querySelector(".landscape").dataset.motion==="fallback"');await pause(150);
 check('context loss retains the usable record interaction',await evaluate('window.__meadowStation.stats().active&&window.__meadowStation.stats().findings.join()==="reference"&&!document.getElementById("field-note").hidden'));
 await evaluate('window.__contextLoss.restoreContext()');await until('!!window.__meadowMotion&&window.__meadowStation!==window.__beforeRestore');
 check('context restoration preserves the current view findings and pause',await evaluate('window.__meadowStation.stats().active&&window.__meadowStation.stats().findings.join()==="reference"&&window.__meadowMotion.stats().userPaused&&window.__gpu.textures.size===3'));
 report.metrics.gpu=await evaluate('({textures:window.__gpu.textures.size,programs:window.__gpu.programs.size,buffers:window.__gpu.buffers.size,peakTextures:window.__gpu.peakTextures})');
 check('repeated initialization never overlaps multiple scene texture sets',report.metrics.gpu.peakTextures===3,report.metrics.gpu);
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 check('no runtime errors through cancellation and repeated breakpoints',report.consoleErrors.length===0,report.consoleErrors);
}
