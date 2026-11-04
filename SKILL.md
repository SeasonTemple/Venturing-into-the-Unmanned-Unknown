---
name: ai-native-sdlc-guidebook
description: >
  AI-Native SDLC 全书索引。Agent 为生产主体；瓶颈在正确性证据与性质级门禁。按环节路由子技能。
---

# Venturing into the Unmanned Unknown · 索引

## 角色与瓶颈

| 项 | 约定 |
|----|------|
| Agent | 生产与执行主体 |
| 人 | 意图输入；HITL 裁决源之一 |
| 系统保证 | 可执行规格、验证/测试、CI |
| 瓶颈 | 可独立检查的正确性证据，而非生成速度 |

## 路由表

| 用户意图 | 技能 |
|----------|------|
| 定义 / 角色 / 瓶颈 | `ai-native-sdlc-introduction` |
| 意图 / 验收 / 已知未知 | `ai-native-sdlc-intent-requirements` |
| 架构 / 契约 / 可仿真边界 | `ai-native-sdlc-design-architecture` |
| 编码实现 | `ai-native-sdlc-implementation` |
| 形式化验证 / 模型检查 | `ai-native-sdlc-verification` |
| 测试 / 属性 / Expect / DST | `ai-native-sdlc-testing-quality` |
| 门禁 / 发布 / 回滚 | `ai-native-sdlc-integration-delivery` |
| 演进 / HITL 纪律 | `ai-native-sdlc-continuous-evolution` |
| 工具链 | `ai-native-sdlc-tools-skills-ecosystem` |
| 清单 / 术语 / 局限 | `ai-native-sdlc-appendix` |

## 默认纪律

1. 缺意图不设计
2. 缺契约不实现
3. 缺性质级门禁不发布
4. 修缺陷必补回归
5. 绿灯须声明已查性质与未覆盖性质
6. 门禁失败则停止；风险可上升 HITL
