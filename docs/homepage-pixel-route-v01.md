# 限定通路行为壳 V01

这是首页探索目标的独立行为验证页，正式首页暂不显示这套未通过视觉闸门的角色。入口为 `http://127.0.0.1:4395/pixel-route-v01.html`；带 `actorPreview=1` 的首页仅用于预览验收。

页面加载 `pixel-walk-v01` 的 8 张左向完整像素帧和 `pixel-turn-keyframes-v01` 的 5 张转身帧，验证以下状态机。当前行为与资源完整性通过，人物视觉与正式首页接入仍未通过：

- 从观测站门前沿维护路向左移动；
- 点击旧标记、R1 测点或坡肩后自动行进；
- 按住 `←` 接管自动行进，松开或按 `Esc` 在接触帧收步；
- 停稳后按 `→` 或“转身”播放侧面与正面完整帧；
- 正面状态不伪造右向行走；右向资产仍需另行手绘后才能加入；
- 减少动态、失焦、离屏和暂停时停止渲染时钟。

当前清单明确写入 `behaviorApproved: true`、`artApproved: true`、`motionApproved: false` 和 `homepageIntegrated: false`。浏览器验收记录在 `pixel-route-v01/behavior-checks.json`，预览入口记录在 `pixel-route-v01/home-checks.json`，十分钟压力记录在 `pixel-route-v01/soak-checks.json`。这套状态机只承诺已绘制的左向路线，不用镜像伪造右向。

检查命令：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/check-pixel-route-v01.py
node scripts/check-pixel-route-browser.mjs
node scripts/check-home-pixel-route-browser.mjs
```
