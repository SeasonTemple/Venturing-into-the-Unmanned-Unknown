const toggle = document.querySelector('#art-only');
const stage = document.querySelector('.landscape');
const mediaBase=new URL(stage.dataset.mediaBase,location.href);
toggle.addEventListener('click', () => {
  const active = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(active));
  toggle.textContent = active ? '显示标题' : '只看画面';
  stage.classList.toggle('art-only', active);
});

const motionToggle=document.querySelector('#motion-toggle');
let motion,walk,camera,pausedPreference=false;
function pause(value){pausedPreference=!!value;motion?.pause(pausedPreference);walk?.pause(pausedPreference);}
async function start(){
  if(matchMedia('(max-width:700px)').matches){stage.dataset.motion='static-mobile';motionToggle.hidden=true;return;}
  try{
    const {createMeadowMotion}=await import('./meadow-motion.mjs');
    motion=await createMeadowMotion({canvas:document.querySelector('.environment-motion'),art:document.querySelector('.landscape-art'),maskUrl:new URL('motion-mask-v03.png',mediaBase).href,skyUrl:new URL('sky-loop-v01.webp',mediaBase).href,onState(state){
      stage.dataset.motion=state.lost?'fallback':state.running?'running':'paused';
      camera?.pause(!state.running);
      motionToggle.hidden=state.lost;
      motionToggle.disabled=state.reduced;
      motionToggle.setAttribute('aria-pressed',String(state.userPaused||state.reduced));
      motionToggle.textContent=state.reduced?'静态画面':state.userPaused?'继续动态':'暂停动态';
      motionToggle.title=state.reduced?'已遵循系统减少动态效果设置':'';
      if(state.reloadRequired){motion?.destroy();start();}
    }});
    motion.pause(pausedPreference);
    window.__meadowMotion={stats:()=>motion.stats(),pause,sample:value=>motion.sample(value)};
  }catch(error){
    stage.dataset.motion='fallback';motionToggle.hidden=true;
    console.warn('Environment motion unavailable; showing original artwork.',error.message);
  }
}
motionToggle.addEventListener('click',()=>{if(motion)pause(!motion.stats().userPaused);});
addEventListener('pagehide',event=>{if(!event.persisted){walk?.destroy();motion?.destroy();}});
async function setup(){
 if(!matchMedia('(max-width:700px)').matches){const {createMeadowCamera}=await import('./meadow-camera.mjs');camera=createMeadowCamera({stage});}
 await start();
 if(matchMedia('(max-width:700px)').matches)return;
 const{createMeadowStation}=await import('./meadow-station.mjs');
 walk=createMeadowStation({stage,camera});window.__meadowStation=walk;
}
await setup();
const narrow=matchMedia('(max-width:700px)');
narrow.addEventListener('change',()=>{if(narrow.matches){walk?.close();motion?.pause(true);}else if(!motion&&!walk)setup();else motion?.pause(pausedPreference);});
