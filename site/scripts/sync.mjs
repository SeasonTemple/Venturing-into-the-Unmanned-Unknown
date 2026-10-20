// 把 skills/<skill>/SKILL.md 同步为 Starlight 内容集合 src/content/docs/*.md。
// 章节顺序与标题唯一真源：book.config.json（经 site.config.mjs 读取）；本脚本不含章节列表。
//
// 对每章只做这些事，其余正文逐字节保持：
//   1) 剥离 SKILL.md 自带的 YAML frontmatter，生成 Starlight frontmatter；
//   2) 剥离正文首个 H1（Starlight 会用 frontmatter.title 渲染页面 H1），
//      H1 里的副标（如「（Verification）」）并入 title，H1 全文保留为 description；
//   3) frontmatter 追加 lastUpdated（只读 git 取该文件最后一次提交时间）。
// 行尾（LF/CRLF）不做归一化。
//
// lastUpdated 降级规则：非 git 环境、浅克隆（git rev-parse --is-shallow-repository 为 true）、
// 或该文件没有提交历史时，一律不写日期（lastUpdated: false）并 warn，绝不拿 HEAD 日期冒充。
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg, repoRoot, BASE, TAGLINE, GITHUB_URL, chapterSlug } from '../site.config.mjs';
import { readChapters, splitKeepEnds } from './skill-source.mjs';
import { buildLlmsTxt, buildLlmsFull } from './llms.mjs';

const siteDir = fileURLToPath(new URL('../', import.meta.url));
const outDir = resolve(siteDir, 'src/content/docs');
if (!outDir.endsWith(sep + 'site' + sep + 'src' + sep + 'content' + sep + 'docs')) {
  throw new Error('拒绝清理非预期输出目录: ' + outDir);
}


// 只读 git：rev-parse / log。不执行任何写操作。
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function probeGit() {
  try {
    if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') return '不在 git 工作区内';
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') return '浅克隆（缺少完整历史，提交日期不可信）；CI 需 actions/checkout 的 fetch-depth: 0';
    return null;
  } catch (e) {
    return '无法运行 git（' + String(e.stderr || e.message).trim().split('\n')[0] + '）';
  }
}
const gitProblem = probeGit();
if (gitProblem) console.warn('warn: 最后更新日期不可用，所有章节页将不显示「最后更新」——' + gitProblem);

// 返回 ISO-8601（含时区）的最后提交时间，取不到返回 null（并 warn）。
function lastCommitDate(where) {
  if (gitProblem) return null;
  try {
    const d = git(['log', '-1', '--format=%cI', '--', where]);
    if (d) return d;
    console.warn('warn: ' + where + ' 没有提交历史（未提交/未跟踪），不显示最后更新');
  } catch (e) {
    console.warn('warn: 读取 ' + where + ' 的提交日期失败：' + String(e.stderr || e.message).trim().split('\n')[0]);
  }
  return null;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let dated = 0;
for (const { c, where, h1, body } of readChapters()) {
  // H1 末尾的括号副标（全角或半角）并入 title，不丢信息。
  const sub = /[（(][^（）()]+[）)]\s*$/.exec(h1);
  const title = c.label + ' ' + c.title + (sub ? sub[0].trim() : '');
  const when = lastCommitDate(where);
  if (when) dated++;
  const front = [
    '---',
    'title: ' + JSON.stringify(title),
    'description: ' + JSON.stringify(h1),
    'slug: ' + chapterSlug(c),
    // 不加引号：YAML 会解析为时间戳，Starlight 才把它当 Date。
    'lastUpdated: ' + (when ?? 'false'),
    'sidebar:',
    '  label: ' + JSON.stringify(c.label + ' ' + c.title),
    '---',
    '',
    '',
  ].join('\n');
  writeFileSync(resolve(outDir, chapterSlug(c) + '.md'), front + body);

  // 本地相对链接在 Starlight 下不会被改写，提示一下（外链、锚点除外；围栏代码块内忽略）。
  let fence = null;
  for (const line of splitKeepEnds(body)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
    if (fence) continue;
    for (const l of line.matchAll(/\]\(\s*<?([^)\s>]+)/g)) {
      if (!/^(?:#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(l[1])) console.warn('warn: ' + where + ' 含本地相对链接（不会被改写）: ' + l[1]);
    }
  }
}

// llms.txt / llms-full.txt：同一份 readChapters() 产物，输出到 src/generated/（gitignore），由 src/pages/llms*.txt.ts 发布。
const genDir = resolve(siteDir, 'src/generated');
mkdirSync(genDir, { recursive: true });
writeFileSync(resolve(genDir, 'llms.txt'), buildLlmsTxt());
writeFileSync(resolve(genDir, 'llms-full.txt'), buildLlmsFull());

// 首页数据：src/pages/index.astro 读取。章号、标题、顺序、版本都来自 book.config.json，
// 每章一句话取自 SKILL.md 的 description（readChapters 已解析），首页不手写任何章节信息。
const BLURB_MAX = 40;
function blurb(desc) {
  const sents = desc.split('。').map((x) => x.trim()).filter(Boolean);
  // 首句是「AI-Native SDLC xxx指南」式的题名，取第二句（「指导 Agent …」）；第二句是「当用户…」时退回首句冒号后的部分。
  const s = sents.slice(1).find((x) => !x.startsWith('当用户')) ?? sents[0].replace(/^[^：]*：/, '');
  const body = s.replace(/^(?:用于)?指导\s*Agent(?:\s*与团队)?\s*/, '');
  const fit = (parts, sep) => {
    let out = '';
    for (const p of parts) {
      const next = out ? out + sep + p : p;
      if ([...next].length > BLURB_MAX) break;
      out = next;
    }
    return out;
  };
  return fit(body.split('，'), '，') || fit(body.split('、'), '、');
}
const home = {
  title: cfg.title,
  title_zh: cfg.title_zh,
  version: cfg.version,
  license: 'BSL 1.1',
  tagline: TAGLINE,
  github: GITHUB_URL,
  chapters: readChapters().map(({ c, skillDescription }) => ({
    order: c.order,
    label: c.label,
    title: c.title,
    slug: chapterSlug(c),
    blurb: blurb(skillDescription),
  })),
};
writeFileSync(resolve(genDir, 'home.json'), JSON.stringify(home, null, 2) + '\n');

console.log('synced ' + cfg.chapters.length + ' chapters + home.json -> ' + outDir + ' (base ' + BASE + ', lastUpdated ' + dated + '/' + cfg.chapters.length + ')');
