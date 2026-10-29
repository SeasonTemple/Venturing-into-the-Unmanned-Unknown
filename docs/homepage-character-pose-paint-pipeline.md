# 整姿态画稿回导与四阶段控制样本

**后续实际进展：** 四张静态底稿已经继续制作成 [全身换重片段与可回改动画工程](homepage-character-whole-pose-motion.md)，没有停在回导工具。本文记录静态与回导阶段的范围；当前头颈、上身与持物响应见该短片，完整自然步态仍未通过。

2026-10-29。此次补齐的是**可改完整轮廓的二维画稿回导**，并重做了一组静态轮廓控制样本。没有通过自然步态，也没有制作新的动画。

## 静态复核的结果

`raster08` 的原审核图硬编码四个标题，再与九张图 `zip`，实际只展示原画及前三个姿态；后五个姿态没有进入审核图。标题也没有与实际姿态对应：全脚支撑被标成左腿经过，左腿经过被标成左脚落地。修复后的完整图确认，经过、接触和换重仍有不可信的剪刀状腿形。八个参数姿态拼自旧轮廓数据，不能等同于八张重新绘制的完整关键姿态。

新的 [四阶段静态图](../prototypes/visual-direction/actor-pose-source-v01/keyposes-review.png) 来自显式编排的膝位置、裤腿边界、鞋姿和层序，仍复用原画衣料取样。这改善了原试验明显的交叉轮廓，但不是完整人体重绘，也不能证明负重动作自然。

四张分别是右腿承重、左腿前摆、左脚跟落地、换到左腿承重。**这是为隔离腿交叉问题而做的短步控制样本，不是此前规划的同一只脚“跟着地—全掌—前掌—趾离地”四相位验收。** 完整四相位、另一脚、其他机位、起停和转身仍未完成。

目前的限制是：头、躯干、双臂和装备仍使用同一刚体画面；裤料明暗与衣褶沿用站姿；接触说明是编排意图，尚未由完整空间与连续运动证实。`artApproved`、`walkCycleValidated`、`homepageIntegrated` 均为 false。

## 为什么补回导

旧 `finish-actor-poses.py` 规定修绘不得改变 alpha，适合已经合格的轮廓内部修饰，但不能擦除错误膝形或重画鞋底。新 `export-actor-pose-paint.py` 直接读取每张完整 ORA 的实际图层，可修改轮廓、颜色、头颈肩、肢体与器物，不重新用轮廓程序覆盖画稿。

- 保留共同画布、原图层名及正常混合；可增加绘画层。支持裁切图层的 x/y 偏移、图层不透明度与显隐。根组保持可见、正常混合、满不透明度；嵌套组或其他混合先栅格化。
- 从图层合成实际输出，不把 ORA 中可能过期的 `mergedimage.png` 当作结果。
- 源身份图、共享分层、共享衣料或姿态配方改变时，旧画稿停止回导，要求重新检查对应关系。
- 检查所有姿态后才创建输出；已有导出目录不会覆盖。修改一个姿态不会重生成其他姿态；输出继续保留可编辑 ORA。
- 这一接口允许重画，不提供人体绘制能力。工程校验不会将画稿或动作标记为通过。

## 实际验证

[验证记录](research/actor-pose-paint-checks.json) 使用隔离副本完成：四张未改画稿回导一致；在第三张擦除膝外缘并加测试色块，21 个像素变化、其中 14 个改变透明轮廓，其他三张不变；把图层裁切后按偏移回导，并特意不更新缓存合成图，仍输出实际图层；第二次重开导出相同。配方改变、共享图层改变、最后一张画布损坏均在输出前拒绝。原始输入没有被测试修改。

测试色只在 `.lab/pipeline-decision/pose-paint-check02/`，没有进入候选资产。这些是回改与版本检查结果，不是美术或接地验收。

## 可继续制作的源

[源目录](../prototypes/visual-direction/actor-pose-source-v01/) 包含：

- `keyposes.spec.json`：静态轮廓控制配方。
- 四张同尺寸 PNG 与 ORA：裤腿、靴子、完整上身、局部画层可回改。
- `working-cloth.ora`：共享衣料；`authoring.json`：输入版本与审核图覆盖范围。
- `review-status.json`：实际检查范围和未通过项。

重新生成控制底稿与回导画稿是两个入口。生成器只用于需要重新设计底稿时；已经修改 ORA 后使用回导器，并将结果放入新目录。

```powershell
# 编辑完整 ORA 后回导，不重新生成它的轮廓
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/export-actor-pose-paint.py --recipe prototypes/visual-direction/actor-pose-source-v01/keyposes.spec.json --pose-source prototypes/visual-direction/actor-pose-source-v01 --out-dir .lab/actor-pose-paint-next

# 在隔离副本验证回改；每次使用新目录
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/check-actor-pose-paint.py --recipe prototypes/visual-direction/actor-pose-source-v01/keyposes.spec.json --source-dir prototypes/visual-direction/actor-pose-source-v01 --out-dir .lab/actor-pose-paint-check-next
```

## 本次方法取舍

保留原画身份、二维分层、完整姿态画稿、版本检查与图集运行结构。撤回“横截面取样加端点插值就能补齐自然人物动作”的生产假设；显式轮廓仅保留作底稿控制。

接下来需要实际重画完整关键姿态的体积、衣褶及肩胸—骨盆—持物响应。先由制作者检查完整人物，再检验少量相邻过渡；当前四张控制样本不进入动作扩帧或正式首页。生成服务与三维动作参照仍是可替换的辅助，不能代替缺失的姿态美术。
