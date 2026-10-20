#!/usr/bin/env node
// 唯一的截图入口。一次运行 = 一个 Chrome 进程，必然退出，不留残余。
// 用法：node scripts/shot.mjs --url <url> --out <a.png> [--width 1440] [--height 900] [--wait 8000] [--theme light|dark]
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const url = arg('url');
const out = resolve(arg('out') || '');
const width = arg('width', '1440');
const height = arg('height', '900');
const wait = arg('wait', '8000');
const theme = arg('theme', 'light');

if (!url || !out) {
  console.error('usage: node scripts/shot.mjs --url <url> --out <file.png> [--width 1440 --height 900 --wait 8000 --theme light]');
  process.exit(2);
}

// 每次用唯一 profile —— 固定 profile 会让新进程接力给旧实例后立刻退出，截图不会执行。
// 但启动前先清扫历史残留，避免运行次数越多、Temp 里垃圾越多（曾累积到 121 个）。
const profile = mkdtempSync(join(tmpdir(), 'dsh-shot-'));
try {
  const tmp = tmpdir();
  for (const name of readdirSync(tmp)) {
    if (name.startsWith('dsh-shot-') && join(tmp, name) !== profile) {
      try { rmSync(join(tmp, name), { recursive: true, force: true }); } catch {}
    }
  }
} catch {}

let child = null;
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    if (child && child.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      }
    }
  } catch {}
  // Chrome 退出后仍会短暂占用 profile 内的文件；同步重试，确保进程退出前删干净
  const sleepSync = (ms) => {
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {}
  };
  for (let i = 0; i < 12; i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      if (!existsSync(profile)) break;
    } catch {}
    sleepSync(150);
  }

}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const args = [
  '--headless=new',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--user-data-dir=' + profile,
  '--window-size=' + width + ',' + height,
  '--virtual-time-budget=' + wait,
  '--blink-settings=preferredColorScheme=' + (theme === 'dark' ? '0' : '1'),
  '--screenshot=' + out,
  ...(process.env.SHOT_CHROME_FLAGS || '').split(/\s+/).filter(Boolean),   // 可选：额外的 Chrome 开关（如 --force-prefers-reduced-motion）
  url,
];

try { mkdirSync(dirname(out), { recursive: true }); } catch {}

// 先删旧图：否则 Chrome 失败时轮询会看到上一次的文件，误报成功
try { rmSync(out, { force: true }); } catch {}

child = spawn(CHROME, args, { stdio: 'ignore' });

const deadline = Date.now() + Number(wait) + 20000;
const timer = setInterval(() => {
  if (Date.now() > deadline) {
    clearInterval(timer);
    cleanup();
    console.error('timeout: chrome did not finish in time');
    process.exit(1);
  }
}, 500);

child.on('exit', async () => {
  clearInterval(timer);
  cleanup();
  // Windows 上 Chrome 退出后文件句柄可能还没释放，轮询最多 4 秒
  for (let i = 0; i < 40; i++) {
    if (existsSync(out)) {
      try {
        const size = statSync(out).size;
        if (size > 0) {
          console.log('ok ' + out + ' ' + size + ' bytes');
          process.exit(0);
        }
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  console.error('failed: no screenshot produced at ' + out);
  process.exit(1);
});
