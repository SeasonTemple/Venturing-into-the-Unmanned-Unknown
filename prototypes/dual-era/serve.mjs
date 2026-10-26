import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../../site/site.config.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
const repo = resolve(root, '../..');
const deps = resolve(repo, 'site/node_modules/three');
const dist = resolve(repo, 'site/dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm' };
const safe = (base, path) => { const file = resolve(base, '.' + path); if (!file.startsWith(base + sep)) throw Error('Invalid path'); return file; };
const entryLink = '<a id="explore-entry" class="mt-btn mt-btn-secondary" href="/explore/" data-astro-reload>迈入未知<span class="mt-arrow" aria-hidden="true">→</span></a>';
function withExplorationEntry(html) {
  const browse = /<a class="mt-btn mt-btn-secondary" href="#chapters">浏览章节<\/a>/;
  if (!browse.test(html)) throw Error('Repository homepage secondary action not found');
  // Reuse the built repository page exactly; do not recreate its hero or chapter cards.
  // Keep two actions in the original row; SCROLL still links directly to chapters.
  return html.replace(browse, entryLink);
}
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/__verify') {
      if (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:4394') { res.writeHead(403); res.end(); return; }
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 60000) throw Error('Report too large'); }
      const report = JSON.parse(body); await mkdir(resolve(repo, '.lab/dual-era'), { recursive: true });
      await writeFile(resolve(repo, '.lab/dual-era/browser-report.json'), JSON.stringify(report, null, 2)); res.writeHead(204); res.end(); return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (['/', BASE, BASE + '/', '/reference/'].includes(url.pathname)) {
      const original = await readFile(resolve(dist, 'index.html'), 'utf8');
      const html = url.pathname === '/reference/' ? original : withExplorationEntry(original);
      res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' }); res.end(html); return;
    }
    if (url.pathname === '/content.json') {
      const cfg = JSON.parse(await readFile(resolve(repo, 'book.config.json'), 'utf8'));
      res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ title: cfg.title_zh, version: cfg.version, chapters: cfg.chapters.map(c => ({ order: c.order, title: c.title, slug: 'ch' + c.order })) })); return;
    }
    let file;
    if (url.pathname.startsWith('/deps/three/')) file = safe(deps, decodeURIComponent(url.pathname.slice('/deps/three'.length)));
    else if (/^\/chapters\/ch[0-8A]$/.test(url.pathname)) file = resolve(dist, url.pathname.split('/').pop(), 'index.html');
    else if (url.pathname.startsWith(BASE + '/')) {
      let path = decodeURIComponent(url.pathname.slice(BASE.length));
      if (path.endsWith('/')) path += 'index.html';
      file = safe(dist, path);
    } else if (url.pathname.startsWith('/explore/')) {
      const path = decodeURIComponent(url.pathname.slice('/explore'.length));
      file = safe(root.replace(/[\\/]$/, ''), path === '/' ? '/index.html' : path);
    } else file = safe(root.replace(/[\\/]$/, ''), decodeURIComponent(url.pathname));
    const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('资源不可用；章节内容请先在 site 目录运行 npm run build。'); }
}).listen(4394, '127.0.0.1', () => process.stdout.write('Prototype: http://127.0.0.1:4394/\n'));
