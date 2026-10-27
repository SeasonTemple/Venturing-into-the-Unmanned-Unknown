// One-shot arrival intent, without changing canonical chapter links or history.
const key='field-journal-arrival';
export function setupChapterArrival(host,{signal,reduced,state}){
 const status=state.arrival={phase:'idle'};
 const chapters=new Set([...host.querySelectorAll('.book-rail a')].map(a=>a.href));
 host.addEventListener('click',event=>{
  const link=event.target.closest('a[rel=prev],a[rel=next]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank'||!chapters.has(link.href))return;
  try{sessionStorage.setItem(key,JSON.stringify({path:new URL(link.href).pathname,time:Date.now()}));}catch{}
 },{signal});
 let intent;
 try{intent=JSON.parse(sessionStorage.getItem(key));sessionStorage.removeItem(key);}catch{}
 if(!intent||intent.path!==location.pathname||Date.now()-intent.time<0||Date.now()-intent.time>30000||location.hash||scrollY>8||performance.getEntriesByType('navigation')[0]?.type!=='navigate')return;
 const controls=new AbortController(),body=document.getElementById('body');
 let timer=0,finishTimer=0,paint=0;
 status.phase='preview';
 function clear(){clearTimeout(timer);clearTimeout(finishTimer);cancelAnimationFrame(paint);}
 function cancel(reason){
  const moving=status.phase==='scrolling';
  clear();controls.abort();status.phase='cancelled';status.reason=reason;
  if(moving)scrollTo({top:scrollY,behavior:'instant'});
 }
 function finish(){
  if(status.phase!=='scrolling')return;
  clear();controls.abort();status.phase='reading';body.focus({preventScroll:true});
 }
 function enterBody(){
  if(document.hidden)return;
  if(document.querySelector('dialog[open]')){cancel('dialog');return;}
  status.phase='scrolling';
  document.addEventListener('scrollend',finish,{once:true,signal:controls.signal});
  body.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
  finishTimer=setTimeout(finish,reduced()?0:1000);
 }
 function preview(){
  clearTimeout(timer);
  if(!document.hidden)timer=setTimeout(enterBody,1000);
 }
 const listen={capture:true,passive:true,signal:controls.signal};
 for(const type of ['wheel','touchstart','pointerdown','keydown'])addEventListener(type,()=>cancel('interaction'),listen);
 addEventListener('scroll',()=>{if(status.phase==='preview'&&scrollY>8)cancel('scroll');},listen);
 addEventListener('pagehide',()=>cancel('navigation'),{once:true,signal:controls.signal});
 document.addEventListener('visibilitychange',()=>{
  if(status.phase==='scrolling'&&document.hidden)cancel('hidden');else preview();
 },{signal:controls.signal});
 signal.addEventListener('abort',()=>{clear();controls.abort();},{once:true});
 // Start the dwell after the destination has had a chance to paint its masthead.
 paint=requestAnimationFrame(()=>{paint=requestAnimationFrame(preview);});
}
