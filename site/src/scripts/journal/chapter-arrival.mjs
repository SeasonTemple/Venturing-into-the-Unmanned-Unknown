// One-shot arrival intent, without changing canonical chapter links or history.
const key='field-journal-arrival';
const chapterPath=/\/ch(?:[0-8]|A)\/?$/;

export function installArrivalRecorder(){
 if(installArrivalRecorder.installed)return;
 installArrivalRecorder.installed=true;
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
  let url;
  try{url=new URL(link.href,location.href);}catch{return;}
  if(url.origin!==location.origin||url.pathname===location.pathname||!chapterPath.test(url.pathname))return;
  try{sessionStorage.setItem(key,JSON.stringify({path:url.pathname,time:Date.now()}));}catch{}
 },true);
}

export function getReadingStart(){
 if(document.body.classList.contains('focused'))return 0;
 const spread=document.querySelector('.reading-spread'),chrome=document.querySelector('.reader-chrome'),travel=document.querySelector('.chapter-travel');
 if(!spread||!chrome)return 0;
 const bars=chrome.offsetHeight+(travel&&getComputedStyle(travel).display!=='none'?travel.offsetHeight:0);
 return Math.max(0,Math.ceil(spread.getBoundingClientRect().top+scrollY-bars));
}

export function setupChapterArrival(host,{signal,reduced,state}){
 installArrivalRecorder();
 const status=state.arrival={phase:'idle'};
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
  scrollTo({top:getReadingStart(),behavior:reduced()?'instant':'smooth'});
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

if(typeof document!=='undefined')installArrivalRecorder();
