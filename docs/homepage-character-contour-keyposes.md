# 完整静态姿态：轮廓试作

2026-10-28。本轮制作承重准备、左腿经过、左脚落地三个完整静态姿态，保留原画作并排身份参照。输出位于 `prototypes/visual-direction/actor-keypose-art/`，主要对照图为 `keyposes-review.png`。

## 本轮实际采用的方法

从认可原画的分层中复用衣料与器物像素，按姿态直接编排裤腿的连续中心线、投影长度、前后层序、鞋的角度及接地点。不再由固定投影骨长和脚点反推整个姿态，不使用 05/06 的髋部权重。轮廓通过横截面取样生成；这是程序辅助轮廓制作与原画衣料取样，不能称为完整逐帧重绘。

原画上半身、头颈与手持物作为连续整体，按各姿态作小角度刚体倾斜与位置调整，没有独立缩放头部。它保留身份和已有握持，也限制了可表达的肩、肘、衣服形变；完整负重动作尚需继续制作。

左侧裤料补足记录器遮挡下的内容。原分层中有孤立像素，不能以整行最左至最右像素充当裤腿截面，否则会把整行衣料拉成一条异常横带；取实际连续衣料段后再构造轮廓。衣料原有光色被保留，新的体积光照没有自动得到重建。

## 当前可以检查什么

已自行并排检查原尺寸完整人物与约 104px 场景尺寸，检查重点为身份、髋至膝的连续轮廓、膝部转折、前后腿关系、持物连接及鞋底接触。

三个姿态的支撑次序明确为：右腿承重并抬左脚跟 → 右腿支撑、左腿摆过 → 左脚跟接地、右脚趾接触。配方中记录相应场景根位移，便于之后衔接脚点；这些离散位置尚不是经验证的运动曲线。

此轮没有制作动画、另一脚的完整关键姿态、转身或其他方向。静态图不证明过渡自然、纹理稳定、足底不滑动，也不证明完整行走已通过。正式首页未替换，05/06 的撤回状态继续保留，无新增图片或视频生成请求。

## 可编辑输入与回改

- `working-cloth.ora`：156×348 共享画稿，包含 `cloth_R`、`cloth_L` 与 `upper_reference`。可修改裤料与靴子；上半身参考在本试验中保留。
- `load.ora`、`passing.ora`、`contact.ora`：260×400 的姿态分层画稿，裤腿、靴子、上半身与局部画层分别可编辑。
- `keypose.spec.json`：显式姿态轮廓、倾斜、接地点与原画摘要。
- `authoring.json`：实际输入摘要和导出范围，不作为美术验收结论。

公共衣料修改可通过脚本重新进入三个姿态；单姿态 ORA 可在绘画软件中独立修改、导出，当前脚本不自动回收这些姿态局部修改。需要连续修绘时，再接入已有的依赖版本检查，不能直接重跑覆盖画稿。

本机已实测：未修改的共享 ORA 回导后三姿态像素一致；隔离副本中修改可见衣料后，修改进入三张输出。测试色保留在 `.lab/actor-complete-pose/`，没有进入本轮资产。输出目录已有 `authoring.json` 时脚本拒绝覆盖，回改导出使用新目录。

重建和共享衣料回改：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/author-actor-contour-poses.py --recipe prototypes/visual-direction/actor-keypose-art/keypose.spec.json --out-dir .lab/keypose-rebuild
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/author-actor-contour-poses.py --recipe prototypes/visual-direction/actor-keypose-art/keypose.spec.json --cloth-master prototypes/visual-direction/actor-keypose-art/working-cloth.ora --out-dir .lab/keypose-edited
```

下一步是完善负重时的肩躯干与衣料表现，再验证少量相邻过渡。当前保留 `artApproved: false`，没有已通过的行走版本。
