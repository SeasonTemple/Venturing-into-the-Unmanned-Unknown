# 人物表达与制作路线复核

核对日期：2026-10-29。接续全身换重候选撤回及完整站姿重画失败。本轮重新检索并读取公开资料、源代码与资产清单；没有生成新图片或视频，没有安装插件、下载推理权重、购买资产或修改正式首页。

## 决策

下一条优先验证路线是：**可编辑的三维角色和原生动作 → 固定镜头、光照与像素材质 → 离线二维帧 → 场景内播放。** 这是待验证路线，不是已经证明能达到本站画风的方案。

保留原野像素的光色、空间和叙事方向。人物原插画作为身份与美术参照，不再作为每个动作只能变形这张图的限制。为动画调整比例、衣物结构和握持方式时，必须提供完整画面并与原画、场景比较，不把现成人物的画风自动替换进本站。

选择依据是：人物需要多方向、非对称持物、现场操作和随环境变化的照明。三维表示可以共享完整形体、骨架与器物关系，减少逐方向猜测隐藏部位。它仍需要可信的角色资产、关键姿态和合适的材质；低分辨率、色阶量化、动作捕捉都不能单独证明美术或动作成立。

保留受控图像编辑作为第二候选。它应接受原图、完整结构/轮廓依据和选区编辑，并能修正指定错误；不继续把人物参考加长提示词视为精准姿态控制。纯程序轮廓绘画和旧插画裤腿拉伸退出成品制作候选。

## 直接核对的证据

| 来源 | 此次实际获得的证据 | 对本站的作用与缺口 |
| --- | --- | --- |
| Thomas Vasseur《Dead Cells》制作文章 | 检索到作者及原文；原文直取403，另直接读取WN Hub公开报道交叉核对3DS Max模型/骨架、低分辨率无平滑渲染、关键帧及PNG/法线输出。没有拿到该游戏的角色制作工程 | 支持三维表示与像素呈现分开设计。不是本站人物能自动获得相同质量的证据；不采用搜索中“只需Blender/Photoshop、无需美术工作”等二手夸大说法 |
| Lucas Roedel像素渲染工具的公开修改版 | 读取README、GPLv3许可、初始化与材质创建代码、递归文件清单；固定提交并下载1.79MB节点资产库 | 有真实源码和可读资产，适合验证光照与色阶。不是完整人物工程。节点库只有烟雾/笔触材质及Pixelation、Shine节点组；核心像素材质由Python创建 |
| Pribambase公开分支 | 直接读取公开分支README；原作者当前站点502，旧上游地址404，未据此断言维护状态 | 证明可以把Aseprite中的纹理修绘映射回Blender。它优化编辑反馈，不能代替纹理绘画；未安装、未检验现行版本兼容 |
| KayKit Adventurers | 读取作者页面及GitHub README。仓库版本说明包含已绑定人物、动画、FBX/glTF及CC0许可；作者现行页面与旧仓库的数量不同 | 可作为带原生动作的技术对照输入。其比例、服装与画风不符合本站，不能直接作正式人物；未下载人物包、未核对实际动画片段 |
| Quaternius Base Characters / Animation Library | 直接读取作者页面，核对Humanoid骨架、兼容动画、文件格式及CC0说明；页面明确.blend源工程属于Source版本，不能假称免费基础包已包含全部源文件 | 可选结构/动作基准，不解决本站的衣装和画风。未下载、购买或做动作转移 |
| Krita AI Diffusion官方手册 | 直接读取安装、控制层、编辑模型文档：姿态、深度/法线、参考、选区和多图编辑确实存在；编辑模型有各自支持范围 | 有比单张人物参考更明确的编辑控制。没有证明某个模型同时满足本站画风、姿态、非对称握持和跨帧连续性 |
| 用户提供的game-asset-aesthetic-test | 重新读取README与视频精灵、Spine路线的implementation。作者明确角色图、模型、动捕和阶段输入不附带；部分脚本必须角色适配 | 吸收制作步骤与接口，不把代码包当作完整角色生产能力。此前已复现的COA工程也只证明工具链，不证明本站母版合格 |
| 用户提供的参数化建筑仓库 | 直接读取master分支README：几何、可替换材质图集、多方向导出及配方分开 | 可迁移的是表达结构和外观的分工。建筑是刚性几何，不能据它成功就推断人体、衣装与握持同样容易 |
| LPC角色生成器 | 直接读取官方仓库README，确认它组合已经绘制好的身体、服装、方向与动作，且资产有各自许可 | 说明低成本二维生产依赖完整的动作资产体系。其美术比例、视角与本站不同，不直接采用 |

