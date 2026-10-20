import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { satteri } from '@astrojs/markdown-satteri';
import { semanticBlocks } from './src/plugins/semantic-blocks.mjs';
import { cfg, ORIGIN, BASE, GITHUB_URL, chapterSlug } from './site.config.mjs';

export default defineConfig({
  site: ORIGIN,
  base: BASE,
  // three 单独成块：只在首屏场景被允许加载时才会按需下载，不进任何首屏入口
  vite: { build: { rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined) } } } },
  markdown: { processor: satteri({ hastPlugins: [semanticBlocks] }) },
  integrations: [
    starlight({
      title: cfg.title_zh,
      description: cfg.title,
      defaultLocale: 'root',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      social: [{ icon: 'github', label: 'GitHub', href: GITHUB_URL }],
      customCss: ['./src/styles/custom.css'],
      // 代码块（Expressive Code）：6px 圆角 + 1px 发丝边框 + 比页面更深的底；终端命令走 terminal 框（bash/sh 自动识别），文件名用 title="..."，
      // 关键行用 {3,5-6} 高亮——强调色 12% 底 + 左侧强调色条；增删行用 ins= / del=。无阴影、无模糊。颜色全部走 CSS 变量（custom.css），亮暗自动切换。
      expressiveCode: {
        styleOverrides: {
          borderRadius: '6px',
          borderColor: 'var(--mt-line-strong)',
          codeBackground: 'var(--mt-code-bg)',
          codeFontSize: '0.8125rem',
          codeLineHeight: '1.7',
        },
        // Starlight 会在主题上写入自己的 frames / textMarkers 覆盖（优先级高于上面的全局 styleOverrides），所以框与高亮行的颜色在这里最后改一遍。
        customizeTheme: (theme) => {
          theme.styleOverrides.frames = {
            ...theme.styleOverrides.frames,
            editorBackground: 'var(--mt-code-bg)',
            terminalBackground: 'var(--mt-code-bg)',
            editorActiveTabBackground: 'var(--mt-code-bg)',
            editorTabBarBackground: 'var(--mt-surface)',
            terminalTitlebarBackground: 'var(--mt-surface)',
            editorActiveTabIndicatorTopColor: 'var(--mt-accent)',
            editorActiveTabIndicatorHeight: '2px',
            frameBoxShadowCssValue: 'none',
            // 复制成功的提示气泡：品牌橙底 + 深色字（与复制按钮的勾选闪烁同色），不用默认绿色
            tooltipSuccessBackground: 'var(--mt-accent)',
            tooltipSuccessForeground: 'var(--mt-on-accent)',
          };
          theme.styleOverrides.textMarkers = {
            ...theme.styleOverrides.textMarkers,
            markBackground: 'color-mix(in srgb, var(--mt-accent) 12%, transparent)',
            markBorderColor: 'var(--mt-accent)',
          };
          return theme;
        },
      },
      // 最后更新日期由 sync.mjs 从 git 取并写进每页 frontmatter；取不到时写 false（不显示）。
      lastUpdated: true,
      components: {
        Head: './src/components/Head.astro',
        PageTitle: './src/components/PageTitle.astro',
        Footer: './src/components/Footer.astro',
        Sidebar: './src/components/Sidebar.astro',
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
