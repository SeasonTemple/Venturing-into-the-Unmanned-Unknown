import{route,target}from'./meadow-route.mjs';
const lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths[i-1]+Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]));
const total=lengths.at(-1),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export async function createMeadowWalk({stage,art,surface,setArtwork,mediaBase=new URL('./meadow-media/',import.meta.url)}){
  const media=name=>new URL(name,mediaBase).href;
  const enter=document.querySelector('#enter-field'),panel=document.querySelector('#field-controls'),primary=document.querySelector('#field-action'),exit=document.querySelector('#field-exit'),status=document.querySelector('#field-status'),progress=document.querySelector('#field-progress'),note=document.querySelector('#field-note'),pin=document.querySelector('#field-pin');
  const enterContent=enter.innerHTML;
  const canvas=document.createElement('canvas');canvas.className='field-actor';canvas.width=1440;canvas.height=810;canvas.setAttribute('aria-hidden','true');surface.append(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let assets,loading,active=false,state='poster',distance=0,strideDistance=0,raf=0,last=0,lastDraw=0,frames=0,destroyed=false,inView=true,globalPaused=false,focusedBefore;
  const poster=art.src,originalAlt=art.alt;
  const load=()=>loading??=(async()=>{
    const names=['walk-plate-v01.webp','engineer-actions-v03.png','engineer-idle-v01.png','walk-foreground-v01.png'];
    const imgs=await Promise.all(names.map(async name=>{const img=new Image();img.src=media(name);await img.decode();return img;}));
    const meta=await(await fetch(media('engineer-actions-v03.json'))).json();
    return assets={plate:imgs[0],atlas:imgs[1],idle:imgs[2],foreground:imgs[3],meta};
  })().catch(error=>{loading=undefined;throw error;});
  function location(d=distance){let i=1;while(i<lengths.length-1&&d>lengths[i])i++;const f=clamp((d-lengths[i-1])/(lengths[i]-lengths[i-1]),0,1),a=route[i-1],b=route[i];const x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;return{x,y,scale:clamp((y-590)/268,.57,1.3)};}
  function draw(){
    if(!assets||destroyed)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);if(!active)return;
    const p=location(),m=assets.meta;ctx.save();ctx.scale(canvas.width/1920,canvas.height/1080);ctx.imageSmoothingEnabled=false;
    // A restrained contact shadow stays under the feet, behind the foreground.
    ctx.fillStyle='#1e302a55';ctx.beginPath();ctx.ellipse(p.x+3*p.scale,p.y+1,18*p.scale,3*p.scale,0,0,Math.PI*2);ctx.fill();
    const frame=state==='observed'?m.check:state==='walking'?Math.floor(strideDistance/m.stride*m.walkFrames)%m.walkFrames:m.idle;
    if(distance===0&&state==='station')ctx.drawImage(assets.idle,p.x-44,p.y-182,100,195);
    else ctx.drawImage(assets.atlas,frame*m.frame[0],0,...m.frame,p.x-m.anchor[0]*p.scale,p.y-m.anchor[1]*p.scale,m.frame[0]*p.scale,m.frame[1]*p.scale);
    // Repainting the original cart gives actual lower-body occlusion, not a fade.
    ctx.drawImage(assets.foreground,0,0,1920,1080);ctx.restore();frames++;
    pin.style.left=(target[0]/1920*100)+'%';pin.style.top=(target[1]/1080*100)+'%';
  }
  const runnable=()=>active&&state==='walking'&&!globalPaused&&!reduce.matches&&inView&&document.visibilityState==='visible'&&!document.body.hasAttribute('data-search-modal-open')&&!destroyed;
  function tick(now){
    raf=0;if(!runnable())return;
    if(now-lastDraw>=1000/24){
      const dt=Math.min(.1,(now-last)/1000),p=location();last=now;lastDraw=now;
      const speed=62*p.scale*Math.min(1,.32+(total-distance)/55),step=Math.min(total-distance,speed*dt);
      distance+=step;strideDistance+=step/p.scale;
      if(distance>=total-.01){distance=total;state='arrived';update();}
      progress.value=distance/total;draw();
    }
    if(runnable())raf=requestAnimationFrame(tick);
  }
  function sync(){if(raf)cancelAnimationFrame(raf);raf=0;if(runnable()){last=performance.now();lastDraw=0;raf=requestAnimationFrame(tick);}}
  function update(){
    panel.hidden=!active;note.hidden=state!=='observed';pin.hidden=!['arrived','observed'].includes(state);
    stage.dataset.field=state;stage.classList.toggle('exploring',active);enter.disabled=state==='loading';
    primary.textContent=state==='station'?(reduce.matches?'到达测点':'前往测点'):state==='walking'?'停步':state==='paused'?'继续前行':state==='arrived'?'查阅记录器':'重走这段';
    primary.disabled=globalPaused&&state==='walking';
    status.textContent=state==='station'?'檐下工位 · 沿维护路去复核临水测点':state==='walking'?(distance<370?'沿维护路前行':'前往临水测点'):state==='paused'?'停在路边 · 可以继续前行':state==='arrived'?'临水测点 · 停步，核对旧记录':state==='observed'?'测点 01 · 已记下位置偏差':'';
    if(active&&globalPaused&&state==='walking')status.textContent='动态已暂停 · 可从顶部继续';
    progress.value=distance/total;
  }
  async function open(){
    if(active||destroyed||state==='loading')return;
    focusedBefore=enter;state='loading';enter.textContent='准备出发…';document.querySelector('#field-load-error').hidden=true;update();
    try{
      await load();if(destroyed)return;
      distance=0;strideDistance=0;active=true;state='station';
      // Both fallback and WebGL receive the same clean plate before actor reveal.
      art.src=assets.plate.src;art.alt='同一片原野中的维护路，工程人员可以从檐下步行前往临水测点。';setArtwork(assets.plate);
      stage.classList.remove('art-only');document.querySelector('#art-only').setAttribute('aria-pressed','false');document.querySelector('#art-only').textContent='只看画面';
      update();draw();primary.focus({preventScroll:true});
    }catch(error){state='poster';update();document.querySelector('#field-load-error').hidden=false;console.warn('Field assets unavailable:',error.message);}
    finally{enter.innerHTML=enterContent;}
  }
  function close(){
    if(!active)return;active=false;state='poster';sync();art.src=poster;art.alt=originalAlt;
    if(assets){const img=new Image();img.src=poster;if(img.complete)setArtwork(img);else img.decode().then(()=>{if(!active&&!destroyed)setArtwork(img);}).catch(()=>{});}
    update();draw();focusedBefore?.focus({preventScroll:true});
  }
  function action(){
    if(!active)return;
    if(state==='station'||state==='paused'){
      if(reduce.matches){distance=total;state='arrived';}else state='walking';
    }else if(state==='walking')state='paused';
    else if(state==='arrived')state='observed';
    else if(state==='observed'){distance=0;strideDistance=0;state='station';}
    update();draw();sync();
  }
  const onKey=e=>{if(e.key==='Escape'&&active&&!document.querySelector('dialog[open]')){e.preventDefault();close();}};
  const onVisibility=()=>sync();
  const onReduced=()=>{if(reduce.matches&&state==='walking')state='paused';update();draw();sync();};
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.02});observer.observe(surface);
  const sizeObserver=new ResizeObserver(()=>{const width=clamp(Math.round(surface.clientWidth/16)*16,480,1440);if(canvas.width!==width){canvas.width=width;canvas.height=Math.round(width*9/16);draw();}});sizeObserver.observe(surface);
  const searchObserver=new MutationObserver(sync);searchObserver.observe(document.body,{attributes:true,attributeFilter:['data-search-modal-open']});
  enter.addEventListener('click',open);primary.addEventListener('click',action);exit.addEventListener('click',close);
  document.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVisibility);reduce.addEventListener('change',onReduced);
  update();
  enter.hidden=false;
  return{
    open,close,action,
    pause(value){globalPaused=value;update();sync();},
    stats:()=>({state,active,distance,total,progress:distance/total,position:location(),frame:assets&&state==='walking'?Math.floor(strideDistance/assets.meta.stride*12)%12:state==='observed'?13:12,frames,loopScheduled:!!raf,inView,globalPaused,reduced:reduce.matches,canvas:[canvas.width,canvas.height],loaded:!!assets}),
    // Deterministic paused route samples for QA, never used by the product flow.
    sample(value,pose='walking'){if(!active)throw Error('Enter before sampling');distance=clamp(value,0,1)*total;strideDistance=distance/location().scale;state=pose;globalPaused=true;update();sync();draw();},
    destroy(){destroyed=true;sync();observer.disconnect();sizeObserver.disconnect();searchObserver.disconnect();enter.removeEventListener('click',open);primary.removeEventListener('click',action);exit.removeEventListener('click',close);document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibility);reduce.removeEventListener('change',onReduced);canvas.remove();assets=undefined;}
  };
}
