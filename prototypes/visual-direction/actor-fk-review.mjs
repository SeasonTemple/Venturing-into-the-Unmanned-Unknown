const canvas=document.querySelector('#comparison'),ctx=canvas.getContext('2d');
const bench=document.querySelector('#workbench'),play=document.querySelector('#play'),view=document.querySelector('#view');
const timeline=document.querySelector('#timeline'),speed=document.querySelector('#speed'),status=document.querySelector('#status');
const previous=document.querySelector('#previous'),next=document.querySelector('#next'),label=document.querySelector('#frame-label');
const angles=document.querySelector('#angles'),contact=document.querySelector('#contact');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const degrees=value=>(Math.abs(value)<.05?0:value).toFixed(1);
let data,atlas,frame=0,raf=0,last=0,carry=0,playing=false,ready=false,skipped=false,visible=true,paints=0;
if(matchMedia('(max-width:700px)').matches)view.value='mesh';
function render(){
  if(!ready||document.hidden||skipped||!visible)return;
  const all=view.value==='all',col={source:0,target:1,mesh:2}[view.value]??0;
  const width=all?540:180;
  if(canvas.width!==width*2){canvas.width=width*2;canvas.height=560;}
  canvas.classList.toggle('single',!all);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,frame%8*540+(all?0:col*180),Math.floor(frame/8)*280,width,280,0,0,width*2,560);
  timeline.value=frame;label.textContent=`第 ${frame+1} / ${data.frames.length} 帧`;
  const d=data.frames[frame];
  angles.textContent=['R','L'].map(s=>`${s==='R'?'右':'左'}膝：原始 ${degrees(d.angles[s].sourceKnee)}° / 目标 ${degrees(d.angles[s].targetKnee)}°`).join('　 · 　');
  contact.textContent=`最低鞋底点距固定地面 ${d.lowestSoleMm>=0?'+':''}${d.lowestSoleMm.toFixed(1)} mm（仅为最低点；不能证明整面鞋底接触）`;
  previous.disabled=frame===0;next.disabled=frame===data.frames.length-1;paints++;
}
function report(){play.textContent=playing?'暂停':'播放整段';play.setAttribute('aria-pressed',String(playing));status.textContent=playing?'同一时刻 · 同一动作记录':frame===47?'有限片段结束 · 不自动接回第一帧':'已撤回 · 脚部接触复核未通过';}
function halt(){cancelAnimationFrame(raf);raf=0;last=0;}
function allowed(){return ready&&playing&&!document.hidden&&!skipped&&visible;}
function schedule(){if(allowed()&&!raf)raf=requestAnimationFrame(tick);}
function tick(now){
  raf=0;if(!allowed()){last=0;return;}
  carry+=(last?Math.min((now-last)/1000,.1):0)*data.fps*Number(speed.value);last=now;
  if(carry>=1){const steps=Math.floor(carry);carry-=steps;frame=Math.min(data.frames.length-1,frame+steps);render();if(frame===data.frames.length-1){playing=false;last=0;report();}}
  schedule();
}
function seek(value){playing=false;halt();carry=0;frame=Math.max(0,Math.min(data.frames.length-1,value));render();report();}
play.addEventListener('click',()=>{if(playing){playing=false;halt();}else{if(frame===data.frames.length-1){frame=0;render();}playing=true;carry=0;last=0;}report();schedule();});
previous.addEventListener('click',()=>seek(frame-1));next.addEventListener('click',()=>seek(frame+1));
document.querySelector('#restart').addEventListener('click',()=>seek(0));timeline.addEventListener('input',()=>seek(Number(timeline.value)));
view.addEventListener('change',render);speed.addEventListener('change',()=>{carry=0;last=0;});
function resumeOrHalt(){if(!allowed())halt();else schedule();render();}
bench.addEventListener('contentvisibilityautostatechange',event=>{skipped=event.skipped;resumeOrHalt();});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resumeOrHalt();},{rootMargin:'150px'}).observe(bench);
document.addEventListener('visibilitychange',resumeOrHalt);window.addEventListener('pagehide',halt);
reduced.addEventListener('change',event=>{if(event.matches){playing=false;halt();report();}});
try{
  const response=await fetch('actor-fk-reference-v02/playback.json');if(!response.ok)throw Error('Playback data unavailable');data=await response.json();
  atlas=new Image();atlas.src='actor-fk-reference-v02/reference-atlas.webp';await atlas.decode();
  ready=true;document.querySelector('#controls').inert=false;render();report();
  window.actorFK=Object.freeze({snapshot:()=>({ready,frame,playing,paints,scheduled:!!raf,view:view.value,handMode:data.handMode,artApproved:false})});
}catch(error){status.textContent='对照加载失败，请刷新重试。';console.error(error);}
