export async function run({send,evaluate,until,pause,check,report}){
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/'});await until('!!window.__meadowMotion&&!!window.__meadowStation');
 report.metrics.water=await evaluate(`(async()=>{
  const canvas=document.querySelector('.environment-motion'),gl=canvas.getContext('webgl'),w=canvas.width,h=canvas.height;
  const image=document.createElement('canvas');image.width=w;image.height=h;const ctx=image.getContext('2d');ctx.drawImage(document.querySelector('.landscape-art'),0,0,w,h);const art=ctx.getImageData(0,0,w,h).data;
  const mask=new Image();mask.src=new URL('motion-mask-v03.png',new URL(document.querySelector('.landscape').dataset.mediaBase,location.href)).href;await mask.decode();ctx.imageSmoothingEnabled=false;ctx.drawImage(mask,0,0,w,h);const zones=ctx.getImageData(0,0,w,h).data;
  window.__meadowMotion.pause(true);const capture=t=>{window.__meadowMotion.sample(t);const p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const a=capture(0),b=capture(2);let sum=0,n=0,changed=0,lampChanged=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const m=(y*w+x)*4,i=((h-y-1)*w+x)*4;
   if(zones[m+1]>140){let delta=0;for(let c=0;c<3;c++){const alpha=a[i+3]/255,beta=b[i+3]/255;delta=Math.max(delta,Math.abs(a[i+c]*alpha+art[m+c]*(1-alpha)-b[i+c]*beta-art[m+c]*(1-beta)));}sum+=delta;n++;changed+=Number(delta>5);}
   if(x>w*1252/1920&&x<w*1335/1920&&y>h*590/1080&&y<h*686/1080&&[0,1,2,3].some(c=>a[i+c]!==b[i+c]))lampChanged++;
  }
  return {sampled:n,meanCompositeDelta:sum/n,visibleShare:changed/n,lampChanged};
 })()`);
 check('water visibly changes after compositing over the original painting',report.metrics.water.meanCompositeDelta>3&&report.metrics.water.visibleShare>.3,report.metrics.water);
 check('daytime lamp has no periodic flicker',report.metrics.water.lampChanged===0,report.metrics.water.lampChanged);
 const geometry=selector=>evaluate(`(()=>{const items=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none');return items.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id||e.className,height:r.height,center:r.top+r.height/2,top:r.top,bottom:r.bottom,border:s.borderTopWidth,lineHeight:s.lineHeight,radius:s.borderRadius};});})()`);
 report.metrics.entry=await geometry('.entry-links > button,.entry-links > a');
 check('entry actions share a 44px minimum target and aligned centers',report.metrics.entry.every(e=>e.height>=44&&Math.abs(e.center-report.metrics.entry[0].center)<1),report.metrics.entry);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await evaluate('document.getElementById("enter-field").focus()');
 report.metrics.focus=await evaluate('(()=>{const e=document.getElementById("enter-field"),s=getComputedStyle(e);return {visible:e.matches(":focus-visible"),outline:s.outlineStyle,width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset),shadow:s.boxShadow,color:s.outlineColor};})()');
 check('keyboard focus stays visible and close to the button without an outer halo',report.metrics.focus.visible&&report.metrics.focus.outline==='solid'&&report.metrics.focus.width===2&&report.metrics.focus.offset<=2&&report.metrics.focus.offset>=-4&&report.metrics.focus.shadow==='none',report.metrics.focus);
 await evaluate('window.__meadowStation.open()');await pause(100);
 report.metrics.controls=await geometry('.field-buttons > button,.field-buttons > a');
 check('station links and buttons share height border and alignment',report.metrics.controls.every(e=>e.height>=44&&e.border==='1px'&&Math.abs(e.center-report.metrics.controls[0].center)<1),report.metrics.controls);
 await send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
 check('focus survives forced-colors mode',await evaluate('document.getElementById("field-action").focus();getComputedStyle(document.activeElement).outlineStyle==="solid"&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2'));
 await send('Emulation.setEmulatedMedia',{features:[]});
 await evaluate('window.__meadowStation.action();window.__meadowStation.action();window.__meadowStation.action()');
 for(const [width,height]of [[768,600],[1024,768],[2560,1440]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);
  check(`${width}px station actions remain inside the scene`,await evaluate('(()=>{const r=document.getElementById("field-controls").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()'));
 }
 check('no runtime errors in surface checks',report.consoleErrors.length===0,report.consoleErrors);
}
