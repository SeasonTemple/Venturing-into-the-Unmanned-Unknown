const toggle = document.querySelector('#art-only');
const stage = document.querySelector('.landscape');
const mediaBase=stage.dataset.mediaBase?new URL(stage.dataset.mediaBase,location.href):new URL('./meadow-media/',import.meta.url);
toggle.addEventListener('click', () => {
  const active = toggle.getAttribute('aria-pressed') !== 'true';
  toggle.setAttribute('aria-pressed', String(active));
  toggle.textContent = active ? '显示标题' : '只看画面';
  stage.classList.toggle('art-only', active);
});

const motionToggle=document.querySelector('#motion-toggle');
let motion,walk,pausedPreference=false;
function pause(value){pausedPreference=!!value;motion?.pause(pausedPreference);walk?.pause(pausedPreference);}
async function start(){
  try{
    const {createMeadowMotion}=await import('./meadow-motion.mjs');
    motion=await createMeadowMotion({canvas:document.querySelector('.environment-motion'),art:document.querySelector('.landscape-art'),maskUrl:new URL('motion-mask-v01.png',mediaBase).href,onState(state){
      stage.dataset.motion=state.lost?'fallback':state.running?'running':'paused';
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
motionToggle.addEventListener('click',()=>pause(!motion.stats().userPaused));
addEventListener('pagehide',event=>{if(!event.persisted){walk?.destroy();motion?.destroy();}});
const ready=start();
const{createMeadowWalk}=await import('./meadow-walk.mjs');
await ready;
walk=await createMeadowWalk({stage,mediaBase,art:document.querySelector('.landscape-art'),surface:document.querySelector('.art-surface'),setArtwork:image=>motion?.setArtwork(image)});
walk.pause(pausedPreference);
window.__meadowWalk=walk;
