// Real-time checks use one owned browser; screenshots belong to scripts/shot.mjs.
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
const readingOnly = process.argv.includes('--reading');
const wideOnly = process.argv.includes('--wide');
const journalOnly = process.argv.includes('--journal');
const terrainOnly = process.argv.includes('--terrain');
const materialsOnly = process.argv.includes('--materials');
const outpostOnly = process.argv.includes('--outpost');
const territoryOnly = process.argv.includes('--territory');
const productionOnly = process.argv.includes('--production');
const riftOnly = process.argv.includes('--rift');
const fieldOnly = process.argv.includes('--field');
const benchOnly = process.argv.includes('--bench');
const meadowOnly = process.argv.includes('--meadow');
const homeOnly = process.argv.includes('--home');
const readerAudit = process.argv.includes('--reader-audit');
const folder = resolve(fieldOnly ? '.lab/field-study' : riftOnly ? '.lab/rift-design' : productionOnly ? '.lab/production-journal' : territoryOnly ? '.lab/territory-design' : outpostOnly ? '.lab/outpost-design' : materialsOnly ? '.lab/material-study' : terrainOnly ? '.lab/journal-terrain' : journalOnly ? '.lab/field-journal' : wideOnly ? '.lab/reading-wide' : readingOnly ? '.lab/reading-study' : '.lab/visual-direction'); await mkdir(folder, { recursive: true });
const reportFolder=readerAudit?resolve('.lab/reader-revision'):homeOnly?resolve('.lab/meadow-production'):meadowOnly?resolve('.lab/meadow-motion'):benchOnly?resolve('.lab/bench-study'):folder;await mkdir(reportFolder,{recursive:true});
const profile = await mkdtemp(resolve(reportFolder, 'browser-check-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--window-size=1440,960', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, ownedPids = [chrome.pid];
const report = { pass: false, checks: [], metrics: {}, consoleErrors: [] };
const check = (name, pass, detail) => report.checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
const luminance = hex => { const rgb = hex.match(/[a-f0-9]{2}/gi).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; };
const pairs = [['lightBody','#252d30','#eeece5'],['lightSecondary','#535c5e','#eeece5'],['lightLink','#9b4928','#eeece5'],['homeSecondary','#535c5e','#e7e4dc'],['homeLink','#9b4928','#e7e4dc'],['darkBody','#e2e7df','#18262c'],['darkSecondary','#bac5bf','#18262c'],['darkLink','#edb17a','#18262c'],['heroBody','#e9e9df','#111c22'],['heroSecondary','#bdc9c9','#111c22']];
if (!homeOnly && !meadowOnly && !benchOnly && !fieldOnly && !riftOnly && !productionOnly && !readingOnly && !wideOnly && !journalOnly && !terrainOnly && !materialsOnly && !outpostOnly && !territoryOnly) {
  report.metrics.paletteContrast = Object.fromEntries(pairs.map(([label,foreground,background])=>{ const a=luminance(foreground),b=luminance(background);return [label,Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))]; }));
  report.metrics.sourceBytes = Object.fromEntries(await Promise.all(['index.html','style.css','frontier.css','app.mjs','frontier-world.mjs'].map(async file=>[file,(await readFile(new URL(file,import.meta.url))).length])));
  check('candidate flat-palette text pairs meet 4.5:1', Object.values(report.metrics.paletteContrast).every(ratio=>ratio>=4.5),report.metrics.paletteContrast);
}
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); } }
  if (!port) throw Error('Owned Chrome failed to start');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0; const pending = new Map();
  socket.onmessage = event => {
    const value = JSON.parse(event.data);
    if (value.id) { const entry = pending.get(value.id); pending.delete(value.id); value.error ? entry?.reject(Error(value.error.message)) : entry?.resolve(value.result); }
    if (value.method === 'Runtime.exceptionThrown') report.consoleErrors.push(value.params.exceptionDetails.text);
    if (value.method === 'Runtime.consoleAPICalled' && value.params.type === 'error') report.consoleErrors.push(value.params.args.map(arg => arg.value || arg.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(70); } throw Error('Timed out: ' + expression); };
  await send('Page.enable'); await send('Runtime.enable');
  if (readerAudit) {
    await (await import('../../site/scripts/reader-audit.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (homeOnly) {
    await (await import('../../site/scripts/home-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (meadowOnly) {
    await (await import('./meadow-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (benchOnly) {
    await (await import('./bench-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (fieldOnly) {
    await (await import('./field-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (riftOnly) {
    await (await import('./rift-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (productionOnly) {
    await (await import('../../site/scripts/journal-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (territoryOnly) {
    await (await import('./territory-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (outpostOnly) {
    await (await import('./outpost-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (materialsOnly) {
    await (await import('./material-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (terrainOnly) {
    await (await import('./terrain-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (journalOnly) {
    await (await import('./journal-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (wideOnly) {
    await (await import('./reading-wide-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else if (readingOnly) {
    await (await import('./reading-checks.mjs')).run({send,evaluate,until,pause,check,report});
  } else {
  await send('Page.navigate', { url: 'http://127.0.0.1:4395/' });
  await until('!!window.__visualStudy'); await evaluate('window.__visualStudy.ready');
  check('home artwork renders with one WebGL canvas', await evaluate('document.querySelectorAll("canvas").length===1 && window.__visualStudy.state().world.calls>0'));
  report.metrics.home=await evaluate('window.__visualStudy.state().world');
  check('home opens a measured landscape with unresolved samples',report.metrics.home.art==='survey-frontier'&&report.metrics.home.surfaceTriangles>20000&&report.metrics.home.unknownSamples>100);
  check('complete work sites and actors are reserved for entry',report.metrics.home.visibleStations===0&&!report.metrics.home.actorsVisible);
  check('exploration choices and chapter markers only appear after entry', await evaluate('document.getElementById("space-ui").hidden && !document.getElementById("enter").hidden'));
  check('ten actual chapter summaries and installation remain available below artwork', await evaluate('document.querySelectorAll(".chapter-row small").length===10 && document.getElementById("install-command").textContent.includes("git clone")'));
  await evaluate('window.__originalCanvas=document.querySelector("canvas"); window.__visualStudy.enter()');
  report.metrics.entered = await evaluate('window.__visualStudy.state()');
  check('normal camera travel completes in the original world', await evaluate('window.__visualStudy.state().view==="space" && !window.__visualStudy.state().busy && !window.__visualStudy.state().world.moving && window.__visualStudy.state().world.frames>10 && document.querySelector("canvas")===window.__originalCanvas'));
  check('entry reveals six station choices and mode controls', await evaluate('!document.getElementById("space-ui").hidden && document.querySelectorAll(".station-label:not([hidden])").length===6'));
  check('same landscape reveals six physical work sites',report.metrics.entered.world.visibleStations===6&&report.metrics.entered.world.actorsVisible&&report.metrics.entered.world.art===report.metrics.home.art);
  await evaluate('document.querySelector("input[value=human]").click()');
  check('inside mode control updates the world', await evaluate('window.__visualStudy.state().mode==="human" && window.__visualStudy.state().world.mode==="human"'));
  await evaluate('document.getElementById("station-2").click(); document.getElementById("station-read").focus(); document.getElementById("station-read").click()');
  await until('document.getElementById("chapter-content").getAttribute("aria-busy")==="false"');
  check('station opens the real verification chapter and generated TOC', await evaluate('window.__visualStudy.state().currentChapter==="ch3" && document.querySelectorAll("#chapter-content h2").length>3 && document.querySelectorAll("#chapter-toc a").length>3 && document.getElementById("chapter-content").textContent.length>3000'));
  report.metrics.reader = await evaluate('({width:innerWidth,page:document.documentElement.scrollWidth,headings:document.querySelectorAll("#chapter-content h2").length,code:document.querySelectorAll("#chapter-content pre").length,bodySize:getComputedStyle(document.getElementById("chapter-content")).fontSize,bodyLeading:getComputedStyle(document.getElementById("chapter-content")).lineHeight})');
  const frameCount = await evaluate('window.__visualStudy.state().world.frames'); await pause(250);
  check('reading suspends the scene instead of starting another canvas', await evaluate(`window.__visualStudy.state().world.frames===${frameCount} && document.querySelectorAll("canvas").length===1`));
  await evaluate('document.getElementById("reader-theme").click()');
  check('dark reading uses the shared palette', await evaluate('document.getElementById("reading-view").classList.contains("dark") && getComputedStyle(document.getElementById("reading-view")).backgroundColor==="rgb(24, 38, 44)"'));
  await evaluate('document.getElementById("reader-next").click()'); await until('document.getElementById("chapter-content").getAttribute("aria-busy")==="false" && window.__visualStudy.state().currentChapter==="ch4"');
  check('next chapter loads the complete implementation article', await evaluate('(async()=>{const source=new DOMParser().parseFromString(await(await fetch("/chapters/ch4")).text(),"text/html").querySelector(".sl-markdown-content");return document.getElementById("reader-title").textContent==="实现" && document.getElementById("chapter-content").textContent.trim()===source.textContent.trim()})()'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await until('window.__visualStudy.state().view==="space" && !window.__visualStudy.state().busy');
  check('Escape returns to original space and restores reading trigger focus', await evaluate('document.activeElement.id==="station-read" && document.querySelector("canvas")===window.__originalCanvas'));
  await evaluate('window.__visualStudy.home()');
  const idle = await evaluate('window.__visualStudy.state().world.frames'); await pause(350);
  check('home sample motion uses a bounded render rate', await evaluate(`window.__visualStudy.state().world.frames>${idle} && window.__visualStudy.state().world.frames<=${idle}+6`));
  await evaluate('document.getElementById("contents").scrollIntoView({behavior:"instant"})');await pause(250);
  const hiddenFrames=await evaluate('window.__visualStudy.state().world.frames');await pause(200);
  check('scrolling past artwork stops rendering',await evaluate(`window.__visualStudy.state().world.frames===${hiddenFrames} && !window.__visualStudy.state().world.loopScheduled`));
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await pause(200);
  check('390px homepage has no horizontal overflow and caps pixel ratio', await evaluate('innerWidth===390 && document.documentElement.scrollWidth<=390 && window.__visualStudy.state().world.pixelRatio===1.5'));
  check('mobile title stays on one line within the available width',await evaluate('(()=>{const h=document.querySelector(".hero-caption h1"),r=h.getBoundingClientRect(),s=getComputedStyle(h);return h.scrollWidth<=h.clientWidth && r.height<parseFloat(s.lineHeight)*1.1})()'));
  const reducedFrames=await evaluate('window.__visualStudy.state().world.frames');await pause(200);
  check('reduced motion leaves home static',await evaluate(`window.__visualStudy.state().world.frames===${reducedFrames} && !window.__visualStudy.state().world.loopScheduled`));
  await evaluate('window.__visualStudy.enter()');
  check('reduced-motion entry settles immediately', await evaluate('!window.__visualStudy.state().world.moving && !document.getElementById("space-ui").hidden'));
  report.metrics.mobileStations = await evaluate('Array.from(document.querySelectorAll(".station-label"),e=>{const r=e.getBoundingClientRect();return {title:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden}})');
  const boxes = report.metrics.mobileStations;
  check('mobile station labels are in bounds and do not overlap', boxes.every((a,i) => !a.hidden && a.x>=0 && a.x+a.w<=390 && boxes.slice(i+1).every(b => a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y)), boxes);
  await evaluate('window.__visualStudy.read("ch3")');
  check('390px ordinary reading page fits its viewport', await evaluate('document.documentElement.scrollWidth<=390 && document.querySelector(".chapter-content").clientWidth<390'));
  await evaluate('document.getElementById("reader-theme").click()');
  check('reading remains available in either palette on mobile', await evaluate('!document.getElementById("reading-view").classList.contains("dark") && document.getElementById("chapter-content").textContent.length>3000'));
  report.metrics.final = await evaluate('window.__visualStudy.state()');
  check('no application or browser runtime errors', report.metrics.final.errors.length===0 && report.consoleErrors.length===0, report.consoleErrors);
  check('unknown preview resources return 404 without stopping server', (await fetch('http://127.0.0.1:4395/nonexistent-resource')).status===404 && (await fetch('http://127.0.0.1:4395/')).status===200);
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1420, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4395/direction.html?mobile=1' });
  await until('document.body.classList.contains("mobile") && document.querySelectorAll(".mobile-only iframe[src]").length===3');
  check('mobile comparison board keeps three actual 390px windows',await evaluate('getComputedStyle(document.querySelector(".mobile-only")).display==="grid" && Array.from(document.querySelectorAll(".mobile-only iframe")).every(e=>e.clientWidth===390 && e.parentElement.clientWidth<=390)'));
  }
} catch (error) { report.fatal = error.stack; }
finally {
  socket?.close();
  try {
    const processes = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process -Filter "name = \'chrome.exe\'" | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'], { encoding: 'utf8', windowsHide: true }));
    for (let i=0;i<10;i++) for (const entry of [processes].flat()) if (ownedPids.includes(entry.ParentProcessId) && !ownedPids.includes(entry.ProcessId)) ownedPids.push(entry.ProcessId);
  } catch {}
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {}
  await pause(300);
  let remaining = [];
  for (const pid of ownedPids) { try { process.kill(pid, 0); remaining.push(pid); } catch {} }
  report.metrics.ownedBrowser = { pid: chrome.pid, recordedProcesses: ownedPids.length, remaining };
  check('owned browser process tree has zero remaining processes', remaining.length===0, remaining);
  if (!profile.startsWith(reportFolder + sep) || !basename(profile).startsWith('browser-check-')) throw Error('Unsafe profile cleanup path');
  for (let i=0;i<15;i++) { try { await rm(profile, { recursive:true, force:true }); break; } catch { await pause(150); } }
  report.pass = !report.fatal && report.checks.every(check=>check.pass);
  await writeFile(resolve(reportFolder,'browser-report.json'),JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if (!report.pass) process.exitCode=1;
}
