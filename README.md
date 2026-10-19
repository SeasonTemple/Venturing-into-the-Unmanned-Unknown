# Venturing into the Unmanned Unknown

**Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook**

中文名：**迈向无人区：AI 原生软件工程指南**

以 AI Agent 为一级生产力，人负责意图、约束与裁决的软件工程方法。  
全书按生命周期组织，并提供可直接加载的 Agent Skills（`SKILL.md`）。

仓库：https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown

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
├── SKILL.md
├── LICENSE
├── CONTRIBUTING.md
├── skills/
├── templates/
├── checklists/
└── docs/
```

---

## 章节一览

| 章 | 标题 | Skill |
|----|------|-------|
| 0 | 导论 | `ai-native-sdlc-introduction` |
| 1 | 意图与需求 | `ai-native-sdlc-intent-requirements` |
| 2 | 设计与架构 | `ai-native-sdlc-design-architecture` |
| 3 | 验证 | `ai-native-sdlc-verification` |
| 4 | 实现 | `ai-native-sdlc-implementation` |
| 5 | 测试与质量保障 | `ai-native-sdlc-testing-quality` |
| 6 | 集成与交付 | `ai-native-sdlc-integration-delivery` |
| 7 | 持续演进 | `ai-native-sdlc-continuous-evolution` |
| 8 | 工具与技能生态 | `ai-native-sdlc-tools-skills-ecosystem` |
| 附录 | 清单 / 术语 / 反模式 | `ai-native-sdlc-appendix` |

---

## 快速安装

```bash
git clone https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown.git
cd Venturing-into-the-Unmanned-Unknown
cp -R skills/* .claude/skills/   # 或 .agents/skills/ / .cursor/skills/
```

按需外部依赖：

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

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 许可

本项目采用 **Business Source License 1.1**。

- Licensor: SeasonTemple
- Licensed Work: Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook
- Change Date: 2030-10-19
- Change License: Apache License 2.0
- 允许生产使用，但不得作为竞争性托管服务 / 付费技能市场商品进行主要再分发或转售

详见 [LICENSE](./LICENSE)。

---

## 版本

- 版本：0.1.0
- 状态：可发布初版（章节与技能齐套）
