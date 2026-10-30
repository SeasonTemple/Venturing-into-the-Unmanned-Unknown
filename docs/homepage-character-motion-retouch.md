# 负重动作局部修绘与逐帧预览 v04

后续进展：[v05 整身步序、持续行进与停步对照](homepage-character-gait-study.md)。v04 修绘和原帧保留，未套到新姿态。

2026-10-28。接着 v03 的同朝向负重短步，检查左右弯膝的衣料。保留 v03 原帧和工程，在独立目录试作有限的衣褶候选；正式首页未修改，没有新增媒体生成调用。

预览：启动现有 `prototypes/visual-direction/serve.mjs` 后，访问 [逐帧对照](http://127.0.0.1:4395/actor-motion-review.html?revision=cloth04)。[静帧对照](../prototypes/visual-direction/actor-rig-v04/actor-v04-knee-comparison.png) 可直接查看。

## 实际新增

- 对右腿 8–16 帧、左腿 18–28 帧试作小块折面和压缩暗部，共 20 帧；其余 29 帧与 v03 完全一致。每帧的改动限制在膝部，透明轮廓、头、手、握点和鞋底保持原输出。
- 修绘按该帧实际膝点定位，按每次换步的独立包络出现、收起。这是程序辅助像素簇候选，不能代替完整衣料绘制或自然度验收。
- 每帧对应独立 ORA，保留不可改的 `base_render` 和可改的 `fold_shadow`、`cloth_turn`。底图 RGBA 摘要与输出摘要均参与检查，打包也拒绝来源不匹配的帧。
- 新预览提供两版同步、整个人物原始尺寸、膝部整数四倍放大、约 104px 的场景显示尺度、逐帧、半速、单次播放及按需循环。拖动暂停，原生进度条支持方向键和 Home / End。默认静止，后台与离屏停止计时，不自动恢复播放。
- 页面只解码两张固定图集，当前合计约 3.63MB 文件数据；解码像素约 47MB，不含浏览器额外副本。无需为每帧创建新图像或持有增长的帧缓存。

## 已验证与尚未通过

[像素范围检查](../prototypes/visual-direction/actor-rig-v04/actor-v04-validation.json) 确认全部帧保持轮廓 alpha，改动不涉及头、握点、鞋底。[真实回改检查](../prototypes/visual-direction/actor-rig-v04/actor-v04-edit-validation.json) 在隔离副本中修改第 23 帧一个画层像素，实际导出后只影响该帧；故意修改最后一帧的底图时，整批导出被拒绝，已有结果不被部分覆盖。旧 v02 的回导检查也重新通过。

浏览器实测原生进度条方向键与 Home / End、两版切换、拖动暂停、12fps 与半速、单次结束、按需循环、真实滚动离屏暂停、减少动态下刷新保持静止，以及 320px/390px 宽度无横向溢出。文档隐藏事件通过模拟检查；没有宣称完成各操作系统后台行为测试。截图和实测记录位于 `.lab/actor-motion-browser/`。

静帧和相邻帧条带检查中，候选差异克制，没有选用横贯裤腿的整条色带。但这仍是**局部衣褶试作**：不能据此认定原短步的重心、负重感和裤料体积已经自然。`artApproved` 与 `temporalArtApproved` 均保持 false。未扩为转身、多方向、循环步态或现场移动。

## 后续回改

编辑当前帧的 ORA 后，在仓库根目录执行：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/finish-actor-poses.py --recipe prototypes/visual-direction/actor-rig-v04/actor-v04-retouch.recipe.json
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/prepare-actor-motion-retouch.py --package-only
```

不要重新执行初次 author 操作覆盖现有画稿。若骨架底帧改变，另建修绘版本，逐帧检查后转移仍适用的画层。需验证实际回改时运行 `scripts/check-actor-motion-retouch.py`；浏览器检查运行 `node scripts/check-actor-motion-review.mjs`。

这次沉淀的管线经验：**姿态修绘也有时间关系**。关节点帮助定位，包络帮助安排出现，但都不能保证衣料表面正确；必须检查进出阶段的相邻帧并同步对照，避免“关键帧成立、播放时补丁闪现”。这条经验已提炼到技能的[制作管线参考](../.agents/skills/unmapped-pixel-art/references/editable-character-pipeline.md)，具体帧号、文件和命令只保留在项目中。

下一道关口仍是同一朝向完整动作的自然度。先判断整身重心和步态，再决定需不需要改关键姿态，不能继续只补膝部像素来宣称走路完成。
