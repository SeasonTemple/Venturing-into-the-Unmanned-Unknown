# Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook

**迈向无人区：AI 原生软件工程指南**（短名：AI-Native SDLC Guidebook）

[![License](https://img.shields.io/badge/license-BSL%201.1-555?style=flat-square&labelColor=2b2f36)](./LICENSE)
[![Version](https://img.shields.io/badge/version-v0.0.3-555?style=flat-square&labelColor=2b2f36)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases)
[![Validate Skills](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml/badge.svg?style=flat-square)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml)
[![Pages](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/pages.yml/badge.svg?style=flat-square)](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/)
[![Release](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/release.yml/badge.svg?style=flat-square)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases)

**AI Agent 为生产与执行主体**；人提供原始意图输入，并作为权重较高的 HITL 裁决源之一，与可执行规格、自动门禁等系统保证共同约束交付。全书按生命周期组织，并提供可直接加载的 Agent Skills（`SKILL.md`）。

## 章节直达

在线站点（Astro Starlight，GitHub Pages）：<https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/>。章节顺序以 [`book.config.json`](./book.config.json) 为唯一真源。

| 章 | 标题 | 在线阅读 | Skill 目录 |
|----|------|----------|-----------|
| 0 | 导论 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch0/) | `ai-native-sdlc-introduction` |
| 1 | 意图与需求 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch1/) | `ai-native-sdlc-intent-requirements` |
| 2 | 设计与架构 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch2/) | `ai-native-sdlc-design-architecture` |
| 3 | 验证 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch3/) | `ai-native-sdlc-verification` |
| 4 | 实现 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch4/) | `ai-native-sdlc-implementation` |
| 5 | 测试与质量保障 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch5/) | `ai-native-sdlc-testing-quality` |
| 6 | 集成与交付 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch6/) | `ai-native-sdlc-integration-delivery` |
| 7 | 持续演进 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch7/) | `ai-native-sdlc-continuous-evolution` |
| 8 | 工具与技能生态 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/ch8/) | `ai-native-sdlc-tools-skills-ecosystem` |
| 附录 | 清单 / 术语 / 反模式 | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/chA/) | `ai-native-sdlc-appendix` |

**AI Agent 友好**：站点提供 [`/llms.txt`](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/llms.txt) 与 [`/llms-full.txt`](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/llms-full.txt)，可直接喂给 Agent。

## 快速安装

```bash
git clone https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown.git
cd Venturing-into-the-Unmanned-Unknown
cp -R skills/* .claude/skills/   # 或 .agents/skills/ / .cursor/skills/
```

也可从 [Releases](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases) 下载源码 `tar.gz`、技能包 `zip`、合并单文件 `BOOK.md`。
按需外部依赖（第三方内容，不随本项目打包；来源与许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)）。模型检查等示例：`npx skills add younes-io/agent-skills --skill tla-check`。英语 STE 检查仅为可选，见意图章。

## 使用顺序与原则

第 0 章对齐角色与原则 → 1 意图输入与可执行验收（允许渐进完备）→ 2 边界、契约、不变量与可仿真边界 → 4 实现 → 3 / 5 验证与测试（按风险）→ 6 系统门禁与交付 → 7 信号驱动演进与 HITL 纪律 → 8 最小工具集。

**缺意图不设计、缺契约不实现、缺门禁不发布。**

原则：意图先行 · 风险驱动 · 可检查可回归 · 可执行规格优先 · 快速可读反馈 · 表达以对齐为目的 · 资产化 · **Agent 主体 + 人意图/HITL + 系统保证**。手段跨语言；重型验证/仿真按成熟度与风险启用。

## 贡献与引用

见 [CONTRIBUTING.md](./CONTRIBUTING.md)；新增章节请复制 [template/SKILL.md](./template/SKILL.md)。引用见 [CITATION.cff](./CITATION.cff)。发版见 [docs/release-process.md](./docs/release-process.md) 与 [docs/release-notes/](./docs/release-notes/)。

## 许可

**Business Source License 1.1**（Licensor: SeasonTemple）· Change Date: **2030-10-19** · Change License: **Apache License 2.0**。允许生产使用，但不得作为竞争性托管服务 / 付费技能市场商品进行主要再分发或转售。详见 [LICENSE](./LICENSE)。

## 版本

- 版本：**v0.0.3**
- 状态：方法论持续修订于 `main`（角色模型、意图渐进完备、形式化验证专节、DST/Expect、搜索修复等）；正式 Release 以 tag 为准
