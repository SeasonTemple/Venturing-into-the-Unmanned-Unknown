// 站点级共享配置：astro.config.mjs 与 scripts/*.mjs 共用。
// 章节顺序、标题、版本的唯一真源是仓库根的 book.config.json；这里不含任何章节列表。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const cfg = JSON.parse(readFileSync(new URL('../book.config.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

export const GITHUB_URL = 'https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown';
export const TAGLINE = '以 AI Agent 为一级生产力，人负责意图、约束与裁决的软件工程方法。';

const strip = (s) => s.replace(/\/+$/, '');

// GitHub Pages 项目站点：https://<owner>.github.io/<repo>/ 。
// 环境变量可覆盖（CI 里由 configure-pages 的输出注入）；缺省值取自 book.config.json 的 slug。
export const ORIGIN = strip(process.env.SITE_ORIGIN || 'https://seasontemple.github.io');
export const BASE = '/' + strip((process.env.SITE_BASE || cfg.slug).replace(/^\/+/, ''));

export const chapterSlug = (c) => 'ch' + c.order;

// 「编辑此页」：指向真源 skills/<skill>/SKILL.md（生成的 chN.md 不在仓库里，指过去是 404）。
// 经 frontmatter.editUrl 逐页注入；Starlight 的 editLink.baseUrl 只能拼生成文件路径，故不用。
export const EDIT_BRANCH = 'main';
export const editUrlFor = (c) => GITHUB_URL + '/edit/' + EDIT_BRANCH + '/skills/' + c.skill + '/SKILL.md';
