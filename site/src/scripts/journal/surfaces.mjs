import {createRelief} from './relief-material.mjs';

export function mountRelief(figure,config){
  const state={status:'loading',frames:0,disposed:false},canvas=document.createElement('canvas');canvas.className='relief-canvas';canvas.setAttribute('aria-hidden','true');figure.prepend(canvas);
  let relief,frame=0,last=0,elapsed=0,visible=true,disposed=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController(),{signal}=abort;
  try{if(!canvas.getContext('webgl2',{antialias:true,powerPreference:'low-power'}))throw Error('WebGL unavailable');relief=createRelief(canvas);figure.classList.add('relief-ready');state.status='ready';}catch{canvas.remove();state.status='fallback';return{state,dispose(){state.disposed=true;}};}
  const enabled=()=>!motion.matches&&!document.body.classList.contains('motion-paused')&&!document.body.classList.contains('focused');
  function schedule(){if(disposed||!visible||document.hidden)return;if(!frame)frame=requestAnimationFrame(paint);}
  function paint(now){frame=0;if(disposed||!visible||document.hidden)return;if(last&&enabled()&&now-last<100){schedule();return;}if(last&&enabled())elapsed+=Math.min(.15,(now-last)/1000);last=now;relief.render(elapsed);state.frames++;state.metrics=relief.state();if(enabled())schedule();}
  function sync(){cancelAnimationFrame(frame);frame=0;last=0;schedule();}
  const resize=new ResizeObserver(()=>{relief.resize();sync();});resize.observe(figure);
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){cancelAnimationFrame(frame);frame=0;last=0;}else sync();},{threshold:.01});observer.observe(figure);
  const bodyObserver=new MutationObserver(sync);bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync,{signal});document.addEventListener('readingmotionchange',sync,{signal});motion.addEventListener('change',sync,{signal});
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;last=0;},{signal});addEventListener('pageshow',sync,{signal});schedule();
  return{state,dispose(){if(disposed)return;disposed=true;state.disposed=true;cancelAnimationFrame(frame);abort.abort();resize.disconnect();observer.disconnect();bodyObserver.disconnect();relief.dispose();canvas.remove();figure.classList.remove('relief-ready');}};
}
