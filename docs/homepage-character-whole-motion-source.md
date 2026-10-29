# 完整动作参照与本轮制作结果

> 当前 `actor-balance-reference-v01` 也已撤回为失败样本：用户指出左膝反折，复核确认 11 处腿／帧出现反向屈膝。页面 `actor-production.html?revision=balance01` 保留用于复现，不再推荐为动作依据。v02 与 balance01 均未通过；新的无负重转移基准见 [FK 01 制作记录](homepage-character-fk-baseline.md)，自然负重动作与最终人物美术仍未通过。

2026-10-29。入口：[完整动作制作台](../prototypes/visual-direction/actor-production.html)。当前 `body03` 没有解决自然行走；本轮不继续用局部参数修订掩盖这个问题。

## 实际完成与尚未完成

完成了有来源的完整动作参照：CMU 07_01 的 ASF 骨架、120fps AMC 行走记录，经层级旋转解析为世界坐标关节点，再转移到现有可编辑三维代理，按固定相机导出 48 帧、24fps 的有限片段。包含完整人物、整数两倍近看、场景同步位移、逐帧查看、关节点叠加、暂停、进度定位和离线短片。

这份代理用灰色显示，**不替换人物身份或原野像素美术**。原人物的像素行走、完整关键姿态绘制、起停、转身和闭合循环仍未完成。`artApproved`、`walkingApproved`、`productionIntegrated` 均保持 false。

原记录是非负重行走；双手持物的摆幅收敛是本地改编。脚底通过实际求值后的鞋网格将整个人落到地面，尚无水平脚点 IK；不可声称无滑步。箱体各组成部分共享握点位移并保持世界朝向，记录器仍附着原手。负重肩、肘和箱体滞后仍需后续完整姿态美术与运动审核。

## 本轮淘汰了什么

四张 MMX 图片均保留在 `art-pack-media/loaded-walk-whole-v01…v04.jpg`，不接入动作。

| 候选 | 结果 | 结论范围 |
| --- | --- | --- |
| v01 | 1024 方图、人设标注、风格不符；原请求经过 `.cmd` 的多行参数没有完整传入 | 属于调用链问题，不将它当作模型服从完整八帧提示的试验 |
| v02 | 实际提交了完整中文提示、2048×1024 和人物参考；产生十个人物、写实化、箱体变大、器物丢失和朝向变化 | 人物参考不能保证严格的动作表、风格与器物连续 |
| v03 | 四格布局得到满足，风格仍写实，器物消失或被重新解释 | 布局服从不等于完整人物可用 |
| v04 | 强化派生像素参考后出现像素色块，但人物变化、方向错误、两个箱子与器物错误仍存在 | 风格改善不能抵消身份和操作连续性失败 |

共取得四张图片；另一次长度超限请求被参数校验拒绝，没有返回图片。没有提交新视频或 Tripo 任务。MMX 当前登录为 OAuth，视频配额格式标为未包含；没有借 H3 名称绕过其凭据要求。

本地还试了 `build-actor-reference-poses.py`：完整动作记录驱动原画衣料取样，48 帧保存于 `.lab/whole-walk/transfer01/`。实际全身对照仍可见衣领、袖口和裤腿变形，因此撤下，不把这条纹理转移路线推荐为成品。真实动作输入能改善运动依据，不能补足原画中缺少的衣物形体与遮挡。

## 可回改交付和验证

- `actor-motion-reference-v02/motion-reference.blend`：完整关键帧工程与代理。
- `reference.json`：源帧、投影关节点、移动量、改编范围与未通过项。
- `reference-atlas.png`：48 帧固定相机图集，网页仅解码一次。
- `motion-reference.mp4`／`reference-keyposes.png`：有限片段和全身姿态。
- `source/`：CMU ASF/AMC 源文件、出处与使用条款摘录、代理资产的 MakeHuman CC0 许可。

保存重开 `.blend` 后重新渲染第 1、13、31 帧，RGBA 与首次导出一致，记录在 `reopen-checks.json`。这验证动画和附属器物可以从工程恢复，不证明自然步态或成品美术已通过。

独立浏览器实测了播放、暂停冻结、逐帧、定位、离屏停止与恢复；390px 手机无横向溢出，也没有自动播放。原尺寸与场景画面均检查。页面共用同一动作时钟，静止、后台和所有预览离屏时不保留运行循环。没有完成十分钟性能验收。

