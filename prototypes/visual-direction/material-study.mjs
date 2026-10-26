import { createRelief } from './relief-material.mjs';
import { createMembrane } from './membrane-material.mjs';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const motion=document.getElementById('motion');
let playing=!reduced.matches,elapsed=0,previous=0,lastDraw=0,raf=0,disposed=false;
let relief,membrane,reliefVisible=true,membraneVisible=false,membraneAttempted=false;
const initMs={};
const reliefStage=document.querySelector('.relief-stage'),membraneSection=document.getElementById('membrane');
const errors=[];
window.addEventListener('error',event=>errors.push(event.message));
function updateMotion(){motion.setAttribute('aria-pressed',String(playing));motion.textContent=playing?'暂停动态':'播放动态';if(!membraneAttempted||membrane)document.getElementById('surface-status').textContent=playing?'表面稳定 · 底图流动':'表面与底图已暂停';}
function render(){relief?.render(elapsed);membrane?.render(elapsed);}
function canAnimate(){return !disposed&&playing&&!document.hidden&&((reliefVisible&&relief)||(membraneVisible&&membrane));}
function schedule(){if(!canAnimate()){cancelAnimationFrame(raf);raf=0;previous=0;return;}if(!raf){previous=0;raf=requestAnimationFrame(frame);}}
function frame(now){raf=0;if(!canAnimate()){previous=0;return;}if(previous)elapsed+=Math.min((now-previous)/1000,.1);previous=now;if(now-lastDraw>=80){lastDraw=now;if(reliefVisible)relief?.render(elapsed);if(membraneVisible)membrane?.render(elapsed);}raf=requestAnimationFrame(frame);}
function ensureMembrane(){if(!membraneAttempted&&!disposed){membraneAttempted=true;const start=performance.now();try{membrane=createMembrane(document.getElementById('membrane-canvas'));}catch(error){errors.push(error.message);document.getElementById('surface-status').textContent='当前设备无法显示透射样片';}initMs.membrane=performance.now()-start;}return membrane;}
try{const start=performance.now();relief=createRelief(document.getElementById('relief-canvas'));initMs.relief=performance.now()-start;}catch(error){errors.push(error.message);document.querySelector('.fallback').hidden=false;}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===reliefStage){reliefVisible=entry.isIntersecting;if(reliefVisible)relief?.render(elapsed);}else{membraneVisible=entry.isIntersecting;if(membraneVisible)ensureMembrane()?.render(elapsed);}}schedule();},{rootMargin:'32px'});
observer.observe(reliefStage);observer.observe(membraneSection);
const resize=new ResizeObserver(entries=>{for(const entry of entries){if(entry.target===reliefStage){relief?.resize();if(reliefVisible)relief?.render(elapsed);}else if(membrane){membrane.resize();if(membraneVisible)membrane.render(elapsed);}}});resize.observe(reliefStage);resize.observe(membraneSection);
document.getElementById('light-angle').addEventListener('input',event=>{const angle=Number(event.target.value);relief?.setLight(angle);document.getElementById('light-value').value=angle+'°';relief?.render(elapsed);});
function toggle(id,action,labels){const button=document.getElementById(id);button.addEventListener('click',()=>{const active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));button.textContent=labels[+active];action(active);});}
toggle('grid',value=>{relief?.setGrid(value);relief?.render(elapsed);},['测绘网格：关','测绘网格：开']);
toggle('local-light',value=>{relief?.setLocal(value);relief?.render(elapsed);},['测绘光：关','测绘光：开']);
toggle('surface',value=>{ensureMembrane()?.setSurface(value);membrane?.render(elapsed);},['描图膜：揭开','描图膜：覆盖']);
document.getElementById('layer-gap').addEventListener('input',event=>{const gap=Number(event.target.value);ensureMembrane()?.setGap(gap);document.getElementById('gap-value').value=gap<.3?'近':gap>.72?'远':'中';membrane?.render(elapsed);});
motion.addEventListener('click',()=>{playing=!playing;updateMotion();schedule();});
reduced.addEventListener('change',()=>{playing=!reduced.matches;updateMotion();schedule();});
document.addEventListener('visibilitychange',schedule);
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);raf=0;previous=0;observer.disconnect();resize.disconnect();relief?.dispose();membrane?.dispose();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
updateMotion();relief?.render(elapsed);schedule();
window.__materialStudy={get ready(){return !!relief;},state:()=>({playing,elapsed,errors,disposed,loopScheduled:!!raf,visible:{relief:reliefVisible,membrane:membraneVisible},initMs:{...initMs},relief:relief?.state(),membrane:membrane?.state()||null}),render,seek:t=>{if(Number.isFinite(t)&&t>=0){elapsed=t;render();}},probe:()=>({relief:relief?.probe(),membrane:ensureMembrane()?.probe(elapsed)}),probeUnknown:()=>{relief?.render(elapsed);return relief?.probeUnknown();},dispose};
