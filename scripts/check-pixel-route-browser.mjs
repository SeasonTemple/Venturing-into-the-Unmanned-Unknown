import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportFolder = resolve(root, '.lab/pixel-route-browser');
const stableReport = resolve(root, 'prototypes/visual-direction/pixel-route-v01/behavior-checks.json');
await mkdir(reportFolder, { recursive: true });
const profile = await mkdtemp(resolve(reportFolder, 'browser-check-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1440,960', 'about:blank'
], { windowsHide: true, stdio: 'ignore' });

const report = { pass: false, checks: [], metrics: {}, consoleErrors: [] };
const check = (name, pass, detail) => report.checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
let socket;
try {
  let port;
  for (let i = 0; i < 150; i++) {
    try { port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await pause(80); }
  }
  if (!port) throw Error('Owned Chrome failed to start');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.id) {
      const entry = pending.get(value.id);
      pending.delete(value.id);
      value.error ? entry?.reject(Error(value.error.message)) : entry?.resolve(value.result);
    }
    if (value.method === 'Runtime.exceptionThrown') report.consoleErrors.push(value.params.exceptionDetails.text);
    if (value.method === 'Runtime.consoleAPICalled' && value.params.type === 'error') report.consoleErrors.push(value.params.args.map(arg => arg.value || arg.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 160; i++) { if (await evaluate(expression)) return; await pause(75); }
    throw Error('Timed out: ' + expression);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4395/pixel-route-v01.html' });
  await until('!!window.pixelRoute');
  check('route page exposes a ready state snapshot', await evaluate('window.pixelRoute.snapshot().ready === true'));
  check('initial state starts left-facing and stopped', await evaluate('window.pixelRoute.snapshot().facing === "left" && window.pixelRoute.snapshot().mode === "idle"'));
  check('scene and four stop controls render', await evaluate('document.querySelectorAll("[data-stop]").length === 4 && document.querySelector("#scene")'));
  const initialActor = await evaluate('(()=>{const e=document.querySelector("#actor"),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {w:r.width,h:r.height,left:e.style.left,rendering:s.imageRendering,natural:e.naturalWidth}})()');
  check('scene places a readable pixel sprite with integer positioning', initialActor.w > 150 && initialActor.h > 220 && Number.isInteger(Number.parseFloat(initialActor.left)) && initialActor.rendering.includes('pixelated') && initialActor.natural === 128, initialActor);

  await evaluate('document.querySelector("[data-target=marker]").click()');
  const autoStart = await evaluate('window.pixelRoute.snapshot()');
  check('clicking a forward stop starts auto movement', autoStart.mode === 'auto' && autoStart.target < autoStart.x, autoStart);
  await until(`window.pixelRoute.snapshot().frameIndex !== ${autoStart.frameIndex}`);
  const autoProgress = await evaluate('window.pixelRoute.snapshot()');
  check('auto movement advances position and frame phase', autoProgress.x < autoStart.x && autoProgress.frameIndex !== autoStart.frameIndex, autoProgress);
  const movingActor = await evaluate('(()=>{const e=document.querySelector("#actor"),r=e.getBoundingClientRect();return {src:e.src,frame:window.pixelRoute.snapshot().frameIndex,left:e.style.left,width:r.width}})()');
  check('scene frame changes keep the raster at an integer world position', movingActor.frame === autoProgress.frameIndex && movingActor.src.includes(`frame-0${autoProgress.frameIndex}.png`) && Number.isInteger(Number.parseFloat(movingActor.left)), movingActor);

  await evaluate('document.querySelector("#scene").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  const takeover = await evaluate('window.pixelRoute.snapshot()');
  check('manual left input takes over auto movement', takeover.mode === 'manual' && takeover.manualHeld === true, takeover);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await until('window.pixelRoute.snapshot().mode === "idle"');
  const stopped = await evaluate('window.pixelRoute.snapshot()');
  check('releasing left requests a stop without reversing', stopped.mode === 'idle' && stopped.x <= takeover.x, stopped);

  await evaluate('document.querySelector("#turn").click()');
  await until('window.pixelRoute.snapshot().facing === "front"');
  const front = await evaluate('window.pixelRoute.snapshot()');
  check('turn uses the complete front/side keyframe sequence', front.mode === 'idle' && front.facing === 'front', front);
  await evaluate('document.querySelector("#scene").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await until('window.pixelRoute.snapshot().facing === "left" && window.pixelRoute.snapshot().mode === "idle"');
  const side = await evaluate('window.pixelRoute.snapshot()');
  check('left input turns back to the authored side view', side.mode === 'idle' && side.facing === 'left', side);

  await evaluate('document.querySelector("#pause").click()');
  const paused = await evaluate('window.pixelRoute.snapshot()');
  await pause(220);
  const pausedAgain = await evaluate('window.pixelRoute.snapshot()');
  check('pause freezes position and frame state', paused.paused === true && pausedAgain.x === paused.x && pausedAgain.frameIndex === paused.frameIndex, { paused, pausedAgain });
  await evaluate('document.querySelector("#pause").click()');
  await evaluate('document.querySelector("#reduced").click()');
  const reduced = await evaluate('window.pixelRoute.snapshot()');
  check('reduced motion switches to static frame mode', reduced.reduced === true && reduced.frameIndex === 0 && reduced.mode === 'idle', reduced);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await pause(160);
  check('narrow route preview has no horizontal overflow', await evaluate('document.documentElement.scrollWidth <= 390 && document.body.scrollWidth <= 390'));
  report.metrics.final = await evaluate('window.pixelRoute.snapshot()');
  check('route page reports no runtime console errors', report.consoleErrors.length === 0, report.consoleErrors);
} catch (error) {
  report.fatal = error.stack;
} finally {
  socket?.close();
  try {
    const processes = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process -Filter "name = \'chrome.exe\'" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'], { encoding: 'utf8', windowsHide: true }));
    const entries = Array.isArray(processes) ? processes : [processes];
    execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    report.metrics.recordedBrowserProcesses = entries.length;
  } catch (error) {
    report.metrics.cleanupError = String(error);
  }
  for (let i = 0; i < 15; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await pause(150); } }
  if (!profile.startsWith(reportFolder + sep) || !basename(profile).startsWith('browser-check-')) throw Error('Unsafe profile cleanup path');
  report.pass = !report.fatal && report.checks.every(entry => entry.pass);
  await writeFile(resolve(reportFolder, 'browser-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(stableReport, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.pass) process.exitCode = 1;
}
