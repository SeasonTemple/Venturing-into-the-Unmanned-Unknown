import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import { semanticBlocks } from './src/plugins/semantic-blocks.mjs';
import { cfg, ORIGIN, BASE, GITHUB_URL, chapterSlug } from './site.config.mjs';

export default defineConfig({
  site: ORIGIN,
  base: BASE,
  markdown: { processor: satteri({ hastPlugins: [semanticBlocks] }) },
  integrations: [
    starlight({
      title: cfg.title_zh,
      description: cfg.title,
      defaultLocale: 'root',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      social: [{ icon: 'github', label: 'GitHub', href: GITHUB_URL }],
      customCss: ['./src/styles/custom.css'],
      // 最后更新日期由 sync.mjs 从 git 取并写进每页 frontmatter；取不到时写 false（不显示）。
      lastUpdated: true,
      components: {
        Head: './src/components/Head.astro',
        PageTitle: './src/components/PageTitle.astro',
        Footer: './src/components/Footer.astro',
      },
      sidebar: [
        {
          label: '正文',
          items: cfg.chapters.map((c) => ({ slug: chapterSlug(c) })),
        },
      ],
    }),
  ],
});
