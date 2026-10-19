# 自托管字体（仅 Latin 子集）

中文字体一律走系统字体栈，不自托管（体积不可接受）。三款字体均为 SIL OFL 1.1，许可证文本见同目录 LICENSE-*.txt。

| 文件 | 来源 | 处理 |
| --- | --- | --- |
| inter-latin-wght.woff2 | npm `inter-ui@4.1.1`（Inter 官方 InterVariable.woff2） | pyftsubset 子集到 Latin（U+0020-007E、U+00A0-00FF、常用标点/箭头）；opsz 轴固定 14，wght 轴限 400-700；**保留** GSUB 特性 cv02 cv03 cv04 cv11 tnum pnum calt case locl。Fontsource 现成的 latin 子集会剥掉 cv*，所以没有直接用 |
| jetbrains-mono-latin-wght.woff2 | npm `@fontsource-variable/jetbrains-mono@5.3.0` latin | 原样 |
| instrument-serif-latin-400.woff2 | npm `@fontsource/instrument-serif@5.3.0` latin 400 | 原样（仅单一字重 400，仅用于标题的拉丁字母与数字） |

字体由 `src/styles/custom.css` 的 @font-face 引用（Vite 会加哈希并自动带 base），预加载在 `src/components/Head.astro`。
