# 原野观测站首页接入

2026-10-27。用户在体验短路线后指出同手同脚及躯干／头部过静，并明确授权先替换正式首页、提交、推送。保留已经认可的首屏像素美术，将动作修正和短探索一并接入。

## 当前页面

- 正式路径：`/Venturing-into-the-Unmanned-Unknown/`。
- 书名、一句主题、进入与直接阅读叠在同一原画上；手机保留整幅图，标题在图上方。
- 首页使用自己的同色导航，保留 Starlight 的真实搜索；全书章节、安装、GitHub、下载与 Agent 文本入口在首屏下方，来自原有数据和组件。
- 进入后从檐下走到岸边旧桩，可停步、继续、查阅、返回。打开搜索暂停两个视觉层，Esc关闭搜索后继续；不误退出场景。
- 尚未实现自由镜头、多方向人物、第二处测点、两种职责模式或天气切换；第一条手记是虚构场景线索，不是实际测量数据。

## 人物动作修正

双臂直接对各自腿部位移取反，形成对侧手脚领先；手提工具箱的一侧摆幅较小。骨盆随承重交替抬落，肩部绕腰部轻微回摆，头部跟随颈部并作小幅反向补偿以稳定视线。衣服、手臂、头、靴子与工具仍来自认可的首屏原画。完整肢体离线合成12帧步态和两个工作姿态，运行时按距离选帧，无躯干部位的局部纹理位移。

`prototypes/visual-direction/meadow-gait-check.mjs` 检查对侧领先、肩／髋／头的参与、承重脚基线，并比较实际图集的头、躯干和双臂像素；8项通过。这些检查用于避免同手同脚和静态身体回归，不代表美术无需后续评审。

## 源码与素材

- 正式组件：`site/src/components/MeadowHero.astro`；`JournalFrame` 只为首页省去旧导航，阅读分支沿用原实现。
- 正式逻辑：`site/src/scripts/meadow/`；环境与行走层从预览接入，素材根路径由组件传入，支持 GitHub Pages 子路径。
- 正式样式：`site/src/styles/meadow/`；生产覆盖处理 Starlight 容器、导航、搜索与320px安装命令换行。
- 正式素材：`site/public/meadow/`，仅包括选中原画、遮罩、补齐底图、原画动作与前景切图。原始生成稿和失败稿保留在研究目录，不随站点发布。
- 重新制作动作先运行 `node prototypes/visual-direction/meadow-rig-assets.mjs`，再校验，并将选中图集和元数据更新到 `site/public/meadow/`。美术来源与失败稿记录见 `prototypes/visual-direction/meadow-media/`。
- 通用叙事像素美术 skill 保存在 `.agents/skills/unmapped-pixel-art/`，随研究快照版本化；该目录原先被仓库忽略，本次只显式纳入这一技能，不纳入其他本机工具状态。

## 验证

```text
npm run build --prefix site
node site/scripts/verify-content.mjs
node prototypes/visual-direction/meadow-gait-check.mjs
node prototypes/visual-direction/browser-check.mjs --home
node prototypes/visual-direction/browser-check.mjs --production
```

构建成功，10章源正文逐字节一致。动作8项、正式首页38项、正式阅读40项检查通过；覆盖320—2560px布局、完整约15秒行走、器材遮挡、到站与查阅、暂停与离屏、上下文恢复、减少动态、素材失败重试、搜索、无JS和无WebGL回退。测试Chrome按各自PID树结束并删除profile，残留0。报告在 `.lab/meadow-production/` 与 `.lab/production-journal/`。

本轮浏览器截图共6张，均走 `scripts/shot.mjs --batch`，用于核对桌面、390px、320px、人物行走、到站手记和首页下方内容。发布由 `main` 分支的既有 Pages 工作流完成，不更改部署权限或工作流。
