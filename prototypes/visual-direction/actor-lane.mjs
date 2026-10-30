import {LaneMotion} from './actor-lane-state.mjs';

const scene=document.querySelector('#scene'),detail=document.querySelector('#detail');
const ctx=scene.getContext('2d'),zoom=detail.getContext('2d');
ctx.imageSmoothingEnabled=false;zoom.imageSmoothingEnabled=false;
const status=document.querySelector('#status'),phase=document.querySelector('#phase');
const region=document.querySelector('#study'),controls=document.querySelector('#controls');
const reduced=document.querySelector('#reduced'),pause=document.querySelector('#pause');
const preference=matchMedia('(prefers-reduced-motion: reduce)');reduced.checked=preference.matches;
const SCALE=.6,START=1510,GROUND=892;
let state,atlases,background,raf=0,previous=0,paused=false,skipped=false,manual=false;
let renderSkipped=false,viewportSkipped=false;
let paints=0,ready=false,lastMode='',lastFrame='';
const labels={idle:'停稳',start:'准备承重，起步',stride:'连续换步',stop:'落脚收步，箱体收稳',launch:'重新承重，出发'};
const load=async url=>{const image=new Image();image.src=url;await image.decode();return image;};

function report() {
  const text=paused?'已暂停':state.mode==='idle'&&state.clip==='start'?'选择前方停点，或按住 ←':labels[state.mode];
  if (text!==lastMode) {status.textContent=text;lastMode=text;}
  phase.textContent=`${state.clip==='stride'?'换步':labels[state.mode]} · ${state.frame+1} / ${state.roots.length}`;
  pause.textContent=paused?'继续':'暂停';pause.setAttribute('aria-pressed',String(paused));
  for (const button of document.querySelectorAll('[data-target]')) button.disabled=Number(button.dataset.target)>=state.x-.1;
}
function draw() {
  if (!ready) return;
  ctx.clearRect(0,0,1920,1080);
  const frame=state.frame,atlas=atlases[state.clip],sx=(frame%8)*200,sy=Math.floor(frame/8)*400;
  const x=START+state.renderX*SCALE;
  // Marker stays on the same strip of paving as the actor's soles.
  const goal=START+state.target*SCALE+48;
  ctx.strokeStyle='#e3ce91';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(goal-9,GROUND+5);ctx.lineTo(goal+9,GROUND+5);ctx.stroke();
  ctx.drawImage(atlas,sx,sy,200,400,x-22*SCALE,GROUND-374*SCALE,200*SCALE,400*SCALE);
  if (lastFrame!==state.clip+frame) {
    zoom.clearRect(0,0,200,400);zoom.drawImage(atlas,sx,sy,200,400,0,0,200,400);
    lastFrame=state.clip+frame;report();
  }
  paints++;
}
function allowed() {return ready&&state.active&&!paused&&!skipped&&!document.hidden&&!reduced.checked;}
function schedule() {if (allowed()&&!raf) raf=requestAnimationFrame(tick);}
function tick(now) {
  raf=0;if (!allowed()) {previous=0;return;}
  const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
  state.tick(dt);draw();
  if (!state.active) {previous=0;report();}
  schedule();
}
function haltClock() {cancelAnimationFrame(raf);raf=0;previous=0;}
function move(target) {
  if (!ready) return;
  paused=false;previous=0;
  if (reduced.checked) {state.place(target);draw();report();return;}
  state.moveTo(target);draw();report();schedule();
}
function stop() {manual=false;if (!ready)return;state.stop();report();schedule();}
function togglePause() {
  if (!ready)return;if(manual)state.stop();manual=false;paused=!paused;
  haltClock();report();schedule();
}
function reset() {haltClock();manual=false;paused=false;state.reset();draw();report();}
scene.addEventListener('click',event=>{
  if (!ready)return;
  const box=scene.getBoundingClientRect();
  const x=(event.clientX-box.left)/box.width*1920,y=(event.clientY-box.top)/box.height*1080;
  if (y<795||y>965||x<1240||x>1650) {status.textContent='请选择人物前方的门前路面。';lastMode='';return;}
  move((x-48-START)/SCALE);scene.focus({preventScroll:true});
});
scene.addEventListener('keydown',event=>{
  if (!ready||event.altKey||event.ctrlKey||event.metaKey)return;
  if (event.key==='ArrowLeft') {
    event.preventDefault();
    if (reduced.checked) {if(!event.repeat)move(state.x-43);return;}
    if (!manual) {manual=true;move(-380);}
  } else if (event.key==='Escape') {event.preventDefault();stop();}
  else if (event.key===' ') {event.preventDefault();if(!event.repeat)togglePause();}
});
window.addEventListener('keyup',event=>{if(event.key==='ArrowLeft'&&manual){event.preventDefault();stop();}});
scene.addEventListener('blur',()=>{if(manual)stop();});
window.addEventListener('blur',()=>{if(manual)stop();haltClock();});
window.addEventListener('focus',schedule);
document.addEventListener('visibilitychange',()=>{
  if (document.hidden) {if(manual)stop();haltClock();} else schedule();
});
function updateVisibility() {
  skipped=renderSkipped||viewportSkipped;
  if(skipped){if(manual)stop();haltClock();}else schedule();
}
region.addEventListener('contentvisibilityautostatechange',event=>{
  renderSkipped=event.skipped;updateVisibility();
});
// A focused descendant can keep content-visibility relevant while off-screen.
// Exact visibility also gates this interaction, independently of render skipping.
new IntersectionObserver(([entry])=>{
  viewportSkipped=!entry.isIntersecting;updateVisibility();
},{rootMargin:'150px'}).observe(region);
for (const button of document.querySelectorAll('[data-target]')) button.addEventListener('click',()=>move(Number(button.dataset.target)));
document.querySelector('#stop').addEventListener('click',stop);
pause.addEventListener('click',togglePause);document.querySelector('#reset').addEventListener('click',reset);
reduced.addEventListener('change',()=>{
  haltClock();manual=false;
  if(ready&&reduced.checked)state.place(state.x);
  draw();schedule();
});
preference.addEventListener('change',event=>{reduced.checked=event.matches;reduced.dispatchEvent(new Event('change'));});
window.addEventListener('pagehide',haltClock);

try {
  const response=await fetch('actor-lane-media/lane.json');if(!response.ok)throw Error('动作数据读取失败');
  const data=await response.json();state=new LaneMotion(data);
  [background,atlases]=await Promise.all([
    load('meadow-media/walk-plate-v01.webp'),
    Promise.all(Object.entries(data.clips).map(async([name,clip])=>[name,await load('actor-lane-media/'+clip.atlas)])).then(Object.fromEntries)
  ]);
  scene.style.backgroundImage=`url("${background.src}")`;
  ready=true;controls.inert=false;draw();
  // Read-only diagnostics for the independent preview's behavior checks.
  window.actorLane=Object.freeze({snapshot:()=>({...state.snapshot(),paused,paints,ready,skipped,reduced:reduced.checked,resources:Object.keys(atlases).length+1})});
} catch(error) {
  status.textContent='画面加载失败，请刷新重试。';console.error(error);
}
