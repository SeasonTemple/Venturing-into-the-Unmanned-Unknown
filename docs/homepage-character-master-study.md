# 完整角色母版与朝左试片 · master01

**制作方向更新：** 不再将当前通用三维角色持续精修为最终美术；保留其骨架、姿态和空间关系作参考。最新为 [完整二维人物试片 PIXEL 04](homepage-pixel-character-trial.md)，美术仍未定稿。

**最新：master02 衣装与形象修订**，评审页 `http://127.0.0.1:4395/character-master-v02.html`。以下第一节补充本轮实作，其后保留 master01 的原始记录。

## master02：实际改动与仍未通过的项目

本轮在同一基础人体与骨架上改造完整母版，保留 master01 资产名称和实际文件，新结果均使用 `v02` 文件名。朝左对照使用相同相机、光向、画布和持物姿态；额外偏正面图仅移动相机，不代表已制作另一个动作或转向。

实作内容：

- 私下用分部颜色检查源衣装，确认源模型的翻领、外壳、内衫、裤装四个连通部件。删除翻领面，躯干衣摆向上收短约 8cm，关闭原有前襟边界；补入沿胸廓的前襟、细拉链与低立领，均转移同一套蒙皮。不是在贴图上盖一个橙色矩形。
- 将错误外置的球形眼睛换成源 `eyes/low-poly` 的真实拟合眼球；眉毛沿实际面部 BVH 曲面生成，单独使用不含透明纹理的材质。胡茬从先前误落在鼻部的水平区域移到下颌。头部未独立缩放。脸部仍是近似设计，并非已经匹配原画身份。
- 短发换为 `short04`，读取其 UV 和透明度，颜色沿用共享黑发色阶。透明贴图打包进 `.blend`，网页仅显示最终精灵图，不加载该 2.3MB 源纹理。
- 鞋换为 `shoes03` 封闭短靴。此前把 `shoes01` 称作短靴不准确；还漏读了衣装的 `delete_verts`，导致身体脚面穿出鞋面。本轮应用源资产的身体遮挡索引，并读取 `shoes03.mhw` 的作者蒙皮权重；剔除空权重条目后验证骨名和完整覆盖。整个人物按真实鞋底移动到地面，鞋与身体不分别缩放／平移。
- 调整冷暖材质色阶，脸部保留连续体积，织物保持阶梯光色；输出直接渲染与无抖色色板版本。仍未解决原画的全部织物色块组织，不能把量化称作完整像素绘制。

源文件、材质与相机参数记录在 `character-master-media/master-v02.json`、`source-manifest-v02.json`；新母版约 3.5MB。源资产沿用官方 CC0 系统包，除短发透明度外未使用外部照片或图像生成。没有图像／视频／Tripo 请求和媒体用量。

重建命令在原命令基础上增加：

```powershell
python scripts/character-pack-fetch.py --parts eyes/low-poly/ hair/short04/ clothes/shoes03/ --manifest source-refine-v02.json
python scripts/character-pack-fetch.py --parts hair/short04/ --textures --manifest source-hair-texture-v02.json
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/render-character-master.py --revision v02
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/check-character-master.py --revision v02
```

验证记录：`docs/research/homepage-character-master-v02-validation.json`。保存母版重新打开后，重复渲染 RGBA 像素完全一致；可见高度 174px；新增衣领／前襟／眼球跟随同一骨架；源脚部遮挡索引未残留在可渲染身体面中；一个源发型贴图已打包，无外部图片依赖；实际 GLB 导出约 1.06MB。GLB 只验证导出存在，不证明 Blender 特有材质在其他渲染器中等价。

新评审页在 1440、606 和 390px 视口检查，无横向溢出；像素图原尺寸显示，放大图为 3 倍／2 倍。通过唯一截图入口捕获 3 张，自有浏览器进程最终 remaining 为 0。页面无脚本、动画或 WebGL。

**美术仍在制作中**：面貌气质、握点与器物接触、绘画式织物色块仍需进一步处理。当前只改善完整站姿，不把结构检查当作美术通过，没有扩步态、做视频或替换正式首页。

### 本轮方法经验

拟合资产需要一起处理坐标、显式蒙皮、身体遮挡、UV 和透明度，不能只拿 OBJ 与颜色。隔离连通部件和近景检查在这轮直接找出了翻领与穿帮来源。共享材质也须区分用途：发型的透明纹理不能同时作用于没有对应 UV 的眉毛，否则眉毛会被错误隐藏。原生显示尺寸上的眉眼可辨度需要单独查看；高分辨率结构近景只用于诊断，不替代像素成品验收。

## 本轮交付与判断

评审页：`http://127.0.0.1:4395/character-master.html?revision=master01`。

已经实际建立“可编辑人体、骨架、衣装与器物 → 固定相机／光向 → 离线二维输出”的制作链。不是继续修补 standing02。提供原画参照、直接渲染、固定色板归并三栏及整数倍放大。

**技术链已实测，美术仍未通过，未制作新步态或接入首页。** 三维模型的一致性解决不了全部美术问题。当前脸部辨识、衣装剪裁、手的握持、鞋型和绘画式织物色块仍与原画有差距。右手工具箱和左手记录器的绑定归属已经固定，但绑定正确不等于接触可信。

