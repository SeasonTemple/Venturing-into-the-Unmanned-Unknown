import {SPEC,DURATION,sampleRun} from './motion-proof-geometry.mjs';
const $=id=>document.getElementById(id),container=$('motion'),canvas=$('route-canvas'),zoom=$('zoom-canvas'),ctx=canvas.getContext('2d'),zc=zoom.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const state={time:0,playing:false,speed:1,ready:false,visible:!document.hidden,skipped:false,near:true,raf:0,last:0,lastPaint:0,lastUi:0,paints:0,scheduled:0,images:0,error:null};
let meta,atlases,overlay=false,paintCost=0;
const timings=new Float32Array(120);let timingCursor=0;
const background=document.createElement('canvas');background.width=960;background.height=330;
const bg=background.getContext('2d');bg.fillStyle='#c4cfb6';bg.fillRect(0,0,960,330);bg.fillStyle='#b6c4a6';bg.fillRect(0,275,960,55);bg.fillStyle='#91a37e';bg.fillRect(0,275,960,1);
// A level contact plane keeps the gait test independent of slope/perspective.
// The actual painting is shown separately as an identity reference.
for(const x of [350,554]){bg.fillStyle='#6a805d';bg.fillRect(x,285,1,7);bg.font='11px monospace';bg.fillText(x===554?'起点':'回望处',x-15,310);}
bg.fillStyle='#9daf8e';for(let n=0;n<35;n++){const x=(n*79+31)%960,y=291+(n*13)%30;bg.fillRect(x,y,3+(n%3),1);}
function getPose(sample){
 const name=sample.turn===null?sample.direction+'-walk':'turn',info=meta.atlases[name];
 const index=sample.turn===null?(sample.settle?24:sample.frame):Math.round(sample.turn*(info.count-1));
 return {name,info,index,joints:info.joints[index],image:atlases[name]};
}
function drawSprite(target,pose,x,y,scale){
 const col=pose.index%pose.info.columns,row=Math.floor(pose.index/pose.info.columns);
 target.imageSmoothingEnabled=false;target.drawImage(pose.image,col*SPEC.width,row*SPEC.height,SPEC.width,SPEC.height,Math.round(x),Math.round(y),SPEC.width*scale,SPEC.height*scale);
}
function drawJoints(target,joints,x,y,scale){
 target.save();target.translate(Math.round(x),Math.round(y));target.scale(scale,scale);target.lineWidth=.7;target.strokeStyle='#e0bd7d';
 for(const l of Object.values(joints.legs)){target.beginPath();target.moveTo(...l.hip);target.lineTo(...l.knee);target.lineTo(...l.ankle);target.stroke();target.strokeStyle=l.stance?'#325e48':'#825d3b';target.beginPath();target.arc(l.ankle[0],l.ankle[1]+7,2,0,Math.PI*2);if(l.stance){target.fillStyle='#325e48';target.fill();target.fillRect(l.ankle[0]-5,l.ankle[1]+8,10,.8);}else target.stroke();target.strokeStyle='#e0bd7d';}
 if(joints.hands){target.strokeStyle='#366e68';for(const h of Object.values(joints.hands)){target.strokeRect(h[0]-2,h[1]-2,4,4);}}
 target.restore();
}
function updateUi(s,pose){
 $('motion-state').textContent=s.state;$('frame-number').textContent=pose.name==='turn'?`转身 ${pose.index+1} / 19`:`${s.direction==='left'?'朝左':'朝右'} ${pose.index===24?'停步':`${pose.index+1} / 24`}`;
 $('time-position').textContent=`${s.time.toFixed(1)} / ${DURATION.toFixed(1)} 秒`;
 $('timeline').value=String(s.time);$('timeline').setAttribute('aria-valuetext',`${s.time.toFixed(1)} 秒，${s.state}`);
 $('play').textContent=state.playing?'暂停':s.complete?'重新播放':'播放往返';
}
function render(forceUi=false){
 if(!state.ready)return;const start=performance.now(),s=sampleRun(state.time),pose=getPose(s),x=Math.round(s.worldX-700-SPEC.rootX),y=275-SPEC.floor;
 ctx.clearRect(0,0,960,330);ctx.drawImage(background,0,0);ctx.fillStyle='#4b654c40';ctx.beginPath();ctx.ellipse(x+SPEC.rootX,276,18,2.2,0,0,Math.PI*2);ctx.fill();drawSprite(ctx,pose,x,y,1);
 zc.fillStyle='#c8d2ba';zc.fillRect(0,0,256,392);zc.fillStyle='#a0b18f';zc.fillRect(0,370,256,1);drawSprite(zc,pose,0,0,2);
 if(overlay){drawJoints(ctx,pose.joints,x,y,1);drawJoints(zc,pose.joints,0,0,2);}
 if(forceUi||start-state.lastUi>180){updateUi(s,pose);state.lastUi=start;}
 paintCost=performance.now()-start;timings[timingCursor++%timings.length]=paintCost;state.paints++;
}
function schedule(){if(!state.raf&&state.ready&&state.playing&&state.visible&&!state.skipped&&state.near){state.raf=requestAnimationFrame(tick);state.scheduled++;}}
function unschedule(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.last=0;state.lastPaint=0;}
function tick(now){state.raf=0;if(!state.playing||!state.visible||state.skipped||!state.near)return;
 const dt=state.last?Math.min((now-state.last)/1000,.05):0;state.last=now;state.time=Math.min(DURATION,state.time+dt*state.speed);
 if(now-state.lastPaint>=1000/30||state.time>=DURATION){render(state.time>=DURATION);state.lastPaint=now;}
 if(state.time>=DURATION){state.playing=false;state.last=0;render(true);$('playback-message').textContent='已回到原处。可重新播放，或拖动进度逐帧检查。';}else schedule();
}
function setPlaying(value){
 if(!state.ready)return;state.playing=value;if(value){if(state.time>=DURATION)state.time=0;state.last=0;schedule();}else unschedule();
 $('playback-message').textContent=value?'水平路面动作试验。空格暂停，方向键逐帧；后台与离屏时停止调度。':'已暂停。拖动进度或使用前后帧，检查脚下和器物接触。';render(true);
}
function seek(time){unschedule();state.playing=false;state.time=Math.max(0,Math.min(DURATION,time));render(true);$('playback-message').textContent='已停在所选位置，可继续播放或逐帧检查。';}
function step(direction){
 if(!state.ready)return;const current=getPose(sampleRun(state.time)),key=current.name+':'+current.index;let t=state.time;
 for(let n=0;n<500;n++){t=Math.max(0,Math.min(DURATION,t+direction/240));const p=getPose(sampleRun(t));if(p.name+':'+p.index!==key||t===0||t===DURATION)break;}
 seek(t);
}
function refreshScheduling(){unschedule();schedule();}
$('play').addEventListener('click',()=>setPlaying(!state.playing));
$('restart').addEventListener('click',()=>{seek(0);setPlaying(true);});
$('previous-frame').addEventListener('click',()=>step(-1));$('next-frame').addEventListener('click',()=>step(1));
$('timeline').max=String(DURATION);$('timeline').addEventListener('input',e=>seek(Number(e.target.value)));
$('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);state.last=0;});
$('show-joints').addEventListener('change',e=>{overlay=e.target.checked;render(true);});
canvas.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();setPlaying(!state.playing);}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}});
document.addEventListener('visibilitychange',()=>{state.visible=!document.hidden;refreshScheduling();});
window.addEventListener('pagehide',()=>{state.visible=false;unschedule();});window.addEventListener('pageshow',()=>{state.visible=!document.hidden;refreshScheduling();});
reduce.addEventListener('change',()=>{if(reduce.matches)setPlaying(false);});
// Attach directly: contentvisibilityautostatechange does not reliably bubble.
container.addEventListener('contentvisibilityautostatechange',e=>{state.skipped=e.skipped;refreshScheduling();});
// Also cover older browsers and the exact visibility of this playback surface.
const observer=new IntersectionObserver(entries=>{state.near=entries[0].isIntersecting;refreshScheduling();},{rootMargin:'150px'});observer.observe(container);
const sizeObserver=new ResizeObserver(()=>{const factor=canvas.clientWidth/960;$('native-scale').textContent=factor>.98?'原画尺度 · 人物约 174px':`人物约 ${Math.round(174*factor)}px · 等比缩小`;$('zoom-scale').textContent=`${(zoom.clientWidth/128).toFixed(1).replace('.0','')}× 像素`;});sizeObserver.observe(canvas);sizeObserver.observe(zoom);
async function loadImage(src){const image=new Image();image.src=src;await image.decode();state.images++;return image;}
try{
 const response=await fetch('motion-proof-media/motion.json');if(!response.ok)throw Error('动作记录载入失败');meta=await response.json();
 const names=['left-walk','right-walk','turn'];const images=await Promise.all(names.map(n=>loadImage('motion-proof-media/'+meta.atlases[n].file)));atlases=Object.fromEntries(names.map((n,i)=>[n,images[i]]));
 state.ready=true;for(const button of document.querySelectorAll('.controls button'))button.disabled=false;$('timeline').disabled=false;
 render(true);if(!reduce.matches)setPlaying(true);else $('playback-message').textContent='已按减少动态偏好停在静帧。可逐帧查看，也可手动播放。';
}catch(error){state.error=String(error);$('motion-state').textContent='动作暂未载入';$('playback-message').textContent='可以先查看下方逐帧图；刷新页面后重试。';}
window.__motionProof={
 ready:()=>state.ready,seek,step,play:()=>setPlaying(true),pause:()=>setPlaying(false),
 setVisibility:visible=>{state.visible=visible;refreshScheduling();},
 stats:()=>{const samples=[...timings].filter(n=>n>0).sort((a,b)=>a-b);return {time:state.time,playing:state.playing,ready:state.ready,visible:state.visible,skipped:state.skipped,near:state.near,pendingFrames:state.raf?1:0,paints:state.paints,loadedAtlases:state.images,paintMs:paintCost,p95PaintMs:samples[Math.floor(samples.length*.95)]||0,resourceCount:performance.getEntriesByType('resource').length,error:state.error,current:sampleRun(state.time)};}
};
