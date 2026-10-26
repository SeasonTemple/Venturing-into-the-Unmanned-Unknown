// Owned headless Chrome, real wall-clock time, no screenshots. Always clean its exact PID tree.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder = resolve('.lab/dual-era'); await mkdir(folder, { recursive: true });
const profile = await mkdtemp(resolve(folder, 'browser-check-'));
const pause = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1440,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); } }
  if (!port) throw Error('Chrome did not start');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, reject) => { socket.onopen = r; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = event => { const value = JSON.parse(event.data); if (value.id) { const p = pending.get(value.id); pending.delete(value.id); value.error ? p?.reject(Error(value.error.message)) : p?.resolve(value.result); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/explore/?verify=1&run=1&still=1' });
  let report;
  for (let i = 0; i < 200; i++) { report = await evaluate('window.__dualEraReport'); if (report) break; await pause(150); }
  if (!report) throw Error('Browser suite timed out: ' + JSON.stringify(await evaluate('window.__dualEra?.info()')));
  const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); if (!pass) report.errors.push(name); };
  const originalHome = await readFile(resolve('site/dist/index.html'), 'utf8');
  const previewHome = await (await fetch('http://127.0.0.1:4394/')).text();
  const originalBrowse = originalHome.match(/<a class="mt-btn mt-btn-secondary" href="#chapters">浏览章节<\/a>/)?.[0];
  const withoutEntry = previewHome.replace(/<a id="explore-entry"[\s\S]*?<\/a>/, originalBrowse || '');
  check('homepage is the exact repository build except its secondary entry action', !!originalBrowse && withoutEntry === originalHome && previewHome.includes('data-astro-reload>迈入未知'));
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/?static=1' });
  for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector(".mt-home #explore-entry")')) break; await pause(50); }
  const homepage = await evaluate('({cards:document.querySelectorAll(".mt-grid-chapters .mt-cell").length,blurbs:Array.from(document.querySelectorAll(".mt-cell-desc"),e=>e.textContent.trim()).filter(Boolean).length,hero:!!document.querySelector("[data-hero-scene] picture img"),reading:!!document.querySelector(".mt-path"),downloads:!!document.getElementById("mt-h-art"),agents:!!document.getElementById("mt-h-agent"),modeControls:document.querySelectorAll("#mode-switch,input[name=exploration-mode]").length})');
  check('repository hero, chapter summaries and supporting sections preserved', homepage.cards === 10 && homepage.blurbs === 10 && homepage.hero && homepage.reading && homepage.downloads && homepage.agents, homepage);
  check('homepage never asks for an exploration role', homepage.modeControls === 0);
  const assets = await evaluate('Promise.all(Array.from(new Set(Array.from(document.querySelectorAll("script[src],link[rel=stylesheet],picture img,picture source"),e=>e.src||e.href||new URL(e.srcset,location.href).href))).filter(u=>new URL(u).origin===location.origin).map(async url=>({url,status:(await fetch(url)).status})))');
  check('reused homepage scripts, CSS and hero images load locally', assets.every(a => a.status === 200), assets);
  await evaluate('document.getElementById("explore-entry").click()');
  for (let i = 0; i < 100; i++) { if (await evaluate('location.pathname === "/explore/" && !!document.querySelector("#experience:not([hidden]):not(.preparing) #mode-switch input:not(:disabled)")')) break; await pause(50); }
  check('home entry opens the space directly and exposes the switch inside', await evaluate('location.pathname === "/explore/" && !document.getElementById("experience").hidden && !!document.querySelector("canvas") && document.querySelector("#mode-switch input:checked").value === "agent"'));
  await evaluate('document.querySelector("#mode-switch input[value=human]").click()');
  for (let i = 0; i < 100; i++) { if (await evaluate('document.getElementById("mode-label").textContent.includes("人类主导") && !document.querySelector("#mode-switch input").disabled')) break; await pause(50); }
  check('visitor can change exploration mode after entering', await evaluate('document.querySelector("#mode-switch input:checked").value === "human" && !document.querySelector("#mode-switch input").disabled'));
  await evaluate('document.getElementById("exit").click()');
  for (let i = 0; i < 100; i++) { if (await evaluate('location.pathname === "/" && !!document.querySelector(".mt-home #explore-entry")')) break; await pause(50); }
  check('exit navigates back to the repository homepage', await evaluate('location.pathname === "/" && !document.getElementById("experience") && document.querySelectorAll(".mt-grid-chapters .mt-cell").length === 10'));
  report.metrics.homepage = homepage;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/?static=1' });
  for (let i = 0; i < 100; i++) { if (await evaluate('location.search === "?static=1" && !!document.querySelector(".mt-home #explore-entry")')) break; await pause(50); }
  check('390px repository homepage retains chapter summaries without overflow', await evaluate('innerWidth===390 && document.documentElement.scrollWidth<=390 && document.querySelectorAll(".mt-cell-desc").length===10 && !document.getElementById("mode-switch")'));
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/explore/?verify=1' });
  for (let i = 0; i < 100; i++) { if (await evaluate('location.search === "?verify=1" && !!window.__dualEra')) break; await pause(50); }
  await evaluate('window.__dualEra.ready.then(() => window.__dualEra.start("agent"))');
  const mobile = await evaluate('({width:innerWidth, page:document.documentElement.scrollWidth, reduced:matchMedia("(prefers-reduced-motion: reduce)").matches, ...window.__dualEra.info().world})');
  check('390px real WebGL layout and DPR cap with reduced motion', mobile.width === 390 && mobile.page <= 390 && mobile.pixelRatio === 1.5 && mobile.reduced && mobile.calls > 0, mobile);
  await evaluate('document.getElementById("read-chapter").focus()');
  await send('Page.bringToFront');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await pause(60);
  await evaluate('window.__dualEra.whenIdle()');
  check('keyboard Enter opens real chapter', await evaluate('window.__dualEra.info().readerOpen && window.__dualEra.info().chapterLoaded'), await evaluate('window.__dualEra.info()'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await pause(100);
  check('keyboard Escape closes reader and restores focus', await evaluate('!window.__dualEra.info().readerOpen && document.activeElement.id === "read-chapter"'));
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true }); await pause(150);
  const resized = await evaluate('({width:innerWidth,page:document.documentElement.scrollWidth,canvas:document.querySelector("canvas").width,host:document.getElementById("canvas-host").clientWidth,dpr:window.__dualEra.info().world.pixelRatio})');
  check('landscape resize updates canvas without page overflow', resized.width === 844 && resized.page <= 844 && Math.abs(resized.canvas - resized.host * resized.dpr) < 2, resized);
  await evaluate('document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()'); await pause(200);
  check('lost WebGL context preserves task and reading fallback', await evaluate('window.__dualEra.info().active && !window.__dualEra.info().world && document.getElementById("world").classList.contains("fallback") && !document.getElementById("read-chapter").disabled'));
  check('mobile and context loss produce no controller errors', await evaluate('window.__dualEra.info().errors.length === 0'));
  report.metrics.mobile = mobile; report.metrics.resized = resized;
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/explore/?verify=1&motion=1' });
  for (let i = 0; i < 100; i++) { if (await evaluate('location.search.includes("motion") && !!window.__dualEra')) break; await pause(50); }
  await evaluate('window.__dualEra.start("human").then(() => window.__dualEra.act("SURVEY"))'); await pause(80);
  const motion = await evaluate('({phase:window.__dualEra.state().phase,...window.__dualEra.info().world})');
  check('normal entry and human travel finish with animation', motion.phase === 'ready' && motion.frames > 10 && motion.p95 > 0 && !motion.running, motion);
  report.metrics.motion = motion;
  await send('Page.navigate', { url: 'http://127.0.0.1:4394/review.html?triptych=1' });
  let comparison;
  for (let i = 0; i < 100; i++) {
    comparison = await evaluate('Array.from(document.querySelectorAll("figcaption"), e => e.textContent)');
    if (comparison?.length === 3 && comparison.every(t => t.includes('WebGL 正常'))) break;
    await pause(100);
  }
  check('side-by-side review shows both executors and real chapter', comparison?.length === 3 && comparison.every(t => t.includes('WebGL 正常')), comparison);
  report.pass = report.errors.length === 0 && report.checks.every(c => c.pass);
  await writeFile(resolve(folder, 'browser-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ pass: report.pass, assertions: report.checks.length, failures: report.checks.filter(c => !c.pass), errors: report.errors, metrics: report.metrics }, null, 2) + '\n');
  if (!report.pass) process.exitCode = 1;
} finally {
  socket?.close();
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
  for (let i = 0; i < 15; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await pause(150); } }
}
