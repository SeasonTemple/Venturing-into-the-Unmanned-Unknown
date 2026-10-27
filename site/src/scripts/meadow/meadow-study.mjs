const toggle=document.querySelector('#art-only'),stage=document.querySelector('.landscape');
const mediaBase=new URL(stage.dataset.mediaBase,location.href),motionToggle=document.querySelector('#motion-toggle');
const narrow=matchMedia('(max-width:700px)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
let session,savedStation,pausedPreference=false,disposed=false;

toggle.addEventListener('click',()=>{
 const active=toggle.getAttribute('aria-pressed')!=='true';
 toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'显示标题':'只看画面';stage.classList.toggle('art-only',active);
});
const current=value=>session===value&&!value.abort.signal.aborted;
function pause(value){
 pausedPreference=!!value;
 if(session?.motion)session.motion.pause(pausedPreference);
 else session?.camera?.pause(pausedPreference||reduce.matches||document.hidden||document.body.hasAttribute('data-search-modal-open'));
}
function stop({keepActive=false}={}){
 const old=session;if(!old)return;
 const focusedInside=document.activeElement?.closest('#field-sites,#field-controls');
 savedStation=old.station?.stats()??savedStation;
 if(savedStation&&!keepActive)savedStation={...savedStation,active:false};
 session=undefined;old.abort.abort();
 if(old.station)old.station.destroy();else old.camera?.destroy();
 old.motion?.destroy();
 delete window.__meadowStation;delete window.__meadowMotion;motionToggle.hidden=true;
 if(focusedInside&&narrow.matches)document.querySelector('.read-link').focus({preventScroll:true});
}
async function setup(){
 if(disposed||session)return;
 if(narrow.matches){stage.dataset.motion='static-mobile';motionToggle.hidden=true;return;}
 const value={abort:new AbortController()};session=value;stage.dataset.motion='loading';
 try{
  // Records and navigation are useful even when optional environment assets are slow.
  const [{createMeadowCamera},{createMeadowStation}]=await Promise.all([import('./meadow-camera.mjs'),import('./meadow-station.mjs')]);
  if(!current(value))return;
  value.camera=createMeadowCamera({stage});value.camera.pause(pausedPreference||reduce.matches||document.hidden||document.body.hasAttribute('data-search-modal-open'));
  value.station=createMeadowStation({stage,camera:value.camera,initialState:savedStation});window.__meadowStation=value.station;
  const {createMeadowMotion}=await import('./meadow-motion.mjs');if(!current(value))return;
  const motion=await createMeadowMotion({canvas:document.querySelector('.environment-motion'),art:document.querySelector('.landscape-art'),maskUrl:new URL('motion-mask-v03.png',mediaBase).href,skyUrl:new URL('sky-loop-v01.webp',mediaBase).href,signal:value.abort.signal,onState(state){
   if(!current(value))return;
   stage.dataset.motion=state.lost?'fallback':state.running?'running':'paused';value.camera.pause(!state.running);
   motionToggle.hidden=state.lost;motionToggle.disabled=state.reduced;
   motionToggle.setAttribute('aria-pressed',String(state.userPaused||state.reduced));
   motionToggle.textContent=state.reduced?'静态画面':state.userPaused?'继续动态':'暂停动态';motionToggle.title=state.reduced?'已遵循系统减少动态效果设置':'';
   if(state.reloadRequired){stop({keepActive:true});void setup();}
  }});
  if(!current(value)){motion.destroy();return;}
  value.motion=motion;motion.pause(pausedPreference);
  window.__meadowMotion={stats:()=>motion.stats(),pause,sample:time=>motion.sample(time)};
 }catch(error){
  if(!current(value))return;
  stage.dataset.motion='fallback';motionToggle.hidden=true;
  console.warn('Environment motion unavailable; showing original artwork.',error.message);
 }
}
motionToggle.addEventListener('click',()=>{if(session?.motion)pause(!session.motion.stats().userPaused);});
// Register before the first await, so a breakpoint change can cancel initialization.
narrow.addEventListener('change',()=>{if(narrow.matches){stop();stage.dataset.motion='static-mobile';}else void setup();});
addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;stop();}});
void setup();
