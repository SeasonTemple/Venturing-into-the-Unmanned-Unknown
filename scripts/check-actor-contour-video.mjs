// Exercise the actual encoded media in an owned browser's native video player.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

const video=resolve(process.argv[2]||'prototypes/visual-direction/actor-contour-motion/loaded-step.mp4');
const base=resolve('.lab/actor-contour-motion/browser');await mkdir(base,{recursive:true});
const profile=await mkdtemp(resolve(base,'profile-'));
const bytes=await readFile(video);
const server=createServer((req,res)=>{
  const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
  const start=range?Number(range[1]):0;
  const end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
  res.writeHead(range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes',
    'Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})});
  res.end(bytes.subarray(start,end+1));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions',
  '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0',
  '--user-data-dir='+profile,'about:blank'
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket,send;
try{
  let port;
  for(let i=0;i<100;i++){try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert(port,'Chrome startup');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let sequence=0;const pending=new Map();
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);if(!message.id)return;
    const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);
    message.error?p.reject(Error(message.error.message)):p.resolve(message.result);
  };
  send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(method));},15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor=async expression=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}
    throw Error('Timeout: '+expression);
  };
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.argv[3]||`http://127.0.0.1:${server.address().port}/loaded-step.mp4`});
  await waitFor(`document.querySelector('video')?.readyState>=2`);
  await evaluate(`globalThis.v=document.querySelector('video');v.pause();v.currentTime=0;v.loop=false;`);
  await waitFor('!v.seeking');
  assert.equal(await evaluate('v.videoWidth'),1600);assert.equal(await evaluate('v.videoHeight'),1600);
  await evaluate('v.play()');await sleep(700);
  assert(await evaluate('v.currentTime>.3 && !v.paused'));
  await evaluate('v.pause()');const paused=await evaluate('v.currentTime');await sleep(250);
  assert(Math.abs(await evaluate('v.currentTime')-paused)<.02);
  await evaluate('v.currentTime=1;v.playbackRate=.5');await waitFor('!v.seeking');
  await evaluate('v.play()');const slowStart=await evaluate('v.currentTime');await sleep(600);
  const slowDelta=await evaluate('v.currentTime')-slowStart;
  assert(slowDelta>.15 && slowDelta<.5,'half-speed playback');
  await evaluate('v.pause();v.playbackRate=1;v.currentTime=v.duration-.2');await waitFor('!v.seeking');
  await evaluate('v.play()');await waitFor('v.ended');
  const result=await evaluate(`({duration:v.duration,width:v.videoWidth,height:v.videoHeight,ended:v.ended,
    nativeControls:v.controls,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames,
    droppedFrames:v.getVideoPlaybackQuality().droppedVideoFrames})`);
  assert(result.nativeControls && result.decodedFrames>0);
  await evaluate('v.currentTime=1.75');await waitFor('!v.seeking');
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(resolve(base,'native-player.png'),Buffer.from(shot.data,'base64'));
  await writeFile(resolve(base,'checks.json'),JSON.stringify({...result,playPause:true,seek:true,halfSpeed:true},null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{
  if(send){try{await send('Browser.close');}catch{}}
  socket?.close();server.close();await sleep(300);
  try{execFileSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}catch{}
  assert(profile.startsWith(base+sep));
  for(let i=0;i<15;i++){try{await rm(profile,{recursive:true,force:true});break;}catch{await sleep(150);}}
}
