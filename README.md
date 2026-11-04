# Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook

**迈向无人区：AI 原生软件工程指南**（短名：AI-Native SDLC Guidebook）

[![License](https://img.shields.io/badge/license-BSL%201.1-555?style=flat-square&labelColor=2b2f36)](./LICENSE)
[![Version](https://img.shields.io/badge/version-v0.0.4--draft-555?style=flat-square&labelColor=2b2f36)](https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/tree/docs/verification-centric-v0.0.4)

**Agent 为生产与执行主体。** 生成成本下降后，瓶颈在**正确性证据**：可执行规格、验证与测试、**性质级门禁**；人提供意图输入并作为 HITL 裁决源之一。

> 草稿分支：`docs/verification-centric-v0.0.4`（章节顺序已调整为 实现→验证→测试）。合并 `main` 前以该分支为准。

## 章节顺序（阅读 / Skill）

在线站点在合并并部署后更新。顺序真源：[`book.config.json`](./book.config.json)。

| 章 | 标题 | Skill |
|----|------|-------|
| 0 | 导论 | `ai-native-sdlc-introduction` |
| 1 | 意图与需求 | `ai-native-sdlc-intent-requirements` |
| 2 | 设计与架构 | `ai-native-sdlc-design-architecture` |
| 3 | 实现 | `ai-native-sdlc-implementation` |
| 4 | 验证 | `ai-native-sdlc-verification` |
| 5 | 测试与质量保障 | `ai-native-sdlc-testing-quality` |
| 6 | 集成与交付 | `ai-native-sdlc-integration-delivery` |
| 7 | 持续演进 | `ai-native-sdlc-continuous-evolution` |
| 8 | 工具与技能生态 | `ai-native-sdlc-tools-skills-ecosystem` |
| A | 清单 / 术语 / 反模式 / 局限 | `ai-native-sdlc-appendix` |

**推荐路径：** 0 角色与瓶颈 → 1 意图 → 2 设计 → 3 实现 → **4+5 正确性层** → 6 门禁交付 → 7 演进 → 8 工具。

## 原则（摘要）

缺意图不设计 · 缺契约不实现 · **缺性质级门禁不发布** · 可执行规格优先 · Agent 主体 + 意图/HITL + 系统保证。

## 许可

Business Source License 1.1 · Licensor: SeasonTemple · 详见 [LICENSE](./LICENSE)。
