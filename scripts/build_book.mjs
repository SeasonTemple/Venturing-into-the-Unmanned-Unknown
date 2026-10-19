#!/usr/bin/env node
// 把 skills/<skill>/SKILL.md 合成单文件全书（--mode=book）或 mdbook 的 src 目录（--mode=site）。
// 章节顺序唯一真源：仓库根的 book.config.json；本脚本不含任何章节列表。
// 仅使用 Node 内置模块。失败一律以非 0 退出码结束。
//
// 用法：
//   node scripts/build_book.mjs --mode=book --out=<文件路径>
//   node scripts/build_book.mjs --mode=site --out=<目录路径>
// 可选（测试用）：--root=<仓库根目录>，默认取本脚本上一级目录。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

class BuildError extends Error {}

function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    const m = /^--(mode|out|root)=(.*)$/.exec(arg);
    if (!m) throw new BuildError('未知参数: ' + arg);
    opts[m[1]] = m[2];
  }
  if (opts.mode !== 'book' && opts.mode !== 'site') {
    throw new BuildError('--mode 必须是 book 或 site');
  }
  if (!opts.out) throw new BuildError('缺少 --out=<路径>');
  return opts;
}

function nonEmptyString(v, where) {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new BuildError('book.config.json: ' + where + ' 必须是非空字符串');
  }
  return v;
}

function loadConfig(root) {
  const file = path.join(root, 'book.config.json');
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    throw new BuildError('无法读取/解析 ' + file + ': ' + e.message);
  }
  for (const k of ['title', 'title_zh', 'version']) nonEmptyString(cfg[k], k);
  if (!Array.isArray(cfg.chapters) || cfg.chapters.length === 0) {
    throw new BuildError('book.config.json: chapters 必须是非空数组');
  }
  const seenOrder = new Set();
  const seenSkill = new Set();
  const chapters = cfg.chapters.map((c, i) => {
    const w = 'chapters[' + i + ']';
    const ch = {
      index: i,
      order: nonEmptyString(c && c.order, w + '.order'),
      label: nonEmptyString(c && c.label, w + '.label'),
      title: nonEmptyString(c && c.title, w + '.title'),
      skill: nonEmptyString(c && c.skill, w + '.skill'),
    };
    if (seenOrder.has(ch.order)) throw new BuildError(w + '.order 重复: ' + ch.order);
    if (seenSkill.has(ch.skill)) throw new BuildError(w + '.skill 重复: ' + ch.skill);
    seenOrder.add(ch.order);
    seenSkill.add(ch.skill);
    ch.heading = ch.label + ' ' + ch.title;
    ch.anchor = 'ch-' + ch.order.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    ch.file = String(i).padStart(2, '0') + '-' + ch.skill + '.md';
    ch.src = path.join(root, 'skills', ch.skill, 'SKILL.md');
    return ch;
  });
  const anchors = new Set();
  for (const ch of chapters) {
    if (anchors.has(ch.anchor)) throw new BuildError('章节锚点冲突: ' + ch.anchor);
    anchors.add(ch.anchor);
  }
  return { title: cfg.title, titleZh: cfg.title_zh, version: cfg.version, chapters };
}

function readSkill(ch) {
  let raw;
  try {
    raw = fs.readFileSync(ch.src, 'utf8');
  } catch (e) {
    throw new BuildError('章节文件不存在或不可读: ' + ch.src + ' (' + e.message + ')');
  }
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function stripFrontmatter(text, where) {
  const lines = text.split('\n');
  if (lines[0].trimEnd() !== '---') {
    throw new BuildError(where + ': 缺少 YAML frontmatter（首行应为 ---）');
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '---') { end = i; break; }
  }
  if (end < 0) throw new BuildError(where + ': YAML frontmatter 未闭合');
  return lines.slice(end + 1).join('\n');
}

// 逐行遍历并标记是否位于围栏代码块内（``` 或 ~~~，闭合围栏须同字符且不短于开启围栏）。
function eachLine(text, fn) {
  const out = [];
  let fence = null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    let inFence = fence !== null;
    if (fence === null && m) {
      fence = { ch: m[1][0], len: m[1].length };
      inFence = true;
    } else if (fence !== null && m && m[1][0] === fence.ch && m[1].length >= fence.len &&
               line.trim() === m[1]) {
      fence = null;
      inFence = true;
    }
    out.push(fn(line, inFence, i + 1));
  }
  if (fence !== null) throw new BuildError('围栏代码块未闭合');
  return out.join('\n');
}

