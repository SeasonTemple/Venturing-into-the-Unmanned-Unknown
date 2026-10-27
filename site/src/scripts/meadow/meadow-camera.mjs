// A compositor-only camera over the same painting; the person never slides.
export function createMeadowCamera({stage}){
 const viewport=stage.querySelector('.art-surface'),world=stage.querySelector('.field-world'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const shots={poster:[1020,540,1,.5,.5],station:[1390,650,1.08,.68,.58],archive:[1290,610,1.04,.68,.57],stake:[420,750,2.1,.66,.64],reference:[510,690,2.4,.66,.64],comparison:[690,700,1.08,.67,.64],clue:[560,690,1.16,.67,.64]};
 let view='poster',animation,disposed=false,paused=false,transitioning=false;
 world.style.width='1920px';world.style.height='1080px';
 const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
 function frame(animate=false){
  if(disposed)return;
  const r=viewport.getBoundingClientRect();if(!r.width||!r.height)return;
  const [x,y,z,ax,ay]=shots[view],scale=Math.max(r.width/1920,r.height/1080)*z;
  const tx=clamp(r.width*ax-x*scale,r.width-1920*scale,0),ty=clamp(r.height*ay-y*scale,r.height-1080*scale,0);
  const from=getComputedStyle(world).transform,to=`translate(${tx}px,${ty}px) scale(${scale})`;
  animation?.cancel();transitioning=false;world.style.transform=to;
  if(animate&&!reduce.matches&&!paused&&from!=='none'){
   animation=world.animate([{transform:from},{transform:to}],{duration:1050,easing:'cubic-bezier(.22,.7,.22,1)'});transitioning=true;
   animation.onfinish=()=>{transitioning=false;animation=null;};
  }
  stage.dataset.camera=view;
 }
 const observer=new ResizeObserver(()=>frame());observer.observe(viewport);
 const finish=()=>{animation?.finish();transitioning=false;};
 reduce.addEventListener('change',finish);frame();
 return{setView(next){if(shots[next]&&next!==view){view=next;frame(true);}},pause(value){paused=value;if(value)finish();},stats:()=>({view,transitioning,disposed}),destroy(){disposed=true;animation?.cancel();observer.disconnect();reduce.removeEventListener('change',finish);}};
}
