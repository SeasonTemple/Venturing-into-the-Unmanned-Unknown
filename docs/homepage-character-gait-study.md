# 交替承重与停步候选 v05

2026-10-28。按 v04 后确定的顺序，回到完整身体检查步序、身体行进和停步。原画身份、装备归属、画布、相机与共享蒙皮沿用原工程；正式首页未改变，无新增媒体生成调用。

[同步逐帧预览](http://127.0.0.1:4395/actor-motion-review.html?study=gait05&revision=gait05) 使用已有播放器，仍可切回 04。另有 [完整身体并排短片](../prototypes/visual-direction/actor-rig-v05/actor-v05-comparison.mp4) 与 [关键姿态](../prototypes/visual-direction/actor-rig-v05/actor-v05-keyposes.png)。

## 从完整动作找到的问题

前版原站姿里右脚已在画面左前方，随后仍由右脚先向前移动、左脚追近。这形成追近式短步。用于本轮交替行走目标时，两脚没有真正交换前后关系。

此外，原位移在每对关键姿态之间使用两端速度归零的 smoothstep。身体会在经过和接触等每个姿态处反复减速，节奏难以连续。膝部衣褶修绘对这些动作控制问题没有作用。

## 本轮修改

- 左后脚先摆动并越过支撑右脚，首次接触后保留短暂双脚着地阶段，再转为左脚支撑、右脚迈到前方。实际求值的前脚次序为 R → L → R。
- 仅为新规格启用根节点 X 方向单调 Hermite 曲线，在经过姿态保持持续行进，在起步和停步归零。旧规格继续使用原插值；旧 v03 的十个关键姿态重新构建后全部像素一致。
- 重新安排落地与过渡时的身体高度。静帧初查发现两次接触下沉偏多，已减小，避免一直屈膝的观感。动作不是物理或质心模拟。
- 行进中保留小幅前倾，制动时收回；负重肩与肘有限运动，箱体在身体停止后回摆归正。49 帧、12fps，约 4.08 秒，身体累计向左前移 60 个原画像素。
- v04 的衣褶修绘没有复用到新姿态，所有新帧仍是骨架底图；新规格、共享 ORA、保存的骨架工程和导出帧均在独立 v05 目录。

## 验证范围

[保存工程验证](../prototypes/visual-direction/actor-rig-v05/actor-v05-validation.json) 检查所有帧的手箱握点、支撑脚点与脚骨世界矩阵；七个时刻重开渲染与原输出一致。头部未缩放，31–49 帧停稳区间头部像素一致，所有帧保留画布边距。原图参考帧 alpha 一致，最大颜色取样误差为 4/255。

播放器的两个入口均实测了原生方向键、Home / End、逐帧、暂停、半速、单次结束、按需循环、真实滚动离屏暂停，以及 320px/390px 无横向溢出。后台事件通过模拟检查，未宣称覆盖所有浏览器后台策略。记录位于 `.lab/actor-gait-browser/` 与 `.lab/actor-motion-browser/`。

没有用最终合成图的鞋底像素恒定去证明交会区稳定：另一条腿可能合理遮挡支撑鞋。此次验证的是脚点和脚骨姿态，实际鞋形与接地观感仍需看画面。

## 尚未放行

新序列可以实际检查交替步序和连续行进，但**腿部交会处的形体与遮挡仍显压缩，脚掌仍整体保持原朝向，没有脚跟到前掌的滚动**。这两项限制不能靠继续增加中间帧或复制旧膝部补丁解决。当前只有一个原画视角，尚未证明自然的可循环行走、转向或场景行走。

下一项制作应针对完整的交会／接触姿态：检查近腿与远腿的遮挡、裤腿体积、鞋掌接触，必要时补足该姿态的可编辑画层，再回到连续帧。暂不扩大方向数，也不把通过脚点检查当作美术放行。

## 回改与重建

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/build-actor-cutout.py --spec prototypes/visual-direction/actor-rig-v05/actor-rig-v05.spec.json --out-dir prototypes/visual-direction/actor-rig-v05
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/check-actor-gait-study.py
node scripts/check-actor-motion-review.mjs --gait
```

初次规格由 `scripts/author-actor-gait-study.py` 生成，该命令拒绝覆盖已有规格。后续直接编辑版本规格，或在 Blender 中修改工程并另行导出；不要用生成脚本覆盖已修改的工程。通用步序与位移经验已补入技能[制作管线参考](../.agents/skills/unmapped-pixel-art/references/editable-character-pipeline.md)。
