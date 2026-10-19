# 贡献指南

感谢参与 **Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook**（迈向无人区：AI 原生软件工程指南）。

本文只写这本书特有的约定。Fork、分支、提交 PR 的通用流程请看 GitHub 官方的 [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)，这里不重复。

## 目录

- [你可以贡献什么](#你可以贡献什么)
- [授权](#授权)
- [勘误流程](#勘误流程)
- [大改写先开 issue](#大改写先开-issue)
- [内容公约](#内容公约)
- [一处改动要同步哪几处](#一处改动要同步哪几处)
- [不要做的事](#不要做的事)
- [行为准则](#行为准则)

## 你可以贡献什么

- **勘误**：事实错误、错别字、失效链接、与技能正文不一致之处
- **表述改进**：让表达更低歧义、更可检查，不改变原意
- **模板与清单补充**：`templates/` 下的工程模板、`checklists/` 下的清单、语言专项附录
- **技能触发条件**：改进 `SKILL.md` 的 `description`，让 Agent 在正确的场景加载正确的章节；对接工具的说明
- **CI 改进**：`.github/workflows/` 下的校验与发布流程

## 授权

提交 PR 即表示你同意：你的贡献以本项目的许可证 **Business Source License 1.1** 提供（见 [LICENSE](./LICENSE)），并随本作品一同适用其中的 Change Date / Change License 条款。请确认你有权提交所贡献的内容，不要提交无法按此条款授权的第三方材料；需要引用或依赖第三方内容时，请同步更新 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 勘误流程

1. **先搜已有 issue**（含已关闭的）：https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/issues
2. 没有重复项再新开 issue，并写清：
   - **位置**：章（以 `book.config.json` 中的章标签为准，如“第 3 章”或“附录”）、小节标题、对应 `skills/<目录名>/SKILL.md`
   - **原文引用**：粘贴有问题的原句
   - **问题与建议**：错在哪里，建议如何改
3. 小的勘误可以直接提 PR，并在 PR 描述里写明同样的位置与引用。

> **提醒**：在线站点由源码自动构建，可能落后于 `main`，也可能与最新发布的 Release 不同步。站点上看到的问题，可能已在源码中修好但尚未部署；反过来，源码里的问题也可能站点上还没出现。报告前请先对照仓库 `main` 分支的源码确认，并注明你看的是站点还是源码、哪个版本。

## 大改写先开 issue

下列改动**必须先开 issue 讨论，达成一致后再动手**，不要直接提 PR：

- 重写或大段改写某一章
- 新增、删除、合并、调整章节顺序
- 改变核心口号或设计原则
- 引入新的外部依赖（技能、工具）

流程细节见官方 [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)。

## 内容公约

- 每个技能一个目录：`skills/ai-native-sdlc-<topic>/SKILL.md`
- `SKILL.md` 的 frontmatter **必填** `name` 与 `description`，不可为空
- `name` **必须等于目录名**（CI 会校验，见 `.github/workflows/validate-skills.yml`）
- `description` **必须含触发场景**，说明在什么情形下应加载该技能
- 新增章节可从 [`template/SKILL.md`](./template/SKILL.md) 复制骨架（该文件不参与构建）
- 文件为 UTF-8 Markdown
- 术语与清单保持同步：同一术语在各章、附录与 `checklists/` 中用法一致

## 一处改动要同步哪几处

| 你改了 | 必须同步 |
|--------|----------|
| 章节标题 | `book.config.json` 中对应 `chapters[].title`，以及 README 的「章节一览」表 |
| 章节顺序、新增或删除章节 | `book.config.json`（章节顺序的唯一真源）、README「章节一览」表、对应 `skills/` 目录，以及根目录 `SKILL.md` 的路由表 |
| 技能目录名或 `name` | 目录名与 `name` 保持一致，并同步 `book.config.json` 的 `skill`、README 章节表、根目录 `SKILL.md` 路由表 |
| 版本号 | README 的「版本」段、徽章与 `book.config.json` 的 `version`、`CITATION.cff` 的 `version` / `date-released`；**先同步这些，再打 tag** |
| 外部依赖（`npx skills add ...`） | README「快速安装」、根目录 `SKILL.md`，以及 `THIRD_PARTY_NOTICES.md` |

> 章节顺序只认 `book.config.json`；脚本与文档都不要再硬编码一份章节列表。

## 不要做的事

- 不要默认引入重型定理证明作为必选项
- 不要提交密钥
- 不要在一个 PR 里混入无关重构

## 行为准则

尊重贡献者；讨论聚焦工程方法与文档质量；争议以可执行、可检查、成本可控为优先。
