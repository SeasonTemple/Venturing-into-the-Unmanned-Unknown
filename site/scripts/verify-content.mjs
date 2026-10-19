// 独立校验「正文零改写」：不复用 sync.mjs 的解析函数，直接按字节对比。
// 规则：生成文件 = Starlight frontmatter + 源文件去掉(自身 frontmatter、首个 H1 行及其前后空行)后的原文。
// 即：生成文件正文 与 源文件正文「删去首个 H1 行」逐字节一致（仅允许首部空行差异）。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { cfg, repoRoot, chapterSlug } from '../site.config.mjs';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
let bad = 0;

for (const c of cfg.chapters) {
  const srcPath = resolve(repoRoot, 'skills', c.skill, 'SKILL.md');
  const src = readFileSync(srcPath);
  const gen = readFileSync(resolve(docs, chapterSlug(c) + '.md'));

  // 源：去 BOM、去 frontmatter。
  let s = src.toString('latin1').replace(/^\xEF\xBB\xBF/, '');
  const fm = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(s);
  if (fm) s = s.slice(fm[0].length);
  const h1 = /^(?:[ \t]*\r?\n)*# [^\n]*\n/.exec(s);
  // 源正文 = 首个 H1 之后、去掉其后的空行。
  const srcBody = s.slice(h1[0].length).replace(/^(?:[ \t]*\r?\n)+/, '');

  // 生成：去掉我们写的 frontmatter（两个 --- 之间 + 一个空行）。
  const g = gen.toString('latin1');
  const gfm = /^---\n[\s\S]*?\n---\n\n/.exec(g);
  const genBody = g.slice(gfm[0].length);

  const same = genBody === srcBody;
  const h1Count = (genBody.match(/^# /gm) || []).length;
  const srcAllH1 = (s.match(/^# /gm) || []).length;
  // 不是「首个 H1 以外」被改写：源正文里「# 」开头的行（含围栏代码块内的）数量应为 srcAllH1 - 1，且与生成物一致。
  const ok = same && h1Count === srcAllH1 - 1;
  if (!ok) bad++;
  console.log(
    (ok ? 'OK  ' : 'FAIL') + ' ' + chapterSlug(c).padEnd(4) + ' bodyBytes=' + String(genBody.length).padEnd(6) +
      ' sha256[:16]=' + sha(Buffer.from(genBody, 'latin1')) + '/' + sha(Buffer.from(srcBody, 'latin1')) +
      ' removedH1=' + JSON.stringify(Buffer.from(h1[0].trim(), 'latin1').toString('utf8')) +
      ' leftoverLinesStartingWith"# "=' + h1Count + '(src ' + (srcAllH1 - 1) + ')' +
      ' srcCRLF=' + (s.includes('\r\n')),
  );
}
if (bad) { console.error(bad + ' 章正文与源不一致'); process.exit(1); }
console.log('全部 ' + cfg.chapters.length + ' 章：生成正文与 skills/*/SKILL.md 去 frontmatter、去首个 H1 后逐字节一致');