## 实际资产与来源

- 工具：本机隔离环境 `E:/DevCache/tools/unmapped-sprite-bpy/`，CPython 3.11.16、Blender `bpy==4.5.3`、Pillow 和 NumPy。通过 `uv` 安装，无须启动 GUI；没有在网页运行 Blender。
- 人体、宏观形变、163 骨骨架和原始蒙皮：MakeHuman，固定提交 `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`。
- 衣装：官方 CC0 系统资产包的 `male_casualsuit05`；短发 `short01`、鞋 `shoes01`。采用真实 OBJ 与 `.mhclo` 拟合信息，不使用下载缩略图代替资产。底座与装备自行构造。
- 源资产本身含 CC0 声明；许可证及 URL、源文件 SHA-256 随结果保存。原画仅作身份／光色参照；没有从原画取身体局部拼接到模型。
- `.lab/character-master/` 保存下载源与导出检查文件；可编辑 `.blend`、渲染和来源清单在 `prototypes/visual-direction/character-master-media/`。

来源：[MakeHuman 仓库](https://github.com/makehumancommunity/makehuman)、[资产许可证](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md)、[官方系统资产包说明](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)。

## 制作范围与参数

完整人体使用原始网格及蒙皮。衣服通过源资产的三点重心权重与偏移适配形变后的人体，将权重转移到同一个骨架。衣装材质按完整连通部件分配，避免用某条水平线误把外套衣摆染成裤装。完整母版仍需要进一步改造为本站雨衣，源衣装只承担当前方法试验。

双臂整体调整到持物站姿，器物分别绑定 `wrist.R` 和 `wrist.L`。手指有基础收拢，尚未通过握持姿态评审。眼球、眉毛与胡茬为母版的一部分；眼球外壳按变形后的眼眶调整，使用头骨跟随，仍需形象核对。

128 × 196 透明画布，人物 alpha 可见高度 174px。相机为正交，位置 `(4, -1.7, 2.25)`，目标 `(0, 0, 0.93)`，正交尺度 1.99。光色由固定世界法线方向、五档材质色阶及短距离 AO 形成；Cycles CPU 24 samples、固定 seed 0。当前照明是受控风格试验，不是物理日光重建。

额外输出整张图的 50 色最近色板归并，无抖色、描边增强或局部缩放。这能减少平滑色阶，**尚不能替代对像素簇、布料与轮廓的设计**。直接渲染与归并结果均保留，不把归并图默认当最终成品。

原参照文件为 156 × 348，当时以最近邻缩为 78 × 174，再放入共同画布。后续逐像素核对发现原文件并非严格的两倍像素复制，因此这里是缩小处理，不能称为“还原原生像素”；174px 是当时采用的比较尺度。没有只放大脸部或裁掉下半身来对齐。后续输入标准见[人物管线补充调研](homepage-character-pipeline-decision.md)。

## 已做验证

详细结果：`docs/research/homepage-character-master-validation.json`。

- 保存后重新打开压缩 `.blend`，实际重新渲染，RGBA 像素与交付图完全一致。
- 人体、衣装、头发、鞋均有指向同一母版的 Armature 修改器；母版无外部图片依赖。
- 右手银箱、左手绿记录器的骨骼归属分别检查。
- 实际导出约 1.3MB GLB 到 `.lab/`，验证模型／骨架导出链存在。GLB 不能等同于重现 Blender 专用法线色阶和 AO 材质；未把它接入网页。
- 1440px 桌面及 606px 窄屏页面检查通过，无横向溢出。实际尺寸图保持 1 倍；放大图分别 3 倍、2 倍最近邻。页面无 JS、Canvas、WebGL 或逐帧循环。
- 共使用唯一截图入口捕获 3 张，其中 1 张用于修正最初评审页的参照尺寸错误；自有截图浏览器进程全部退出，最终 remaining 为 0。
- 没有图片／视频／Tripo 生成请求或付费媒体消耗。

没有进行步态、关节极限或十分钟运行测试：本轮交付是静态母版风格试片。源骨架可用，不代表新动作或人物变形已经合格。

## 重建

```powershell
uv venv --python 3.11 E:/DevCache/tools/unmapped-sprite-bpy
uv pip install --python E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe bpy==4.5.3 Pillow
python scripts/character-source-fetch.py
python scripts/character-pack-fetch.py
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/render-character-master.py
E:/DevCache/tools/unmapped-sprite-bpy/Scripts/python.exe scripts/check-character-master.py
```

资产包采用 HTTP Range 选择下载，不必传输完整约 268MiB 的 ZIP。源包可更新，重新获取后须对照交付的 `source-manifest-v01.json`；哈希变化时不能当作同一资产版本。

## 下一步门槛

继续在完整母版内解决身份、衣装和画风，保留受控输出与原画并排。当前结果不称作美术定稿。造型与色块成立后才试少量完整负重关键姿态，检验衣服变形、脚点及器物重量；仍不直接扩为大量动作或替换首页。