## 本机做了什么，尚未证明什么

当前已有Python环境的bpy版本为4.5.3 LTS。关闭自动执行嵌入脚本后，实际读取固定版本的像素渲染节点资产，成功加载两个材质。没有注册插件、执行第三方材质创建函数或进行角色渲染。这只证明小型资产库可读；不能把烟雾材质可读写成目标像素人物渲染通过。

源码审阅另发现：`get_bayer()`使用`/tmp/bayerMatrix.png`路径，材质函数会按名称删除并重建材质。Windows路径、隔离工程和Blender节点接口需在实际试用前处理。README还警告不同Blender版本有色彩伪影；作者对其他版本的说法没有在本机验证。

Krita现行安装文档明确列出Intel Arc 8GB以上及XPU后端。本机设备名称为Intel Arc 140T，因此不能仅因它不是NVIDIA就判定无可行性；WMI报告和显示名称不足以确认可用加速内存及推理表现。当前bpy环境未安装torch，命令和常见默认路径检查未发现Krita/Aseprite，但这不是全盘安装审计。尚未运行XPU、安装模型或测时。官方给出的模型空间为最低10GB、可超过50GB，不能将这条路线描述成已经随手可运行。

## 下一次小样的具体问题

**问题：一个可编辑的完整角色，能否在目标场景里达到可接受的像素画表现，并在改变姿态后保持这种表现？**

输入必须包括完整、可修改、来源可用的角色和服装、器物、真实骨架，以及固定场景镜头与光源。优先用源资产自己的动作/姿态建立基线，不把第一次测试与新的动作重定向、身体比例修改同时混在一起。现有通用人物只可作为技术对照，目标人物仍须另验。

先只制作两张完整静帧：站立持物、同一角色小幅转身后的持物姿态。人物侧别不交换，双手有接触，新露出部位有真实结构。将两张图同时放回原野场景，按实际画面尺寸检查，再提供整数倍放大。现有约104px研究尺度只是起点，不把它当作所有视口固定的人物高度。

关键验收是外套、脸、鞋、器物与环境是否像同一作品，转身后结构与光色能否连续；不是先做完整走路再补救画风。随后在源工程改变一处明确可见的袖子/器物细节，保存重开、重新输出，证明实际内容可修。导出检查单独记录。

前两张图的美术不成立时，不追加步态帧。问题来自模型/衣装就调整输入，来自材质/镜头就调整呈现；不把任何失败都归为后期需要精修。若核心风格必须依赖当前无法完成的逐帧绘画，主路线仍不成立，应转去测试受控编辑，而非口头补一个人工环节。

画风与可修改性成立后，才制作短动作，检查根运动、朝向、足底接触、骨盆/胸肩响应和持物。动态行走不能按“质心投影每一刻必须在单脚底下”一条静态规则判定，也不能只凭鞋层连接和脚点数值放行。

## 来源

- [开发者原文入口](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)；[直接读取的公开报道](https://wnhub.io/news/hr/item-13775)。
- [像素渲染公开修改版](https://github.com/Tramshy/pixel-art-addon-mod)，固定提交`f13502c1fa71fd92e3969f35e9edeab17f4da52d`；[原作者产品页](https://lucasroedel.gumroad.com/l/imnhcr)仅检索命中，本次直取超时。
- [Pribambase公开分支](https://github.com/powertashton/pribambase)。
- [KayKit人物包仓库](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0)；[作者页面](https://kaylousberg.com/game-assets/characters-adventurers)。
- [Quaternius基础人物](https://quaternius.com/packs/universalbasecharacters.html)；[动画库](https://quaternius.com/packs/universalanimationlibrary.html)。
- [Krita安装与硬件](https://docs.interstice.cloud/installation/)；[控制层](https://docs.interstice.cloud/control-layers/)；[编辑模型](https://docs.interstice.cloud/edit-models/)。
- [用户提供的美术方法仓库](https://github.com/zeroa234/game-asset-aesthetic-test)；[参数化建筑](https://github.com/Zengkailin/parametric-topdown-pixel-architecture)。
- [LPC角色资产体系](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)。

原始网页、代码、检索响应、访问失败和SHA保存在`.lab/character-route-research-20261029/`，可追溯摘要见[证据清单](research/character-production-route-review-20261029.json)。研究资产未接入网站。
