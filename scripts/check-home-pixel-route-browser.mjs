import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportFolder = resolve(root, '.lab/home-pixel-route');
const stableReport = resolve(root, 'prototypes/visual-direction/pixel-route-v01/home-checks.json');
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
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async expression => {
    for (let i = 0; i < 180; i++) { if (await evaluate(expression)) return; await pause(75); }
    throw Error('Timed out: ' + expression);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4395/?revision=frontier&actorPreview=1' });
  await until('!!window.__visualStudy');
  await evaluate('window.__visualStudy.ready');
  check('首页初始只有一张 WebGL 画布', await evaluate('document.querySelectorAll("canvas").length === 1 && window.__visualStudy.state().world.calls > 0'));
  check('进入前不显示路线角色', await evaluate('window.__visualStudy.state().world.visibleStations === 0 && window.__visualStudy.state().world.actorsVisible === false && window.__visualStudy.state().world.pixelActorVisible === false'));
  await evaluate('window.__visualStudy.enter()');
  await until('window.__visualStudy.state().view === "space" && !window.__visualStudy.state().busy');
  await until('window.__visualStudy.state().world.actorReady === true');
  const entered = await evaluate('window.__visualStudy.state()');
  report.metrics.entered = entered;
  check('进入后像素角色已进入探索场景', entered.world.view === 'space' && entered.world.actorReady === true && entered.world.actorsVisible === true && entered.world.pixelActorVisible === true, entered.world);
  check('角色初始位于验证测点并保持左向停稳', entered.world.actorIndex === 2 && entered.world.actorFacing === 'left' && entered.world.actorMoving === false, entered.world);
  await evaluate('document.getElementById("route-previous").click()');
  check('回到上一测点会启动角色移动', await evaluate('window.__visualStudy.state().world.actorMoving === true && document.getElementById("space-route-status").textContent.includes("行进")'));
  await until('window.__visualStudy.state().world.actorMoving === false && window.__visualStudy.state().world.actorIndex === 1');
  const arrived = await evaluate('window.__visualStudy.state()');
  check('角色抵达上一测点后停稳且不反向', arrived.world.actorIndex === 1 && arrived.world.actorMoving === false && arrived.world.actorFacing === 'left' && arrived.world.actorStatus.includes('抵达'), arrived.world);
  check('抵达后转身按钮已同步可用', await evaluate('document.getElementById("route-turn").disabled === false'), await evaluate('({disabled:document.getElementById("route-turn").disabled,ready:window.__visualStudy.state().world.actorReady,moving:window.__visualStudy.state().world.actorMoving})'));
  await evaluate('document.getElementById("route-turn").click()');
  await pause(120);
  check('点击转身确实创建转身状态', await evaluate('window.__visualStudy.state().world.actorMoving === true || window.__visualStudy.state().world.actorFacing === "front"'), await evaluate('window.__visualStudy.state().world'));
  await until('window.__visualStudy.state().world.actorMoving === false && window.__visualStudy.state().world.actorFacing === "front"');
  const front = await evaluate('window.__visualStudy.state().world');
  check('转身回望完成后停在正面', front.actorFacing === 'front' && front.actorMoving === false && front.actorStatus.includes('正面'), front);
  await evaluate('document.getElementById("route-turn").click()');
  await until('window.__visualStudy.state().world.actorMoving === false && window.__visualStudy.state().world.actorFacing === "left"');
  check('再次转身回到左向且不伪造右向', await evaluate('window.__visualStudy.state().world.actorFacing === "left" && window.__visualStudy.state().world.actorStatus.includes("左侧")'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(220);
  const mobile = await evaluate('window.__visualStudy.state()');
  report.metrics.mobile = mobile;
  check('窄屏首屏与探索控制无横向溢出', mobile.bodyWidth <= 390 && await evaluate('document.documentElement.scrollWidth <= 390 && document.body.scrollWidth <= 390'), mobile);
  check('窄屏仍保留角色与路线状态', mobile.world.view === 'space' && mobile.world.actorReady === true && mobile.world.pixelActorVisible === true, mobile.world);
  check('正式首页角色验收无运行时错误', report.consoleErrors.length === 0 && mobile.errors.length === 0, report.consoleErrors);
} catch (error) {
  report.fatal = error.stack;
} finally {
  socket?.close();
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
  for (let i = 0; i < 15; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await pause(150); } }
  if (!profile.startsWith(reportFolder + sep) || !basename(profile).startsWith('browser-check-')) throw Error('Unsafe profile cleanup path');
  report.pass = !report.fatal && report.checks.every(entry => entry.pass);
  await writeFile(resolve(reportFolder, 'browser-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(stableReport, JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!report.pass) process.exitCode = 1;
}
