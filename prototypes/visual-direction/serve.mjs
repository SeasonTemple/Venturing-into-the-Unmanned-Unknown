import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../../site/site.config.mjs';
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');
const repo = resolve(root, '../..'), dist = resolve(repo, 'site/dist'), deps = resolve(repo, 'site/node_modules/three');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.mp4': 'video/mp4' };
const bounded = (base, path) => { const file = resolve(base, '.' + path); if (!file.startsWith(base + sep)) throw Error('Invalid path'); return file; };
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1'); let path = decodeURIComponent(url.pathname), file;
    if (path === '/content.json') file = resolve(repo, 'site/src/generated/home.json');
    else if (/^\/chapters\/ch[0-8A]$/.test(path)) file = resolve(dist, path.split('/').pop(), 'index.html');
    else if (path === '/reference/') file = resolve(dist, 'index.html');
    else if (path.startsWith('/deps/three/')) file = bounded(deps, path.slice('/deps/three'.length));
    else if (path.startsWith(BASE + '/')) { path = path.slice(BASE.length); file = bounded(dist, path.endsWith('/') ? path + 'index.html' : path); }
    else file = bounded(root, path === '/' ? '/index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('预览资源不可用；真实章节需先构建 site。'); }
}).listen(4395, '127.0.0.1', () => process.stdout.write('Visual direction: http://127.0.0.1:4395/\n'));
