import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportFolder = resolve(root, '.lab/pixel-route-browser');
const stableReport = resolve(root, 'prototypes/visual-direction/pixel-route-v01/soak-checks.json');
await mkdir(reportFolder, { recursive: true });
const profile = await mkdtemp(resolve(reportFolder, 'soak-check-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1440,960', 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
const report = { pass: false, durationTargetSeconds: 600, cycles: 0, samples: [], consoleErrors: [] };
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
      const entry = pending.get(value.id); pending.delete(value.id);
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
    for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw Error('Timed out: ' + expression);
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4395/pixel-route-v01.html' });
  await until('!!window.pixelRoute');
  const started = Date.now();
  const target = 'shoulder';
  while (Date.now() - started < 600000) {
    await evaluate('document.querySelector("#reset").click()');
    await evaluate(`document.querySelector('[data-target="${target}"]').click()`);
    await until('window.pixelRoute.snapshot().mode === "idle"');
    report.cycles += 1;
    if (report.cycles % 10 === 0) {
      const snapshot = await evaluate('(()=>{const s=window.pixelRoute.snapshot();return {x:s.x,frameIndex:s.frameIndex,resources:s.resources,renders:s.renders,heap:performance.memory?.usedJSHeapSize ?? null}})()');
      report.samples.push({ cycle: report.cycles, elapsedSeconds: Math.round((Date.now() - started) / 1000), ...snapshot });
      if (snapshot.resources !== 14 || snapshot.frameIndex < 0 || snapshot.frameIndex > 7) throw Error('resource or frame invariant failed');
    }
  }
  report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
  const firstHeap = report.samples.find(sample => sample.heap !== null)?.heap;
  const lastHeap = [...report.samples].reverse().find(sample => sample.heap !== null)?.heap;
  report.heapDelta = firstHeap !== undefined && lastHeap !== undefined ? lastHeap - firstHeap : null;
  report.pass = report.elapsedSeconds >= 600 && report.consoleErrors.length === 0 && report.samples.every(sample => sample.resources === 14 && sample.frameIndex >= 0 && sample.frameIndex <= 7);
} catch (error) {
  report.fatal = error.stack;
} finally {
  socket?.close();
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
  for (let i = 0; i < 15; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await pause(150); } }
  if (!profile.startsWith(reportFolder + sep) || !basename(profile).startsWith('soak-check-')) throw Error('Unsafe profile cleanup path');
  await writeFile(stableReport, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.pass) process.exitCode = 1;
}
