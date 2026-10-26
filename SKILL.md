---
name: ai-native-sdlc-guidebook
description: >
  AI-Native SDLC 全书索引。用于按环节路由到意图、设计、验证、实现、测试、交付、演进
  与工具生态等子技能。当用户询问 AI 原生软件工程流程、不知道该用哪一章、或要求从总览
  进入具体环节时使用。
---

# Venturing into the Unmanned Unknown · 索引

**Venturing into the Unmanned Unknown: An AI-Native Software Engineering Guidebook**

## 何时使用

- 用户问「AI-Native SDLC 是什么 / 怎么做」
- 任务跨多个环节，需要先路由
- 用户不知道该加载哪一章技能

## 路由表

| 用户意图 | 使用技能 |
|----------|----------|
| 这是什么 / 原则是什么 | `ai-native-sdlc-introduction` |
| 写需求 / 澄清验收 / 可执行规格 | `ai-native-sdlc-intent-requirements` |
| 做架构 / 定接口 / 不变量 / 可仿真边界 | `ai-native-sdlc-design-architecture` |
| 做验证 / 选形式化或有界检查手段 | `ai-native-sdlc-verification` |
| 开始编码 / 按契约实现 | `ai-native-sdlc-implementation` |
| 补测试 / 属性·Expect·DST·质量策略 | `ai-native-sdlc-testing-quality` |
| 合并发布 / 回滚门禁 | `ai-native-sdlc-integration-delivery` |
| 线上问题 / 回归演进 / 审阅纪律 | `ai-native-sdlc-continuous-evolution` |
| 装工具 / 管 Skill | `ai-native-sdlc-tools-skills-ecosystem` |
| 查总清单 / 术语 / 反模式 | `ai-native-sdlc-appendix` |

## 默认纪律

1. 缺意图不设计
2. 缺契约不实现
3. 缺门禁不发布
4. 修缺陷必补回归
5. 表达保持低歧义；冲突时优先补可执行例子
6. 重型验证与全系统仿真按风险启用，不默认全开
