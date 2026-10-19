# Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook

**迈向无人区：AI 原生软件工程指南**（短名：AI-Native SDLC Guidebook）

[![License](https://img.shields.io/badge/license-BSL%201.1-555?style=flat-square&labelColor=2b2f36)](./LICENSE)
[![Version](https://img.shields.io/badge/version-v0.0.1-555?style=flat-square&labelColor=2b2f36)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases)
[![Validate Skills](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml/badge.svg?style=flat-square)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml)
[![Pages](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/pages.yml/badge.svg?style=flat-square)](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/)
[![Release](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/release.yml/badge.svg?style=flat-square)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases)

以 AI Agent 为一级生产力，人负责意图、约束与裁决的软件工程方法；全书按生命周期组织，并提供可直接加载的 Agent Skills（`SKILL.md`）。

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

也可从 [Releases](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases) 下载源码 `tar.gz`、技能包 `zip`、合并单文件 `BOOK.md`（首个 Release 发布前可能为空）。
按需外部依赖（第三方内容，不随本项目打包；来源与许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)）：`npx skills add danyuchn/asd-ste100-skill`、`npx skills add younes-io/agent-skills --skill tla-check`。

## 使用顺序与原则

第 0 章对齐原则 → 1 意图与验收 → 2 边界、契约与风险路径 → 4 实现 → 3 / 5 验证与测试 → 6 过门禁交付 → 7 信号驱动演进 → 8 维护最小工具集。

**缺意图不设计、缺契约不实现、缺门禁不发布。**

设计原则：意图先行 · 风险驱动 · 可检查、可回归 · 表达低歧义 · 资产化 · 人机分工（Agent 生产，人裁决）。

## 贡献与引用

见 [CONTRIBUTING.md](./CONTRIBUTING.md)（授权条款、勘误流程、内容公约、改动同步清单）；新增章节请复制 [template/SKILL.md](./template/SKILL.md)。引用本书见 [CITATION.cff](./CITATION.cff)。

## 许可

**Business Source License 1.1**（Licensor: SeasonTemple）· Change Date: **2030-10-19** · Change License: **Apache License 2.0**。允许生产使用，但不得作为竞争性托管服务 / 付费技能市场商品进行主要再分发或转售。详见 [LICENSE](./LICENSE)。

## 版本

**v0.0.1** —— 首个公开快照（章节与技能齐套）。
