import { spawn, execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const checkScript = resolve(repoRoot, 'prototypes/visual-direction/browser-check.mjs');
const serveScript = resolve(repoRoot, 'prototypes/visual-direction/serve.mjs');
const probeUrl = 'http://127.0.0.1:4395/';

async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isReachable(probeUrl)) return null;
  const srv = spawn(process.execPath, [serveScript], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let errLog = '';
  srv.stdout.resume();
  srv.stderr.on('data', (chunk) => { errLog += chunk.toString(); });
  for (let i = 0; i < 60; i++) {
    if (await isReachable(probeUrl)) return srv;
    if (srv.exitCode !== null) {
      throw new Error(`Preview server exited (${srv.exitCode}): ${errLog}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${probeUrl}: ${errLog}`);
}

function runSuite(flag) {
  return new Promise((resolveSuite) => {
    const child = spawn(process.execPath, [checkScript, flag], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk.toString(); });
    child.stderr.on('data', (chunk) => { err += chunk.toString(); });
    child.on('exit', (code) => {
      resolveSuite({ flag, code: code ?? 1, out: out.trim(), err: err.trim() });
    });
  });
}

const startedAt = Date.now();
const ownedServer = await ensureServer();

try {
  const results = [];
  // Isolate the 4x CPU-throttled audit before running parallel suites.
  results.push(await runSuite('--reader-audit'));
  results.push(...(await Promise.all([runSuite('--home'), runSuite('--production')])));

  for (const r of results) {
    if (r.out) console.log(`${r.flag}: ${r.out}`);
    if (r.err) console.error(`${r.flag} stderr:\n${r.err}`);
    if (r.code !== 0) process.exitCode = 1;
  }
  const totalSecs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Total wall-clock time: ${totalSecs}s`);
} finally {
  if (ownedServer?.pid) {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(ownedServer.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {}
    } else {
      ownedServer.kill('SIGTERM');
    }
  }
}
