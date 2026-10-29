# 全身换重片段：连续制作与回改

**撤回推荐（2026-10-29）：** 用户指出第 13 帧完整姿态不成立。重新对照实际图像后，膝部轮廓过窄、踝鞋连接扭折，末尾姿态无法清楚表达承重转换；持设备的手臂仍沿用近似叉腰轮廓，握持关系也不清楚。该片段仅保留为失败的表面变形试验，不作为人物动作成果或后续扩帧基线。下文的技术检查及已修问题保留为工程记录，不表示全身美术通过。下一步必须先获得可信的完整关键姿态，不能继续用旧站姿取样和增加控制点替代姿态制作。单张二维投影不足以认定膝关节解剖上反向弯曲，也未提供实测质心。

2026-10-29。实际交付 [v02 全身换重短片](../prototypes/visual-direction/actor-whole-pose-v02/whole-pose.mp4)，13 张姿态、10fps，含首尾保持共 2.5 秒。固定同一机位，展示右脚承重、左腿前摆、左跟落地、转到左腿承重。它是有限的二维表面动画候选，仍未通过完整行走美术验收。

## 本轮实际推进的部分

四张控制姿态继续推进为整段过渡，没有停在静态评审或工具说明：

- 头、颈、胸和腰部沿同一连续控制链响应。脸部保持原像素大小并跟随颈部，不再将头钉住后单独横移胸腹。
- 双臂按原画重新对齐肩、肘、腕与握点。左腕位于记录器右上侧，握点靠近其顶沿；原画器物分层还包含部分手部像素，目前一同随前臂变换，不假称已经有独立完整手掌资产。
- 箱体围绕移动握点保留小幅独立回摆，记录器随持握前臂。原画左右装备没有交换。
- 13 帧的中间膝、踝控制单独编排，轮廓宽度在已选底稿间作有限过渡。接触阶段分别记录趾、跟锚点，过渡并非重新播放已撤回的 FK 或旧 lane 动画。
- 每一帧保留完整 ORA，姿态修绘回导后重新生成图集、视频和关键帧评审图。

这是源画表面变形、显式轮廓控制和少量姿态修绘，**不是完整逐帧重绘的衣物动画**。控制点用于二维画面，不是人体解剖实测，也没有进行动力学平衡求解。

## 制作中发现并修正的问题

### 分层像素属于错误运动部位

躯干源层残留袖缘、内肘以及一段手套边缘。整组姿态第一次生成时，袖子与残片分别跟随手臂和胸部，出现断线。准备源层时共调整 285 个像素的归属，覆盖并记录到 `source-layer-preparation.json`，不改原始人物图。中立上身与原合成逐像素一致。

这里不能简单以“孤立像素少于几个”决定归属：内肘有一块仍与躯干相连的衣料，也需要按所处表面区分。隐藏覆盖只补袖子后方需要的衣料；最终肩部一处像素缺口另作姿态专用修绘，绑定对应底稿版本。

### 采样边界裁掉头发像素

表面只覆盖到不透明边界时，小数平移会把头顶最外行像素裁掉。最近邻取样本身不能防止这个问题。为表面的外边界增加两像素几何留白，内部网格保持原位；透明区域外的采样仍不写入图像。

实际对照脸部可见 RGBA，而非 alpha=0 下无意义的 RGB。修正后，13 帧脸部在对应平移位置的可见像素与原图一致，没有独立缩放头部。`actor-whole-pose-v01` 保留撤回状态；当前查看 v02。

### 负空间与实际破洞分开检查

手腕—外套之间和弯臂内部本来就有背景空隙，不能按透明小孔的数量全部填掉。肩帽连接区检查实际缺口，腕部负空间保留。接触检查确认的是实际鞋层在锚点附近有像素，并不证明整块鞋底平面、解剖方向或动态承重成立。

## 检查范围

已检查原尺寸全身、约 104px 场景尺寸、全部上身与腿部连续帧。逐帧核对脸部可见像素、肩帽连接、鞋与器物的图像连接、保存 ORA 合成与 PNG 一致、图集实际帧与 PNG 一致，以及末尾保持帧。13 帧的上身实际图像均发生变化，头部实际边界有六个不同位置。

完整 ORA 重开回导得到相同姿态；修绘后重打包，视频使用实际修绘帧。H.264 视频 900×900、25 帧、2.5 秒，约 167KB；单张透明图集约 181KB。没有将这份候选接入正式首页，也没有做完整行走、转向、多机位鞋底或十分钟场景运行验收。

详细记录：[检查摘要](research/actor-whole-pose-checks.json)、[完整逐帧检查](../prototypes/visual-direction/actor-whole-pose-v02/whole-pose-checks.json)、[当前限制](../prototypes/visual-direction/actor-whole-pose-v02/review-status.json)。

## 回改与复现

源目录：`prototypes/visual-direction/actor-whole-pose-v02/`。包含四张全身控制配方、13 帧完整配方与 ORA/PNG、工作分层、修绘记录、图集、视频和逐帧条带。

```powershell
# 重新生成控制底稿；这不会重放后续姿态修绘
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/build-actor-whole-pose-study.py --keyposes prototypes/visual-direction/actor-whole-pose-v02/control-keyposes.spec.json --out-dir .lab/whole-pose-rebuild-next

# 在 ORA 中修画后，回导到新目录
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/export-actor-pose-paint.py --recipe prototypes/visual-direction/actor-whole-pose-v02/motion.spec.json --pose-source prototypes/visual-direction/actor-whole-pose-v02 --out-dir .lab/whole-pose-painted-next

# 用实际修绘帧重做全部预览，不重生人物
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/build-actor-whole-pose-study.py --repack-source prototypes/visual-direction/actor-whole-pose-v02 --out-dir .lab/whole-pose-painted-next

E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/check-actor-whole-pose.py .lab/whole-pose-painted-next
```

新目录保留上一份画稿和预览。若共享分层或姿态配方改变，先重审底稿与修绘对应关系，不能自动套回旧修绘。下一层工作仍是完整衣物姿态美术与交替步态；这份短片不自动成为循环、起停或路径行进素材。
