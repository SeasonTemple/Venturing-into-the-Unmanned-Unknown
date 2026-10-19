# 第三方声明

本项目（<https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown>）的 README 与根目录 `SKILL.md` 将下列两项列为「按需外部依赖」。它们是**第三方**项目，不属于本项目的 Licensed Work，也不受本项目 Business Source License 1.1 约束。

## 声明

- 本项目**不打包、不内嵌、也不再分发**下列第三方内容；仓库与发布制品（源码 tar.gz、技能包 zip、BOOK.md）中不含其代码或文本。
- 用户通过各自的安装命令从其来源获取，使用时适用其各自的许可条款。
- 许可状态一栏仅记录本项目是否已核实；标为「未核实」者，使用前请自行确认。

## 依赖清单

| 名称 | 来源仓库 | 安装命令 | 用途 | 许可状态 |
|------|----------|----------|------|----------|
| asd-ste100-skill | https://github.com/danyuchn/asd-ste100-skill | `npx skills add danyuchn/asd-ste100-skill` | 低歧义表达（ASD-STE100 简化技术英语）相关技能，对应设计原则“表达低歧义” | 未核实，使用前请自行确认 |
| tla-check（位于 younes-io/agent-skills） | https://github.com/younes-io/agent-skills | `npx skills add younes-io/agent-skills --skill tla-check` | TLA+ 规约检查技能，用于第 3 章“验证”中可选的形式化手段 | 未核实，使用前请自行确认 |

> 「用途」一栏为本项目依据技能名称及其在本书中的引用位置所作的说明，未逐一核对上游仓库的当前内容；来源仓库 URL 由 `npx skills add` 的参数推得，**未验证**其当前是否存在或可访问。

## 变更

新增或移除外部依赖时，请同步更新本文件、README「快速安装」与根目录 `SKILL.md`（见 [CONTRIBUTING.md](./CONTRIBUTING.md)）。
