# 提箱侧髋腿试验 v06：未通过，已撤回

2026-10-28 撤回说明：此版未解决完整人体和连续动作，上大腿出现假关节，站姿屈膝与腿部交会也不成立。停止以“修正”推荐此版。下文是失败试验的原始记录，数值检查仅证明约束和导出行为，不代表美术合格。

2026-10-28。用户指出提箱侧裤腰至上大腿像一块固定贴片。检查确认：上腿的骨盆权重偏大，腿部变形的过渡偏低；身体跟随裁切又移除了整体平移，僵硬更明显。该部位并非完全没有位移，但摆动不足。

旧过渡范围为源图 y=202–229；源图取样点 (49,213) 的大腿权重约 36%。本轮仅将提箱侧过渡改为 y=197–220，该点的大腿权重约 78%。左右过渡仍在髋部中线平滑衔接，骨盆与腿网格使用相同权重关系。

两侧一起提前过渡会在记录器下露出明显缺口，该尝试未作为交付。记录器侧仍沿用原权重；缺少的隐藏裤料需要另行制作，不能以更强变形弥补。

[同步对照](http://127.0.0.1:4395/actor-motion-review.html?study=hip06&revision=hip06)／[49 帧对照短片](../prototypes/visual-direction/actor-rig-v06/actor-v06-comparison.mp4)。源规格、ORA 和 Blender 工程在独立 `actor-rig-v06` 目录。

完整重新导出、保存重开后的七帧重渲染一致。所有骨架动作与 v05 一致，头手区域与小腿区域逐帧像素一致，改动局限于髋部和上腿。实际蒙皮顶点 (49,213) 在抽查五个动作时刻的身体相对 X 范围由约 3.73px 增至 7.74px；这是局部响应的工程证据，不能证明衣料或完整步态已通过美术验收。见 [检查记录](../prototypes/visual-direction/actor-rig-v06/actor-v06-validation.json) 与 [顶点轨迹](../prototypes/visual-direction/actor-rig-v06/hip-point-check.json)。

重建与检查：

```powershell
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/build-actor-cutout.py --spec prototypes/visual-direction/actor-rig-v06/actor-rig-v06.spec.json --out-dir prototypes/visual-direction/actor-rig-v06
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/check-actor-gait-study.py --hip
node scripts/check-actor-motion-review.mjs --hip
```

结论：失败的局部权重试验，不能用于正式首页或继续扩展。正式首页未改，无新增媒体生成请求。
