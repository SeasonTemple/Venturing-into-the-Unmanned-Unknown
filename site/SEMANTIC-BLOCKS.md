# 语义块样式（公理 / 不变量 / 约束 / 反模式）

本轮只提供样式钩子，**不改 skills/ 里的正文**。正文以后要用，有两种写法：

## 1. blockquote + 加粗关键词（推荐，纯 Markdown，GitHub 上也能正常显示）

```markdown
> **公理**：在无人区，意图先于实现。
> 后续行照常缩进。

> **不变量 I1**：任何合并的变更都必须附带可回放的验证证据。

> **约束**：Agent 不得绕过门禁直接写主干。

> **反模式**：让 Agent 自己验收自己的产出。
```

规则（`src/plugins/semantic-blocks.mjs`，remark 插件，构建期执行）：blockquote 的**第一段的第一个节点是加粗文本，且以 公理 / 不变量 / 约束 / 反模式 开头**，
就给这个 blockquote 加 `class="mt-block mt-axiom|mt-invariant|mt-constraint|mt-antipattern"` 与 `data-mt-block`。关键词后可接空格、编号、冒号。
不满足条件的普通引用块不受影响（例如导论里的定义引用块不会被误伤）。

## 2. 直接写 HTML class

```html
<div class="mt-block mt-axiom">

**公理**：……

</div>
```

（`div` 内部要空行隔开，Markdown 才会继续解析。）

## 配色

| 类 | 含义 | 暗色 | 亮色 |
| --- | --- | --- | --- |
| `.mt-axiom` | 公理（靛蓝） | #6c8cff | #3d5bd6 |
| `.mt-invariant` | 不变量（绿） | #2fb886 | #12805a |
| `.mt-constraint` | 约束（琥珀） | #e0a030 | #a56a00 |
| `.mt-antipattern` | 反模式（红，虚线边框） | #ee5d5d | #c0302f |

样式在 `src/styles/custom.css` 的「阅读页正文 · 引用块 / 语义块」一节，统一用 `--mt-block-color` 变量，改色只改这一个变量。
几何与普通引用块完全一致：2px 色条 + 6% 淡底 + 右侧 6px 圆角、无外框（普通引用块的色条用品牌橙）；反模式额外加上下两条 1px 虚线。
