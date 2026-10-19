// llms.txt / llms-full.txt 内容生成。正文来自 skill-source.mjs（与站点页面同一份），不另写一份。
import { cfg, ORIGIN, BASE, TAGLINE, chapterSlug } from '../site.config.mjs';
import { readChapters } from './skill-source.mjs';

export const siteUrl = (path) => ORIGIN + BASE + '/' + path;
const chapterUrl = (c) => siteUrl(chapterSlug(c) + '/');

export function buildLlmsTxt() {
  const items = readChapters().map(({ c, skillDescription }) =>
    '- [' + c.label + ' ' + c.title + '](' + chapterUrl(c) + '): ' + skillDescription);
  return [
    '# ' + cfg.title_zh,
    '',
    '> ' + TAGLINE,
    '',
    '- 英文名：' + cfg.title,
    '- 版本：' + cfg.version,
    '- 站点：' + siteUrl(''),
    '',
    '## 章节',
    '',
    ...items,
    '',
    '## 全文',
    '',
    '- [llms-full.txt](' + siteUrl('llms-full.txt') + '): 全部章节正文按章节顺序拼接成的单个纯文本文件',
    '',
  ].join('\n');
}

export function buildLlmsFull() {
  const head = [
    cfg.title_zh,
    cfg.title,
    '版本：' + cfg.version,
    '站点：' + siteUrl(''),
    '',
    '说明：本文件由站点构建时自动生成，按 book.config.json 的章节顺序拼接各章正文。',
    '正文来自 skills/<skill>/SKILL.md，去掉 SKILL.md 自带的 frontmatter 与首个 H1，其余原文保留；',
    'CRLF 行尾统一为 LF；章节标题行（「# 第 N 章 …」）与「来源」行由生成器添加。章节索引见 ' + siteUrl('llms.txt') + '。',
  ].join('\n');
  const parts = readChapters().map(({ c, body }) =>
    '# ' + c.label + ' ' + c.title + '\n\n来源：' + chapterUrl(c) + '\n\n' + body.replace(/\r\n/g, '\n').replace(/\s+$/, ''));
  return head + '\n\n' + parts.map((p) => '=====\n\n' + p).join('\n\n') + '\n';
}
