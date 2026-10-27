---
name: ai-native-sdlc-guidebook
description: >
  AI-Native SDLC 全书索引。Agent 为生产主体时，按环节路由到意图、设计、验证、实现、测试、交付、
  演进与工具生态等子技能。当用户询问 AI 原生软件工程流程、角色分工、或不知道该用哪一章时使用。
---

# Venturing into the Unmanned Unknown · 索引

**Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook**

## 角色（全书默认）

| 角色 | 含义 |
|------|------|
| **Agent** | 生产与执行主体 |
| **人** | 原始意图输入；HITL 裁决源之一（通常权重更高） |
| **系统保证** | 可执行规格、测试/验证、CI 门禁、仿真等可重复约束 |

## 何时使用

- 用户问「AI-Native SDLC 是什么 / 怎么做 / 谁是主体」
- 任务跨多个环节，需要先路由
- 用户不知道该加载哪一章技能

## 路由表

| 用户意图 | 使用技能 |
|----------|----------|
| 这是什么 / 原则 / 角色 | `ai-native-sdlc-introduction` |
| 写需求 / 澄清验收 / 渐进完备 | `ai-native-sdlc-intent-requirements` |
| 做架构 / 定接口 / 不变量 / 可仿真边界 | `ai-native-sdlc-design-architecture` |
| 做验证 / 形式化手段 | `ai-native-sdlc-verification` |
| 开始编码 / 按契约实现 | `ai-native-sdlc-implementation` |
| 补测试 / 属性·Expect·DST | `ai-native-sdlc-testing-quality` |
| 合并发布 / 门禁回滚 | `ai-native-sdlc-integration-delivery` |
| 线上问题 / 演进 / HITL 纪律 | `ai-native-sdlc-continuous-evolution` |
| 装工具 / 管 Skill | `ai-native-sdlc-tools-skills-ecosystem` |
| 查总清单 / 术语 / 反模式 | `ai-native-sdlc-appendix` |

## 默认纪律

1. 缺意图不设计
2. 缺契约不实现
3. 缺门禁不发布
4. 修缺陷必补回归
5. 表达以对齐为目的；冲突时优先补可执行例子
6. 重型验证与全系统仿真按风险启用
7. 门禁失败时停止推进；风险裁决可上升 HITL
