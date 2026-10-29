# 负重两步与停稳小样

2026-10-28。实际导出为 `prototypes/visual-direction/actor-contour-motion/loaded-step.mp4`，65 帧、16fps、4.0625 秒。包含承重准备、左脚经过与落地、右脚经过与落地、收步，以及肩臂和箱体的余摆。画面同时显示原尺寸、跟随全身放大与约 104px 的场景尺寸。

## 制作源与范围

身份继续取自 `art-pack-media/actor-front.png`。使用完整关键姿态的连续裤腿轮廓与源衣料取样，再编排过渡；没有使用已撤回的 05/06 平面 IK 或髋部权重。这仍是程序辅助制作，不是完整逐帧手绘。单一原画视角限制了转向、身体透视与新衣褶的表现，目前不作为循环步态或多方向资产。

头、颈和衣领上部共用整数位移，保留源头部像素；躯干下部渐变至髋部。两臂分别编排肩部响应，提箱手保留握点，箱体可独立回摆。鞋底按落地脚跟与离地脚尖调整，根节点行进曲线不会在每个经过姿态强制停下。

分层原画中有极小的孤立衣料像素，最初归属躯干，袖子移动后会围出透明针孔。现在将邻接袖子的孤立衣料归回对应袖子，并补足袖下隐藏衣料。实际转移像素记录在 `authoring.json`，没有用最终帧填洞来掩盖错层。

## 可回改交付

- `motion.spec.json`：完整姿态轮廓、时间、位移、落脚与持物参数。
- `working-cloth.ora`：共享裤料与靴子；本次实际回导静态姿态阶段的共享母版，输入及摘要见 `authoring.json`。
- `working-upper.ora`：连续躯干与隐藏衣料分层。隐藏衣料可导出同尺寸 PNG，通过配方的 `upperUnderpaint` 路径重新输入；躯干层的修改目前没有自动回导接口。
- `frame-*.ora`：八个完整关键帧的分层画稿。姿态画稿可独立修绘导出，当前生成器不自动回收其局部修绘。
- `frames/`、`motion.json`：透明无损帧、实际脚点及位移。

输出目录已有 `authoring.json` 时拒绝覆盖；回改需导出到新目录。

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/author-actor-contour-poses.py --recipe prototypes/visual-direction/actor-contour-motion/motion.spec.json --cloth-master prototypes/visual-direction/actor-keypose-art/working-cloth.ora --out-dir .lab/actor-motion-rebuild
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe -X utf8 scripts/check-actor-contour-seams.py prototypes/visual-direction/actor-contour-motion
node scripts/check-actor-contour-video.mjs
```

## 检查与限制

导出时检查每帧头部像素平移一致及支撑鞋的实际透明轮廓接地；另检查提箱侧肩袖区域没有封闭透明孔、最终保持区像素一致。浏览器原生播放器实测播放、暂停、拖动、半速与结束。完整人物、另一脚经过和收步按连续帧检查，技术检查不能替代动作自然度判断。

这是有限动作候选，`artApproved: false`，正式首页未接入，也没有自动转身、往返、场景遮挡或自由移动。未调用付费媒体生成。先前失败版本保留撤回状态。
