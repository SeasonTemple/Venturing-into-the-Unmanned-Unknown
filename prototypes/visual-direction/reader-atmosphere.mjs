import { paintInkWash } from './ink-wash.mjs';
export function createReaderAtmosphere(sections) {
  const $=id=>document.getElementById(id), motion=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover: hover) and (pointer: fine)');
  let preference=false;try{preference=sessionStorage.getItem('field-reader-paused')==='true';}catch{}
  const stats={frames:0,time:0,enabled:false,outlineOpen:false,disposed:false};
  const canvas=document.createElement('canvas');canvas.className='ink-atmosphere';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  let width=0,height=0,frame=0,last=0,previous=0,dirty=true,disposed=false;
  const enabled=()=>!preference&&!motion.matches&&!document.body.classList.contains('focused')&&!document.hidden;
  function paint(){if(!ctx)return;paintInkWash(ctx,width,height,stats.time);dirty=false;stats.frames++;}
  function animate(now){frame=0;if(disposed)return;const active=enabled();if(now-last>=83||dirty){if(active&&previous)stats.time+=Math.min(.12,(now-previous)/1000);previous=now;last=now;paint();}if(active)frame=requestAnimationFrame(animate);}
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(animate);}
  function resize(){width=document.documentElement.clientWidth;height=innerHeight;canvas.width=width;canvas.height=height;dirty=true;schedule();}
  function scroll(){dirty=true;schedule();}
  function sync(){stats.enabled=!preference&&!motion.matches;document.body.classList.toggle('motion-paused',!stats.enabled);$('motion-toggle').hidden=false;$('motion-toggle').disabled=motion.matches;$('motion-toggle').title=motion.matches?'系统已启用减少动态效果':'';$('motion-toggle').setAttribute('aria-pressed',String(stats.enabled));$('motion-toggle').textContent=stats.enabled?'动效开':'动效停';$('motion-toggle').setAttribute('aria-label',motion.matches?'动态效果已按系统偏好关闭':stats.enabled?'暂停页面动态效果':'开启页面动态效果');if(frame){cancelAnimationFrame(frame);frame=0;}previous=0;dirty=true;schedule();document.dispatchEvent(new Event('readingmotionchange'));}
  function toggleMotion(){preference=stats.enabled;try{sessionStorage.setItem('field-reader-paused',String(preference));}catch{}sync();}
  $('motion-toggle').addEventListener('click',toggleMotion);motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);addEventListener('resize',resize);addEventListener('scroll',scroll,{passive:true});
  const bodyObserver=new MutationObserver(()=>{dirty=true;schedule();});bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  const edge=document.createElement('aside');edge.className='edge-contents';edge.setAttribute('aria-label','本章页边目录');
  const trigger=$('open-outline');trigger.innerHTML='<span class="edge-caption">本章小节</span><span class="edge-count">1/'+sections.length+'</span>';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','edge-panel');
  const panel=document.createElement('div');panel.id='edge-panel';panel.className='edge-panel';panel.hidden=true;panel.innerHTML='<header><span>本章小节</span><button aria-label="收起本章小节">×</button></header><nav aria-label="页边小节目录"></nav><p>沿原文定位，可随时跳读。</p>';
  for(const [i,original] of [...$('outline-panel').children].entries()){const a=document.createElement('a'),number=document.createElement('span');a.href=original.href;number.textContent=String(i+1).padStart(2,'0');a.append(number,document.createTextNode(original.textContent));a.addEventListener('click',event=>{event.preventDefault();close(false);original.click();});panel.querySelector('nav').append(a);}
  // Keep the trigger before its disclosed content in keyboard reading order.
  edge.append(trigger,panel);document.body.append(edge);let pinned=false,timer=0,restoring=false;
  function open(){clearTimeout(timer);panel.hidden=false;trigger.setAttribute('aria-expanded','true');stats.outlineOpen=true;}
  function close(restore=false){clearTimeout(timer);pinned=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');stats.outlineOpen=false;if(restore){restoring=true;trigger.focus({preventScroll:true});restoring=false;}}
  function toggleOutline(){if(pinned)close(false);else{pinned=true;open();}}
  function enter(){if(fine.matches)open();}
  function leave(){timer=setTimeout(()=>{if(!pinned&&!edge.contains(document.activeElement))close();},180);}
  function focusIn(){if(!restoring)open();}
  function focusOut(event){if(!edge.contains(event.relatedTarget)&&!pinned)close();}
  function escape(event){if(event.key==='Escape'&&!panel.hidden){const restore=edge.contains(document.activeElement);close(restore);}}
  function outside(event){if(!edge.contains(event.target))close();}
  function closeButton(){close(true);}
  edge.addEventListener('pointerenter',enter);edge.addEventListener('pointerleave',leave);edge.addEventListener('focusin',focusIn);edge.addEventListener('focusout',focusOut);panel.querySelector('button').addEventListener('click',closeButton);document.addEventListener('keydown',escape);document.addEventListener('pointerdown',outside);
  function update(index){trigger.querySelector('.edge-count').textContent=`${index+1}/${sections.length}`;[...panel.querySelectorAll('nav a')].forEach((a,i)=>{if(i===index)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});dirty=true;schedule();}
  function dispose(){if(disposed)return;disposed=true;stats.disposed=true;clearTimeout(timer);cancelAnimationFrame(frame);bodyObserver.disconnect();$('motion-toggle').removeEventListener('click',toggleMotion);motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);removeEventListener('resize',resize);removeEventListener('scroll',scroll);document.removeEventListener('keydown',escape);document.removeEventListener('pointerdown',outside);removeEventListener('pagehide',pagehide);canvas.remove();edge.remove();}
  function pagehide(event){if(!event.persisted)dispose();}
  addEventListener('pagehide',pagehide);resize();sync();window.__readingStudy.effects=stats;
  return {update,toggleOutline,dispose};
}