复现时保留旧输出，使用新目录：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/sample-cmu-walk.py --source-dir prototypes/visual-direction/actor-motion-reference-v02/source
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/build-actor-mocap-reference.py --out-dir .lab/whole-walk/rebuild
```

运动源：[CMU subject 7](https://mocap.cs.cmu.edu/search.php?subjectnumber=7)，原站点标注第 1 段为 walk、120fps。[使用说明](https://mocap.cs.cmu.edu/faqs.php)允许复制、修改、再分发。CMU 同时声明不保证数据质量，故实际动作仍自行检查。

## 管线经验

运动来源、角色形体与画风是三个不同问题。已有动作记录可以纠正凭感觉编排的步态；三维代理可以提供连续体积、相机与遮挡；它们都不能直接给出已认可人物的完整像素画。下一道缺口是匹配这个人物的姿态美术，需要有实际完整绘制或有效局部编辑能力，不能再写成若干参数即可“精修完成”。

技术调用也必须可核对。本机实际为 PowerShell 7.6.9，`PSNativeCommandArgumentPassing=Windows`；不能仅由使用 PS7 推断 `.cmd` 多行参数安全。`scripts/mmx-file-prompt.mjs` 以 Node `spawn(..., {shell:false})` 直接执行已安装的 MMX 入口，将提示词作为独立 argv，先拒绝达到 1500 字符的图片提示。完整请求通过 dry-run 核对过人物参考、尺寸、种子和末尾约束；没有修改 MMX 凭据。

通用技能只补入“真实动作参照与负重改编的边界”；本站身份、CMU 片段、工具路径、配额和失败图留在项目记录。

## 承重与右臂修正：balance01

用户指出重心与右肘异常，复核后确认是本地转移错误。v02 漏掉骨盆侧移与转动，通过最低鞋底顶点将整个人上下移动；手臂在既有姿态上叠加独立旋转，导致肩—肘—腕不连贯。鞋底接地不能据此推断身体承重正确。

新版由 `scripts/retarget_actor_balance.py` 统一转移完整骨盆运动，按目标身体比例解算双腿和双臂，并保留原始膝盖弯曲平面。主支撑和换脚时的后脚脚尖、前脚脚跟分别检查实际鞋底，避免只修低脚而让另一接触脚悬空。右臂保持约 14.7–15.8° 屈肘（伸直为 0°），手腕与箱体保持握点关系；左右器物不互换。

人体 75kg、箱体 3kg、记录器 0.35kg 是简化假设。通过分段质量估算和有界骨盆补偿，使目标质心轨迹接近来源轨迹；这是运动学改编，没有做动力学平衡或负重步态验证。不能要求动态行走的质心投影每帧都位于单脚范围内，也不能以估算曲线代替实际姿态审核。

交付目录：`prototypes/visual-direction/actor-balance-reference-v01/`。包含可回改工程、48 帧图集、视频、`reference.json`、`evaluation-checks.json`，以及 `review/three-view-review.png` 的正面、提箱侧、三分之四四组姿态。网页增加可关闭的质心投影、鞋底接触标记和右肘读数。

保存重开后全 48 帧关节点与记录一致，第 1、13、31 帧重新渲染的 RGBA 一致，握点偏移保持一致。实际接触鞋底高度与踝目标误差均低于 1mm。网页播放、暂停、逐帧、定位、离屏停止与恢复、减少动态及 390px 布局已检查；这不构成自然运动验收或十分钟性能验收。

尚未处理原始捕捉中的水平脚底滑移，尚无起步、转身、收步或闭合循环。原人物原画保持不变，不接正式首页。本轮未调用新的图片、视频或 Tripo 生成。`walkingApproved`、`artApproved`、`physicalBalanceProven`、`productionIntegrated` 继续为 false。

复现顺序：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/sample-cmu-walk.py
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/build-actor-mocap-reference.py --balance-transfer --out-dir .lab/whole-walk/balance-rebuild
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/review-actor-balance.py --source-dir .lab/whole-walk/balance-rebuild --out-dir .lab/whole-walk/balance-rebuild/review
```

管线教训：先核对完整根运动、目标比例和关节链的绝对变换，再做脚点与握点约束；逐视角检查承重和器物接触后才能进入风格绘制。来源是真实捕捉，不代表本地转移自动正确。

## balance01 撤回：膝盖反折与方法复核

用户截图指出画面右侧的左膝内凹。首次回应把注意力放在接地标记与重心上，漏看了明显的关节反折；前一轮侧面对照也未正确识别这个问题。这是视觉审核失败，不能由“灰模”或“尚未美术验收”来弱化。

独立复核原始 ASF 膝轴、AMC 屈膝通道以及导出模型的髋—膝—踝坐标，确认旧版有 11 处腿／帧反向屈膝，均发生在来源膝盖接近伸直的阶段。第 1 帧左膝沿原始关节轴的有符号屈曲约 −9.7°，来源接近 0°。坐标与方向来自完整源骨架，未用原求解器自行报告的误差代替检查。

根因：`source_knee - target_hip` 不是可靠的弯曲方向。来源髋、膝、踝共线时，三点无法确定膝关节弯曲平面；目标比例、脚点与骨盆的改动会让该方向选中反向解。求解器此前未保留原始解剖关节轴，也未限制反向分支。踝目标误差接近零、鞋底贴地、保存重开一致，均不能排除这个错误。

诊断试验在采样阶段保留 ASF 膝轴，并与原始 AMC 屈膝通道逐帧核对；每次骨盆或脚点调整后，以该轴重新确定合法弯曲方向。试验消除了反折，但第 1 帧左膝由来源接近 0° 变为约 20°，整段仍有明显的屈膝曲线偏差。这证明接地与假设质心补偿还在改写原始姿态，不能把“反折消除”宣布为动作自然。

- 可复现检查：`scripts/check-actor-knee-axis.py`。
- 实测报告：[膝关节轴向审计](research/actor-knee-axis-audit.json)。
- 画面对照：[旧版与轴向修正试验](images/homepage-knee-axis-rejection.png)。
- 试验工程：`.lab/whole-walk/knee-axis01/`，不替换公开预览或正式首页。

后续制作基准必须重建：先直接复现源骨架的完整 FK 动作，再在目标绑定静止姿态校准后转移，并同时对照源与目标的完整姿态、关节方向及屈伸曲线。先让无负重动作转移成立，再加入持物约束。撤掉未经验证的假设质心追踪作为质量依据；接触修正必须有幅度限制和来源偏差记录，无法同时满足时明确失败，不能靠不断移动骨盆来强行满足脚点。

此次证据否定的是当前自写转移实现和验收方式，不足以否定三维预渲染管线。尚未验证任何替代工具能直接产出本站目标角色；本轮没有新增收费媒体调用。
