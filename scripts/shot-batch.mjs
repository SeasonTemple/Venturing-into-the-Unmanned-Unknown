import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

// Invoked through scripts/shot.mjs --batch <JSON manifest> only.
export async function captureBatch(manifest) {
  const shots = JSON.parse(await readFile(resolve(manifest), 'utf8'));
  if (!Array.isArray(shots) || !shots.length || shots.length > 6) throw Error('Batch must contain 1–6 captures');
  for (const shot of shots) if (!/^https?:/.test(shot.url) || !shot.out) throw Error('Each capture needs url and out');
  const folder = resolve('.lab/shot-batch'); await mkdir(folder, {recursive:true});
  const profile = await mkdtemp(resolve(folder,'profile-'));
  const pause = ms => new Promise(r=>setTimeout(r,ms));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--hide-scrollbars','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-port=0','--user-data-dir='+profile,...(process.env.SHOT_CHROME_FLAGS||'').split(/\s+/).filter(Boolean),'about:blank'], {windowsHide:true,stdio:'ignore'});
  let socket; const pids=[chrome.pid];
  try {
    let port;
    for (let i=0;i<300;i++) { try { port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break; } catch { await pause(100); } }
    if (!port) throw Error('Chrome did not start');
    const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
    let seq=0; const pending=new Map();
    socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
    await send('Page.enable'); await send('Runtime.enable');
    for (const shot of shots) {
      await send('Emulation.setDeviceMetricsOverride',{width:shot.width||1440,height:shot.height||900,deviceScaleFactor:1,mobile:!!shot.mobile});
      await send('Emulation.setEmulatedMedia',{features:typeof shot.reducedMotion==='boolean'?[{name:'prefers-reduced-motion',value:shot.reducedMotion?'reduce':'no-preference'}]:[]});
      await send('Page.navigate',{url:shot.url});
      let ready=false;
      for(let i=0;i<150;i++){try{if(await evaluate(shot.ready||'document.readyState === "complete"')){ready=true;break;}}catch{}await pause(100);}
      if(!ready)throw Error('Page readiness timeout: '+shot.url);
      if(shot.prepare)await evaluate(shot.prepare);
      await pause(shot.wait||600);
      const captured=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
      const out=resolve(shot.out);await mkdir(dirname(out),{recursive:true});await writeFile(out,Buffer.from(captured.data,'base64'));
      process.stdout.write('ok '+out+'\n');
    }
  } finally {
    socket?.close();
    try {const rows=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));for(let i=0;i<10;i++)for(const row of [rows].flat())if(pids.includes(row.ParentProcessId)&&!pids.includes(row.ProcessId))pids.push(row.ProcessId);}catch{}
    try{execFileSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}
    await pause(300);
    const remaining=pids.filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
    if(!profile.startsWith(folder+sep))throw Error('Unsafe profile cleanup');
    for(let i=0;i<15;i++){try{await rm(profile,{recursive:true,force:true});break;}catch{await pause(150);}}
    process.stdout.write(JSON.stringify({browserPid:chrome.pid,recordedProcesses:pids.length,remaining})+'\n');
    if(remaining.length)throw Error('Owned browser processes remain');
  }
}
