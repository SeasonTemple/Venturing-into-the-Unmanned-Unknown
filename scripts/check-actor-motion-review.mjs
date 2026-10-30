// Own one headless browser; exercise native inputs and the frame player's lifecycle.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

const hip=process.argv.includes('--hip');
const gait=process.argv.includes('--gait')||hip;
const base=resolve(hip?'.lab/actor-hip-browser':gait?'.lab/actor-gait-browser':'.lab/actor-motion-browser');await mkdir(base,{recursive:true});
const profile=await mkdtemp(resolve(base,'profile-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket,send;const events=[];
try{
  let port;
  for(let i=0;i<150;i++){try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert(port,'Chrome startup');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let sequence=0;const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}
    else if(message.method==='Runtime.exceptionThrown')events.push(message.params.exceptionDetails);
  };
  send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor=async expression=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}
    throw Error('Condition timed out: '+expression);
  };
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const seek=async frame=>{
    await evaluate(`document.querySelector('#frame').value=${frame};document.querySelector('#frame').dispatchEvent(new Event('input',{bubbles:true}))`);
  };
  const state=()=>evaluate(`({frame:Number(document.querySelector('#player').dataset.frame),playing:document.querySelector('#player').dataset.playing,source:document.querySelector('#paint-source').hidden,status:document.querySelector('#load-status').textContent})`);
  const key=async(key,code,number)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:number});};
  const capture=async name=>{
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(resolve(base,name+'.png'),Buffer.from(shot.data,'base64'));
  };
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1120,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/actor-motion-review.html?'+(hip?'study=hip06&revision=hip06':gait?'study=gait05&revision=gait05':'revision=cloth04')});
  await waitFor(`document.querySelector('#player')?.dataset.ready==='true'`);
  assert.equal((await state()).frame,1);assert.equal((await state()).playing,'false');
  await sleep(300);assert.equal((await state()).frame,1);
  await click('[data-frame="23"]');assert.equal((await state()).frame,23);assert.equal((await state()).source,false);
  const after=await evaluate(`document.querySelector('#actor').toDataURL()`);
  await click('[name=version][value=before]');
  assert.notEqual(await evaluate(`document.querySelector('#actor').toDataURL()`),after);
  await click('[name=version][value=after]');assert.equal(await evaluate(`document.querySelector('#actor').toDataURL()`),after);
  await evaluate(`document.querySelector('#frame').focus()`);
  await key('ArrowRight','ArrowRight',39);assert.equal((await state()).frame,24);
  await key('Home','Home',36);assert.equal((await state()).frame,1);
  await key('End','End',35);assert.equal((await state()).frame,49);assert.equal((await state()).source,!gait);
  if(gait){
    assert.equal(await evaluate('document.title'),hip?'06 未通过 · 历史动作试验':'交替承重与停步 · 逐帧检查');
    if (hip) assert(await evaluate(`document.querySelector('#study-title').textContent.includes('已撤回')`));
    assert(await evaluate(`document.querySelector('#paint-source').href.endsWith('/actor-${hip?'v06':'v05'}-editable.blend')`));
    assert(await evaluate(`document.querySelector('#before-caption span').textContent.includes('1×')`));
  }
  await seek(1);await click('#play');await sleep(550);
  assert((await state()).frame>=5 && (await state()).frame<=10);
  await seek(11);assert.equal((await state()).playing,'false');await sleep(200);assert.equal((await state()).frame,11);
  await seek(48);await click('#play');await waitFor(`document.querySelector('#player').dataset.playing==='false'`);
  assert.equal((await state()).frame,49);
  await click('#loop');await click('#play');await sleep(150);assert.equal((await state()).playing,'true');
  await seek(48);await click('#play');await sleep(350);assert((await state()).frame<10);
  await click('#play');await click('#loop');
  await evaluate(`document.querySelector('#speed').value='0.5';document.querySelector('#speed').dispatchEvent(new Event('change'))`);
  await seek(1);await click('#play');await sleep(550);assert((await state()).frame>=3 && (await state()).frame<=6);
  // Synthetic visibility event checks the handler; the offscreen test below uses real rendering visibility.
  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))`);
  assert.equal((await state()).playing,'false');
  await evaluate(`delete document.hidden`);
  await click('#play');
  await evaluate(`const spacer=document.createElement('div');spacer.id='test-spacer';spacer.style.height='4000px';document.body.append(spacer);scrollTo(0,document.body.scrollHeight)`);
  await waitFor(`document.querySelector('#player').dataset.playing==='false'`);
  await evaluate(`document.querySelector('#test-spacer').remove();scrollTo(0,0)`);
  await seek(23);await capture('desktop');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal((await state()).playing,'false');
  await send('Page.reload');await waitFor(`document.querySelector('#player')?.dataset.ready==='true'`);
  assert.equal((await state()).playing,'false');assert.equal((await state()).frame,1);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(100);
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  assert(await evaluate(`document.querySelector('#actor').getBoundingClientRect().width===300 && document.querySelector('#knee-before').getBoundingClientRect().width===160`));
  await seek(23);await capture('mobile-top');
  await evaluate(`document.querySelector('#transport').scrollIntoView({block:'end'})`);await sleep(100);await capture('mobile-controls');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(100);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await send('Emulation.setDeviceMetricsOverride',{width:1120,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  await evaluate('scrollTo(0,0)');await sleep(100);await capture('dark');
  assert.equal(events.length,0,JSON.stringify(events));
  const result={study:hip?'hip06':gait?'gait05':'cloth04',defaultStatic:true,nativeRangeArrowHomeEnd:true,bodyBeforeAfterSwitch:true,
    seekPauses:true,playback12fpsAndHalfSpeed:true,oneShotEndAndOptInLoop:true,
    simulatedDocumentHiddenPauses:true,actualOffscreenPauses:true,reducedMotionReloadStatic:true,
    mobile320And390NoHorizontalOverflow:true,nativeAndIntegerZoomDimensionsPreserved:true,runtimeExceptions:events.length,
    screenshots:['desktop.png','mobile-top.png','mobile-controls.png','dark.png']};
  await writeFile(resolve(base,'checks.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{
  if(send){try{await send('Browser.close');}catch{}}
  socket?.close();
  await sleep(300);
  try{execFileSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}catch{}
  assert(profile.startsWith(base+sep));
  for(let i=0;i<15;i++){try{await rm(profile,{recursive:true,force:true});break;}catch{await sleep(150);}}
}
