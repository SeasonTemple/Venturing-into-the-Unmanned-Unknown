# Venturing into the Unmanned Unknown

[![License: BSL 1.1](https://img.shields.io/badge/License-Business%20Source%20License%201.1-blue)](./LICENSE)
[![Version v0.0.1](https://img.shields.io/badge/version-v0.0.1-orange)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases)
[![Validate Skills](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml/badge.svg)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/actions/workflows/validate-skills.yml)

**Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook**

中文名：**迈向无人区：AI 原生软件工程指南**

以 AI Agent 为一级生产力，人负责意图、约束与裁决的软件工程方法。  
全书按生命周期组织，并提供可直接加载的 Agent Skills（`SKILL.md`）。

仓库：https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown

---

## 目录

- [这是什么](#这是什么)
- [命名说明](#命名说明)
- [目录结构](#目录结构)
- [章节一览](#章节一览)
- [下载](#下载)
- [快速安装](#快速安装)
- [推荐使用顺序](#推荐使用顺序)
- [设计原则](#设计原则)
- [贡献](#贡献)
- [许可](#许可)
- [版本](#版本)

---

## 这是什么

**AI-Native SDLC** 不是“用 AI 写一点代码”，而是：

- Agent 承担主要生产
- 人定义目标与门禁
- 全流程可检查、可回归、可协作

本仓库同时是：

1. **指南正文**（按章节阅读）
2. **可安装技能包**（供 Claude Code / Cursor / Codex 等加载）

---

## 命名说明

| 用途 | 名称 |
|------|------|
| 完整书名（英文） | Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook |
| 完整书名（中文） | 迈向无人区：AI 原生软件工程指南 |
| 短名 | AI-Native SDLC Guidebook |
| GitHub 仓库 | `Venturing-into-the-Unmanned-Unknown` |

---

## 目录结构

```text
Venturing-into-the-Unmanned-Unknown/
├── README.md
├── SKILL.md                    # 全书索引技能（按意图路由到各章）
├── LICENSE
├── CONTRIBUTING.md
├── CITATION.cff                # 引用元数据
├── THIRD_PARTY_NOTICES.md      # 第三方依赖声明
├── book.config.json            # 章节顺序的唯一真源
├── skills/                     # 各章技能：skills/ai-native-sdlc-<topic>/SKILL.md
├── template/                   # 新增章节用的 SKILL.md 骨架（仅供复制，不参与构建）
├── templates/                  # 工程模板（ADR、意图、接口契约、复盘）
├── checklists/
├── docs/
└── .github/workflows/          # CI：validate-skills / release-check
```

---

## 章节一览

章节顺序以 [`book.config.json`](./book.config.json) 为唯一真源。

| 章 | 标题 | Skill | 在线阅读 |
|----|------|-------|----------|
| 0 | 导论 | `ai-native-sdlc-introduction` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 1 | 意图与需求 | `ai-native-sdlc-intent-requirements` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 2 | 设计与架构 | `ai-native-sdlc-design-architecture` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 3 | 验证 | `ai-native-sdlc-verification` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 4 | 实现 | `ai-native-sdlc-implementation` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 5 | 测试与质量保障 | `ai-native-sdlc-testing-quality` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 6 | 集成与交付 | `ai-native-sdlc-integration-delivery` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 7 | 持续演进 | `ai-native-sdlc-continuous-evolution` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 8 | 工具与技能生态 | `ai-native-sdlc-tools-skills-ecosystem` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |
| 附录 | 清单 / 术语 / 反模式 | `ai-native-sdlc-appendix` | [阅读](https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/) |

在线站点由 mdbook 自动构建并发布到 GitHub Pages（<https://seasontemple.github.io/Venturing-into-the-Unmanned-Unknown/>）；站点启用前链接暂不可访问。

---

## 下载

每个 [Release](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases) 提供三种制品：

| 制品 | 说明 |
|------|------|
| 源码 `tar.gz` | 仓库源码快照 |
| 技能包 `zip` | 可直接复制到 `.claude/skills/` 等目录的各章技能 |
| 全书 `BOOK.md` | 按章节顺序合并的单文件全书 |

全部版本见 Releases 页：<https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases>。首个 Release 发布前该页可能为空，此时请使用下方「快速安装」从源码获取。

---

## 快速安装

```bash
git clone https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown.git
cd Venturing-into-the-Unmanned-Unknown
cp -R skills/* .claude/skills/   # 或 .agents/skills/ / .cursor/skills/
```

按需外部依赖（第三方内容，本项目不打包；来源与许可状态见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)）：

```bash
npx skills add danyuchn/asd-ste100-skill
npx skills add younes-io/agent-skills --skill tla-check
```

---

## 推荐使用顺序

1. 第 0 章对齐原则
2. 第 1 章写清意图与验收
3. 第 2 章定边界、契约与风险路径
4. 第 4 章在边界内实现
5. 第 3 / 5 章验证与测试
6. 第 6 章过门禁后交付
7. 第 7 章信号驱动演进
8. 第 8 章维护最小工具集

**缺意图不设计、缺契约不实现、缺门禁不发布。**

---

## 设计原则

- 意图先行
- 风险驱动
- 可检查、可回归
- 表达低歧义
- 资产化
- 人机分工：Agent 生产，人裁决

---

## 贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)：可贡献内容、授权条款、勘误流程、内容公约与「一处改动要同步哪几处」清单。

引用本书请见 [CITATION.cff](./CITATION.cff)。

---

## 许可

本项目采用 **Business Source License 1.1**。

- Licensor: SeasonTemple
- Licensed Work: Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook
- Change Date: 2030-10-19
- Change License: Apache License 2.0
- 允许生产使用，但不得作为竞争性托管服务 / 付费技能市场商品进行主要再分发或转售

详见 [LICENSE](./LICENSE)。第三方内容的声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

---

## 版本

- 版本：**v0.0.1**
- 状态：首个公开快照（章节与技能齐套）
