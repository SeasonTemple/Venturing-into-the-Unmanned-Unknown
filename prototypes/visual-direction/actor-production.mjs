const pose=document.querySelector('#pose'),scene=document.querySelector('#scene');
const ctx=pose.getContext('2d'),sc=scene.getContext('2d');ctx.imageSmoothingEnabled=false;sc.imageSmoothingEnabled=false;
const status=document.querySelector('#status'),label=document.querySelector('#frame-label');
const play=document.querySelector('#play'),timeline=document.querySelector('#timeline'),speed=document.querySelector('#speed'),joints=document.querySelector('#joints');
const balance=document.querySelector('#balance'),balanceReadout=document.querySelector('#balance-readout');
const prefix='actor-balance-reference-v01/';
let data,atlas,frame=0,raf=0,previous=0,carry=0,playing=false,hiddenWork=false,viewportWork=false,sceneVisible=true,ready=false,paints=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const edges=[['root','spine01'],['spine01','neck03'],['neck03','head'],...['R','L'].flatMap(s=>[['root','upperleg01.'+s],['upperleg01.'+s,'lowerleg01.'+s],['lowerleg01.'+s,'foot.'+s],['spine01','upperarm01.'+s],['upperarm01.'+s,'lowerarm01.'+s],['lowerarm01.'+s,'wrist.'+s]])];
const load=async url=>{const image=new Image();image.src=url;await image.decode();return image;};
function draw(){
  if(!ready)return;
  const sx=frame%8*180,sy=Math.floor(frame/8)*240;
  if(!hiddenWork&&!viewportWork){ctx.clearRect(0,0,360,480);ctx.drawImage(atlas,sx,sy,180,240,0,0,360,480);}
  if(joints.checked&&!hiddenWork&&!viewportWork){
    const p=data.frames[frame].projected;ctx.strokeStyle='#466358';ctx.lineWidth=2;
    for(const[a,b]of edges){ctx.beginPath();ctx.moveTo(p[a][0]*2,p[a][1]*2);ctx.lineTo(p[b][0]*2,p[b][1]*2);ctx.stroke();}
    ctx.fillStyle='#b36b34';for(const v of Object.values(p)){ctx.beginPath();ctx.arc(v[0]*2,v[1]*2,3,0,Math.PI*2);ctx.fill();}
  }
  if(balance.checked&&!hiddenWork&&!viewportWork){
    const p=data.frames[frame].balanceOverlay;
    if(p){
      ctx.strokeStyle='#c98c55';ctx.fillStyle='#c98c55';ctx.lineWidth=2;ctx.setLineDash([6,5]);
      ctx.beginPath();ctx.moveTo(p.com[0]*2,p.com[1]*2);ctx.lineTo(p.ground[0]*2,p.ground[1]*2);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(p.com[0]*2,p.com[1]*2,4,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(p.ground[0]*2-6,p.ground[1]*2);ctx.lineTo(p.ground[0]*2+6,p.ground[1]*2);ctx.stroke();
      ctx.strokeStyle='#83bba0';for(const point of Object.values(p.contacts)){ctx.beginPath();ctx.ellipse(point[0]*2,point[1]*2,8,3,0,0,Math.PI*2);ctx.stroke();}
    }
  }
  if(sceneVisible){sc.clearRect(0,0,1920,1080);sc.drawImage(atlas,sx,sy,180,240,1420+data.frames[frame].travelX,667,180,240);}
  timeline.value=frame;label.textContent=`第 ${frame+1} / ${data.frames.length} 帧`;
  const d=data.frames[frame].diagnostics;
  balanceReadout.textContent=`右肘屈曲 ${d.elbowFlexDegrees.R.toFixed(1)}°（伸直为 0°） · 接触脚：${d.contactFeet.map(s=>s==='R'?'右':'左').join('、')}`;
  document.querySelector('#previous').disabled=frame===0;document.querySelector('#next').disabled=frame===data.frames.length-1;
  paints++;
}
function report(){play.textContent=playing?'暂停':'播放整段';play.setAttribute('aria-pressed',String(playing));status.textContent=playing?'完整行走片段 · 播放中':frame===47?'片段结束 · 不自动跳回第一帧':'运动参考 · 尚非成品动画';}
function halt(){cancelAnimationFrame(raf);raf=0;previous=0;}
function allowed(){return ready&&playing&&!document.hidden&&((!hiddenWork&&!viewportWork)||sceneVisible);}
function schedule(){if(allowed()&&!raf)raf=requestAnimationFrame(tick);}
function tick(now){
  raf=0;if(!allowed()){previous=0;return;}
  carry+=previous?Math.min((now-previous)/1000,.05)*data.fps*Number(speed.value):0;previous=now;
  if(carry>=1){const n=Math.floor(carry);carry-=n;frame=Math.min(data.frames.length-1,frame+n);draw();if(frame===data.frames.length-1){playing=false;previous=0;report();}}
  schedule();
}
function seek(value){playing=false;halt();carry=0;frame=Math.max(0,Math.min(data.frames.length-1,value));draw();report();}
play.addEventListener('click',()=>{if(playing){playing=false;halt();}else{if(frame===data.frames.length-1){frame=0;draw();}playing=true;}report();schedule();});
document.querySelector('#previous').addEventListener('click',()=>seek(frame-1));document.querySelector('#next').addEventListener('click',()=>seek(frame+1));
document.querySelector('#restart').addEventListener('click',()=>seek(0));timeline.addEventListener('input',()=>seek(Number(timeline.value)));
joints.addEventListener('change',draw);balance.addEventListener('change',draw);speed.addEventListener('change',()=>{previous=0;carry=0;});
const bench=document.querySelector('#workbench');
function visibilityChanged(){if(!allowed())halt();else schedule();draw();}
bench.addEventListener('contentvisibilityautostatechange',event=>{hiddenWork=event.skipped;visibilityChanged();});
new IntersectionObserver(([entry])=>{viewportWork=!entry.isIntersecting;visibilityChanged();},{rootMargin:'150px'}).observe(bench);
new IntersectionObserver(([entry])=>{sceneVisible=entry.isIntersecting;visibilityChanged();},{rootMargin:'150px'}).observe(scene);
document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();else schedule();});
window.addEventListener('pagehide',halt);
reduced.addEventListener('change',event=>{if(event.matches){playing=false;halt();report();}});
try{
  const response=await fetch(prefix+'reference.json');if(!response.ok)throw Error('Motion data unavailable');data=await response.json();
  atlas=await load(prefix+'reference-atlas.png');const background=await load('meadow-media/walk-plate-v01.webp');scene.style.backgroundImage=`url("${background.src}")`;
  ready=true;document.querySelector('#controls').inert=false;draw();report();
  window.actorProduction=Object.freeze({snapshot:()=>({ready,frame,playing,paints,scheduled:!!raf,artApproved:false,resources:3})});
}catch(error){status.textContent='动作参照加载失败，请刷新重试。';console.error(error);}
