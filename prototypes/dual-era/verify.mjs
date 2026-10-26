// Browser verification uses the same controls as a visitor. Run with ?verify=1&run=1&still=1.
const api = window.__dualEra;
const report = { date: new Date().toISOString(), checks: [], metrics: {}, errors: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, value, detail) {
  report.checks.push({ name, pass: !!value, ...(detail === undefined ? {} : { detail }) });
  if (!value) throw Error(name);
}
async function click(type) {
  const button = document.querySelector(`[data-action="${type}"]`);
  check(`action ${api.info().mode}/${type} available`, button && !button.disabled);
  button.click(); await api.whenIdle();
  check(`${api.info().mode}/${type} completes`, !api.info().busy, { phase: api.state().phase, revision: api.state().revision, errors: api.info().errors });
}
try {
  await api.ready;
  check('normal preview has all ten chapter links', document.querySelectorAll('#chapter-links a').length === 10);
  check('preview does not create a WebGL canvas', !document.querySelector('canvas'));
  for (const mode of ['human', 'agent']) {
    const entering = api.start(mode);
    check(`${mode}: normal homepage remains available during loading`, !document.getElementById('landing').hidden && document.getElementById('enter').disabled && document.getElementById('experience').classList.contains('preparing'));
    await entering; api.reset();
    check(`${mode}: real WebGL context`, api.info().world?.calls > 0);
    await click('SURVEY'); await click('BUILD');
    check(`${mode}: no deployment before checks`, !document.querySelector('[data-action="DEPLOY"]'));
    if (mode === 'agent') {
      await click('CHECK');
      check('agent: empty harness leaves every condition without evidence', Object.keys(api.state().evidence).length === 0);
      const checkbox = document.querySelector('[data-check="backup"]'); checkbox.click();
      await click('CHECK');
      check('agent: one configured check does not imply all passed', Object.keys(api.state().evidence).length === 1 && !document.querySelector('[data-action="DEPLOY"]'));
      document.getElementById('read-chapter').focus();
      document.getElementById('read-chapter').click(); await api.whenIdle();
      check('reader opens the real verification chapter', api.info().readerOpen && api.info().chapterLoaded && document.getElementById('chapter-content').textContent.includes('验证') && document.getElementById('chapter-content').textContent.length > 1500);
      check('reader supports code copying and internal headings', document.querySelectorAll('.copy-code').length > 0 && document.querySelectorAll('#chapter-content h2').length > 3);
      const srLabel = document.querySelector('#chapter-content .sl-anchor-link .sr-only');
      check('chapter anchor accessibility labels stay visually hidden', srLabel && getComputedStyle(srLabel).position === 'absolute' && srLabel.getBoundingClientRect().width === 1);
      await wait(80);
      const before = api.info().world.frames; await wait(100);
      check('reader pauses the 3D render loop', api.info().world.frames === before && !api.info().world.running);
      document.getElementById('apply-method').click(); await wait(30);
      check('applying a method restores reader focus without inventing evidence', !api.info().readerOpen && document.activeElement.id === 'read-chapter' && Object.keys(api.state().evidence).length === 1);
    }
    await click('CHECK');
    check(`${mode}: same incompatible connector detected`, api.state().evidence.interface?.pass === false);
    await click('FIX');
    check(`${mode}: changed candidate invalidates evidence`, Object.keys(api.state().evidence).length === 0);
    await click('CHECK'); await click('DEPLOY');
    check(`${mode}: local order restored only after evidence`, api.state().accepted);
    await click('ENV_CHANGE');
    check(`${mode}: unknown external condition reopens task`, !api.state().accepted && api.state().disturbed && Object.keys(api.state().evidence).length === 0);
    await click('ADAPT'); await click('CHECK'); await click('DEPLOY');
    check(`${mode}: revised conditions need four current passing checks`, api.state().accepted && Object.values(api.state().evidence).length === 4 && Object.values(api.state().evidence).every(e => e.pass && e.revision === api.state().revision));
    await wait(80); const before = api.info().world.frames; await wait(100);
    check(`${mode}: idle scene does not keep rendering`, before === api.info().world.frames && !api.info().world.running);
    report.metrics[mode] = api.info().world;
    document.getElementById('exit').click();
    check(`${mode}: exit removes canvas and returns focus`, !document.querySelector('canvas') && document.activeElement.id === 'enter' && !document.getElementById('landing').hidden);
  }
  for (let i = 0; i < 3; i++) { await api.start(i % 2 ? 'agent' : 'human'); api.exit(); }
  // Three.js may retain its module-level empty shadow sampler in renderer.info.
  // Verify the stable baseline AND actual context loss, rather than claiming zero VRAM.
  check('five enter/exit cycles dispose geometry, lose context and detach canvas', api.info().disposals.length === 5 && api.info().disposals.every(d => d && d.geometries === 0 && d.textures <= 1 && d.contextLost && d.canvasDetached), api.info().disposals);
  // A real narrow iframe avoids Chrome headless minimum-window-width ambiguity.
  const frame = document.createElement('iframe'); frame.width = '390'; frame.height = '900'; frame.style.border = '0'; frame.title = '无 WebGL 窄屏验证'; frame.src = '/?verify=1&nowebgl=1'; document.body.append(frame);
  await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  const child = frame.contentWindow.__dualEra; await child.ready; await child.start('agent');
  const doc = frame.contentDocument;
  check('390px fallback has no horizontal page overflow', frame.contentWindow.innerWidth === 390 && doc.documentElement.scrollWidth <= 390, { viewport: frame.contentWindow.innerWidth, page: doc.documentElement.scrollWidth });
  check('no-WebGL route preserves task and spatial node controls', !doc.querySelector('canvas') && doc.querySelectorAll('.scene-tag:not([hidden])').length === 5 && !!doc.querySelector('[data-action="SURVEY"]'));
  await child.act('SURVEY'); await child.act('BUILD'); await child.openReader();
  check('no-WebGL route still loads real chapter and runs task', child.state().candidate && child.info().chapterLoaded && child.info().readerOpen);
  child.exit(); frame.remove();
  const cancelledEntry = api.start('human'); api.exit(); await cancelledEntry;
  check('leaving during entry does not mount a stale scene', !api.info().active && !document.querySelector('canvas') && !document.getElementById('landing').hidden);
  check('no unexpected controller errors', api.info().errors.length === 0, api.info().errors);
  report.metrics.lifecycle = api.info().disposals;
  // Leave an inspectable final scene after the test suite.
  await api.start('agent'); document.getElementById('overview').click(); await wait(100); window.scrollTo(0, 0);
} catch (error) { report.errors.push(error.stack || String(error)); }
report.pass = report.errors.length === 0 && report.checks.every(c => c.pass);
window.__dualEraReport = report;
const status = document.createElement('p'); status.id = 'verification-result'; status.style.cssText = 'padding:12px 24px;border-bottom:1px solid #52616b;color:#ff9b6b'; status.textContent = `${report.pass ? 'PASS' : 'FAIL'} · ${report.checks.length} browser assertions · ${report.errors.join(' / ')}`; document.body.prepend(status);
await fetch('/__verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
