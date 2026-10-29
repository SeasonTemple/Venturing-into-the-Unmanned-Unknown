import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {LaneMotion} from '../prototypes/visual-direction/actor-lane-state.mjs';

const data=JSON.parse(await readFile('prototypes/visual-direction/actor-lane-media/lane.json','utf8'));
function finish(state) {for(let i=0;i<1000&&state.active;i++)state.tick(.05);assert(!state.active);}
const state=new LaneMotion(data);state.moveTo(-122);finish(state);assert.equal(state.x,-122);
state.moveTo(-208);finish(state);assert.equal(state.x,-208);
state.moveTo(-380);finish(state);assert.equal(state.x,-380);
for(let phase=0;phase<32;phase++) {
  const candidate=new LaneMotion(data);candidate.moveTo(-380);
  while(candidate.clip!=='stride'||candidate.frame!==phase)candidate.tick(1/16);
  candidate.stop();finish(candidate);
  assert(['stop-L','stop-R'].includes(candidate.clip));
  assert(candidate.x>=-380);
  candidate.moveTo(-380);finish(candidate);assert.equal(candidate.x,-380);
}
// Large elapsed times are clamped and cannot skip a whole journey on tab return.
const throttled=new LaneMotion(data);throttled.moveTo(-380);throttled.tick(600);assert(throttled.frame<=1);

const base=resolve('.lab/actor-lane-browser');await mkdir(base,{recursive:true});
const profile=await mkdtemp(resolve(base,'profile-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;const errors=[];
try {
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert(port);const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let sequence=0;const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
    if(!message.id)return;const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);
    message.error?p.reject(Error(message.error.message)):p.resolve(message.result);
  };
  send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>reject(Error(method)),15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;
  };
  const wait=async(expression,limit=6000)=>{for(let t=0;t<limit;t+=100){if(await evaluate(expression))return;await sleep(100);}throw Error('Timeout: '+expression);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const snap=()=>evaluate('actorLane.snapshot()');
  const screenshot=async name=>{
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(resolve(base,name+'.png'),Buffer.from(shot.data,'base64'));
  };
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/actor-lane.html?revision=lane01'});
  await wait('window.actorLane?.snapshot().ready');
  const idle=await snap();await sleep(400);assert.equal((await snap()).paints,idle.paints);
  await screenshot('standing');
  await click('[data-target="-208"]');await wait('actorLane.snapshot().mode==="stride"');await sleep(400);
  const moving=await snap();assert(moving.x<0);await screenshot('walking');
  await click('#pause');const paused=await snap();await sleep(400);
  assert.deepEqual(await snap(),paused);
  await evaluate('document.querySelector("#scene").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await wait('!actorLane.snapshot().paused');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await sleep(150);assert.equal((await snap()).target,-380);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
  await wait('!actorLane.snapshot().active',7000);const stopped=await snap();assert(stopped.x>-380);
  await click('[data-target="-380"]');await wait('actorLane.snapshot().mode==="stride"',7000);
  await click('#stop');await wait('!actorLane.snapshot().active',7000);
  await click('#reduced');await click('[data-target="-380"]');
  assert.equal((await snap()).x,-380);assert(!(await snap()).active);
  await click('#reset');assert.equal((await snap()).x,0);
  await click('#reduced');
  // Exercise actual pointer coordinates on the paved strip, not only buttons.
  const road=await evaluate(`(()=>{const b=document.querySelector('#scene').getBoundingClientRect();return {x:b.left+b.width*1400/1920,y:b.top+b.height*890/1080};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...road});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...road});
  await wait('actorLane.snapshot().active');
  // Force the heavy region out of the render margin, then verify it stops work.
  await evaluate('document.body.style.paddingBottom="4000px";window.scrollTo(0,document.body.scrollHeight)');
  await wait('actorLane.snapshot().skipped');const offscreen=await snap();await sleep(400);
  assert.deepEqual(await snap(),offscreen);
  await evaluate('window.scrollTo(0,0);document.body.style.paddingBottom=""');
  await wait('!actorLane.snapshot().skipped');
  await click('#reset');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(200);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await screenshot('mobile');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:'reduce'}]});
  await screenshot('dark');
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result={allPhaseStopAndResume:true,routeTargets:true,largeDeltaClamped:true,idleStopsDrawing:true,
    manualTakeover:true,keyReleaseStops:true,pauseStable:true,spaceResumes:true,stopThenRestart:true,
    reducedMotionStatic:true,roadPointer:true,offscreenStopsDrawing:true,mobileNoOverflow:true,decodedResources:(await snap()).resources,errors};
  await writeFile(resolve(base,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {
  if(send){try{await send('Browser.close');}catch{}}socket?.close();await sleep(300);
  try{execFileSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}catch{}
  assert(profile.startsWith(base+sep));for(let i=0;i<15;i++){try{await rm(profile,{recursive:true,force:true});break;}catch{await sleep(150);}}
}