function dropLeadingH1(body) {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^# +\S/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return lines.slice(i).join('\n');
  }
  return lines.slice(i).join('\n');
}

const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

// 把相对路径目标解析为章节；解析不到返回 null。
function resolveChapter(target, ch, chapterBySkill) {
  let p = target;
  const cut = p.search(/[#?]/);
  if (cut >= 0) p = p.slice(0, cut);
  if (p === '') return null;
  try { p = decodeURI(p); } catch { /* 保持原样 */ }
  const resolved = path.posix.normalize(path.posix.join('skills', ch.skill, p.replace(/\\/g, '/')));
  const m = /^skills\/([^/]+)(?:\/SKILL\.md|\/)?$/.exec(resolved);
  return m && chapterBySkill.get(m[1]) || null;
}

function makeLinkRewriter(mode, chapterBySkill, ch, problems) {
  const hrefFor = (c) => (mode === 'book' ? '#' + c.anchor : c.file);
  const rewriteInline = (line, lineNo) => {
    const re = /(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|[^)\s]*)((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g;
    return line.replace(re, (all, bang, text, rawTarget, title) => {
      const target = rawTarget.replace(/^<|>$/g, '');
      if (target === '' || target.startsWith('#') || SCHEME.test(target)) return all;
      const hit = resolveChapter(target, ch, chapterBySkill);
      if (hit && !bang) return '[' + text + '](' + hrefFor(hit) + title + ')';
      problems.push(ch.skill + ':' + lineNo + ' 本地链接已降为文本: ' + target);
      if (bang) return text;
      return text + '（`' + target + '`）';
    });
  };
  return (line, lineNo) => {
    const def = /^( {0,3}\[[^\]]+\]:\s*)(<[^>]*>|\S+)(.*)$/.exec(line);
    if (def) {
      const target = def[2].replace(/^<|>$/g, '');
      if (target.startsWith('#') || SCHEME.test(target)) return line;
      const hit = resolveChapter(target, ch, chapterBySkill);
      if (!hit) {
        throw new BuildError(ch.skill + ':' + lineNo + ': 引用式链接指向本书之外的本地目标，无法保证有效: ' + target);
      }
      return def[1] + hrefFor(hit) + def[3];
    }
    // 行内代码段原样保留，只处理其余片段
    return line.split(/(`+[^`]*`+)/).map((seg, k) => (k % 2 === 1 ? seg : rewriteInline(seg, lineNo))).join('');
  };
}

function renderChapter(mode, ch, chapterBySkill, problems) {
  const where = 'skills/' + ch.skill + '/SKILL.md';
  const body = dropLeadingH1(stripFrontmatter(readSkill(ch), where));
  const rewriteLine = makeLinkRewriter(mode, chapterBySkill, ch, problems);
  const shift = mode === 'book' ? 1 : 0;
  const text = eachLine(body, (line, inFence, no) => {
    if (inFence) return line;
    const h = /^ {0,3}(#{1,6})([ \t].*|)$/.exec(line);
    if (h) {
      const level = Math.min(6, Math.max(h[1].length, 2) + shift);
      return '#'.repeat(level) + rewriteLine(h[2], no);
    }
    return rewriteLine(line, no);
  }).replace(/\s+$/, '');
  return text;
}

function escapeLinkText(s) {
  return s.replace(/([\[\]])/g, '\\$1');
}

function buildBook(cfg, chapterBySkill, problems) {
  const parts = [];
  parts.push('# ' + cfg.titleZh, '', '**' + cfg.title + '**', '', '版本：' + cfg.version, '', '## 目录', '');
  for (const ch of cfg.chapters) parts.push('- [' + escapeLinkText(ch.heading) + '](#' + ch.anchor + ')');
  parts.push('');
  for (const ch of cfg.chapters) {
    parts.push('---', '', '<a id="' + ch.anchor + '"></a>', '', '## ' + ch.heading, '',
      renderChapter('book', ch, chapterBySkill, problems), '');
  }
  return parts.join('\n');
}

function buildSite(cfg, chapterBySkill, problems) {
  const files = new Map();
  const summary = ['# Summary', '', '- [' + escapeLinkText(cfg.titleZh) + '](index.md)'];
  const index = ['# ' + cfg.titleZh, '', '**' + cfg.title + '**', '', '版本：' + cfg.version, '', '## 目录', ''];
  for (const ch of cfg.chapters) {
    summary.push('  - [' + escapeLinkText(ch.heading) + '](' + ch.file + ')');
    index.push('- [' + escapeLinkText(ch.heading) + '](' + ch.file + ')');
    files.set(ch.file, '# ' + ch.heading + '\n\n' + renderChapter('site', ch, chapterBySkill, problems) + '\n');
  }
  files.set('SUMMARY.md', summary.join('\n') + '\n');
  files.set('index.md', index.join('\n') + '\n');
  return files;
}

// 输出路径护栏：out 不得等于、位于、或包含任何受保护的源路径（双向判定）。
const PROTECTED = ['.git', 'skills', 'docs', 'templates', 'checklists', 'template', 'scripts', '.github',
  'README.md', 'CONTRIBUTING.md', 'SKILL.md', 'LICENSE', 'book.config.json'];
const MARKER_SUFFIX = '.builddir';
const markerFor = (out) => out.replace(/[\\/]+$/, '') + MARKER_SUFFIX;

// 解析符号链接/junction：对最近的已存在祖先做 realpath，再拼回不存在的尾部。
function realResolve(p) {
  let cur = path.resolve(p);
  const tail = [];
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    tail.unshift(path.basename(cur));
    cur = parent;
  }
  return path.join(fs.realpathSync.native(cur), ...tail);
}

function inside(child, parent) {
  const norm = (x) => (process.platform === 'win32' ? x.toLowerCase() : x);
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertOutAllowed(out, root, what) {
  const realOut = realResolve(out);
  const realRoot = realResolve(root);
  for (const name of PROTECTED) {
    const p = path.join(realRoot, name);
    if (inside(realOut, p)) {
      throw new BuildError('--out 被拒绝（规则 A：out 等于或位于受保护路径之内）: ' + what + ' → ' + realOut +
        ' 命中受保护路径 ' + name);
    }
    if (inside(p, realOut)) {
      throw new BuildError('--out 被拒绝（规则 B：受保护路径位于 out 之内，即 out 等于或包含它）: ' + what +
        ' → ' + realOut + ' 包含受保护路径 ' + name);
    }
  }
}

// site 模式：已存在的目录必须有同级标记文件 <out>.builddir 才允许递归删除（标记放在目录外，避免被 mdbook 当作 src 内容复制）。
function prepareSiteOutDir(out) {
  if (!fs.existsSync(out)) return;
  if (!fs.statSync(out).isDirectory()) throw new BuildError('--out 已存在且不是目录: ' + out);
  if (!fs.existsSync(markerFor(out))) {
    throw new BuildError('--out 目录已存在但没有同级标记文件 ' + markerFor(out) + '，拒绝递归删除，请人工处理: ' + out);
  }
  fs.rmSync(out, { recursive: true, force: true });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = path.resolve(opts.root || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const out = path.resolve(opts.out);
  const cfg = loadConfig(root);
  const chapterBySkill = new Map(cfg.chapters.map((c) => [c.skill, c]));
  const problems = [];

  if (opts.mode === 'book') {
    assertOutAllowed(out, root, opts.out);
    const text = buildBook(cfg, chapterBySkill, problems);
    if (fs.existsSync(out) && fs.statSync(out).isDirectory()) {
      throw new BuildError('--out 是已存在的目录，book 模式需要文件路径: ' + out);
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.rmSync(out, { force: true });
    fs.writeFileSync(out, text, 'utf8');
    console.log('book: ' + path.relative(process.cwd(), out) + ' (' + Buffer.byteLength(text) + ' bytes, ' +
      (text.split('\n').length - 1) + ' lines, ' + cfg.chapters.length + ' chapters)');
  } else {
    const files = buildSite(cfg, chapterBySkill, problems);
    assertOutAllowed(out, root, opts.out);
    prepareSiteOutDir(out);
    fs.mkdirSync(out, { recursive: true });
    for (const [name, text] of files) fs.writeFileSync(path.join(out, name), text, 'utf8');
    fs.writeFileSync(markerFor(out), 'generated by scripts/build_book.mjs\n', 'utf8');
    console.log('site: ' + path.relative(process.cwd(), out) + ' (' + files.size + ' files; marker ' + path.relative(process.cwd(), markerFor(out)) + ')');
  }
  for (const p of problems) console.warn('warn: ' + p);
}

try {
  main();
} catch (e) {
  console.error('build_book 失败: ' + (e instanceof BuildError ? e.message : e && e.stack || e));
  process.exit(1);
}
