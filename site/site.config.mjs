// 站点级共享配置：astro.config.mjs 与 scripts/*.mjs 共用。
// 章节顺序、标题、版本的唯一真源是仓库根的 book.config.json；这里不含任何章节列表。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const cfg = JSON.parse(readFileSync(new URL('../book.config.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

export const GITHUB_URL = 'https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown';
export const TAGLINE = 'Agent 为生产主体；人提供意图输入并参与 HITL 裁决；可执行规格与门禁提供系统保证。';

const strip = (s) => s.replace(/\/+$/, '');

export const ORIGIN = strip(process.env.SITE_ORIGIN || 'https://seasontemple.github.io');
export const BASE = '/' + strip((process.env.SITE_BASE || cfg.slug).replace(/^\/+/, ''));

export const chapterSlug = (c) => 'ch' + c.order;
