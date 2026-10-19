// 章节正文的唯一读取入口：sync.mjs、llms.txt / llms-full.txt 端点共用，不允许各自再解析一遍。
// 真源 = skills/<skill>/SKILL.md；顺序/标题 = book.config.json。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cfg, repoRoot } from '../site.config.mjs';

export const splitKeepEnds = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
const isBlank = (line) => /^[ \t]*\r?\n?$/.test(line);

const fail = (msg) => { throw new Error('skill-source: ' + msg); };

// 返回 { fm, h1, body }：fm 为 SKILL.md 自带 frontmatter 的原文（无则空串）；
// h1 为首个 H1 的文本；body 为其后紧随空行之后的原文（逐字节保留）。
export function splitSkill(raw, where) {
  const text = raw.replace(/^\uFEFF/, '');
  const m0 = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  const afterFm = m0 ? text.slice(m0[0].length) : text;
  const lines = splitKeepEnds(afterFm);
  let i = 0;
  while (i < lines.length && isBlank(lines[i])) i++;
  const m = i < lines.length ? /^# +(\S.*?)[ \t]*\r?\n?$/.exec(lines[i]) : null;
  if (!m) fail(where + ': frontmatter 之后的第一个非空行必须是 H1（# 标题）');
  i++;
  while (i < lines.length && isBlank(lines[i])) i++;
  return { fm: m0 ? m0[1] : '', h1: m[1], body: lines.slice(i).join('') };
}

// 只支持 SKILL.md 里实际出现的两种写法：description: 单行标量 / description: > 折叠标量。
export function skillDescription(fm, where) {
  const lines = fm.split(/\r?\n/);
  const at = lines.findIndex((l) => /^description:/.test(l));
  if (at < 0) fail(where + ': frontmatter 缺 description');
  const first = lines[at].replace(/^description:\s*/, '').trim();
  if (!/^[>|][+-]?$/.test(first)) return first.replace(/^(["'])(.*)\1$/, '$2');
  if (first[0] === '|') fail(where + ': description 用了 | 块标量，未支持');
  const parts = [];
  for (let j = at + 1; j < lines.length && (/^\s+\S/.test(lines[j]) || lines[j].trim() === ''); j++) {
    if (lines[j].trim()) parts.push(lines[j].trim());
  }
  // YAML 折叠标量把换行折成空格；SKILL.md 在中文处断行，两侧有一侧是 CJK 时不应插入空格。
  const cjk = (ch) => ch > '\u2e80';
  return parts.reduce((acc, p) => (!acc ? p : acc + (cjk(acc.at(-1)) || cjk(p[0]) ? '' : ' ') + p), '');
}

export function readChapters() {
  return cfg.chapters.map((c) => {
    const where = 'skills/' + c.skill + '/SKILL.md';
    let raw;
    try { raw = readFileSync(resolve(repoRoot, where), 'utf8'); } catch (e) { fail('读不到 ' + where + ': ' + e.message); }
    const s = splitSkill(raw, where);
    return { c, where, ...s, skillDescription: skillDescription(s.fm, where) };
  });
}
