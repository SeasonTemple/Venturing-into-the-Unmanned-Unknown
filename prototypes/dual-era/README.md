# 双时代探索灰盒

首页直接复用仓库现有页面，保留场景首屏、章节摘要、阅读顺序、制品与 Agent 入口。原次要操作位改为“迈入未知”，不在首页设置探索职责选择。进入独立的 Three.js 交互页后，才提供人类主导 / AI 原生切换。内部模型与材质仍为玩法灰盒。

## 运行

在仓库根目录执行；使用现有 site 依赖，不新增框架或第三方插件：

```powershell
# 首次运行，或章节源内容更新后
cd site
npm ci
npm run build
cd ..

node prototypes/dual-era/serve.mjs
```

打开 http://127.0.0.1:4394/ 。服务仅监听本机。退出终端中的 Node 进程即可停止服务。

- `/`：复用现有首页，可阅读或进入；首页源文件未修改。
- `/explore/`：直接进入交互，默认 AI 原生，在空间内切换探索方式。
- `/reference/`：未添加交互入口的仓库原版首页，用于对照。
- `/homepage-review.html`：原版首页与本次预览并排；`?section=chapters` 对照章节，`?mobile=1` 对照 390px 窄屏。
- `/review.html`：人类主导、AI 原生并排；两边均可继续操作。
- `/review.html?mobile=1&landing=1`：1024px 预览与 390px 内部空间。
- `/review.html?triptych=1`：两种职责与真实章节阅读面对照。
- `/explore/?nowebgl=1`：无 WebGL 降级。
- `/explore/?verify=1&run=1&still=1`：浏览器交互检查；正式检查建议使用下方真实时间运行器。

正常模式有短进入镜头和角色移动；系统“减少动态效果”设置会取消这些移动。`still=1` 是截图与规则验证的固定呈现方式，采用同步渲染，不用于帧率评估。

## 如何体验差异

人类主导：本人到现场确认、装配、用工具检查、修正和接入。AI 原生：人维护意图与验收约束，Agent 分头生产；检查门禁只产生已配置条件的证据，人审阅后放行。机器人数量不代表现实中的速度或质量优势。

两边初始候选、接口故障、验收条件和后续干扰事件完全一致。可以先不给 Agent 配置门禁，观察“未发现失败”如何仍然缺乏证据；再阅读第 3 章，把方法加入清单，执行检查、修复、重查与放行。改动候选会使原证据失效。外部干扰出现后，两种模式都必须补充条件并重新验证。

点击场景标签或物体可查看装置、调整镜头；键盘 Tab 可到达模式切换、标签、任务与阅读入口。打开阅读面暂停三维渲染，Escape 返回并恢复触发按钮焦点。空间内切换分别保留两种模式的任务进度；“重置”仅清除当前模式。返回首页会离开交互页面并释放资源，再次进入是新会话。

## 内容与实现边界

- 普通预览读取 `site/dist/index.html`，除次要操作链接外与现有构建一致；十章与摘要都来自既有内容生成流程，阅读不受任务进度限制。预览服务同时供应站点原有 CSS、脚本、图片、字体与章节路由。
- 内部先接一章完整、真实的验证内容，来自 `site/dist/ch3/index.html`，不另写缩减版；其他章节通过正常阅读页打开。此页属于本地开发预览，尚未打包部署。
- 规则在 `scenario.mjs`，与 `world.mjs` 的视觉状态分离；`app.mjs` 负责生命周期与阅读。
- 使用确定性故障、可复放事件和当前候选版本的检查记录，便于公平比较。没有接入真实 LLM；目前没有模拟模型概率分布、人的知识初始量或完整 SDLC。
- 场景使用程序化低模、单一主投影光、合批静态几何与按需渲染；精模、手电光束、复杂后处理、多章节场景与存档尚未实现。
- `serve.mjs` 直接供应现有 Three.js 开发模块；网络体积不代表未来生产包体。生产接入需要再处理打包、内容路由与缓存。

## 验证

```powershell
node --test prototypes/dual-era/scenario.test.mjs
node site/scripts/verify-content.mjs
# Windows / Node 22+ / 已安装 Chrome / 预览服务运行中
node prototypes/dual-era/browser-check.mjs
```

浏览器运行器采用真实时间，写入 `.lab/dual-era/browser-report.json`，无论成功失败都在 finally 中关闭连接、按精确 PID 结束本次 Chrome 进程树并移除专属 profile。只验证本机 Chrome；没有据此宣称覆盖 Safari、移动真机或生产性能。截图统一使用 `scripts/shot.mjs`；不要用虚拟时间截图是否生成判断异步交互是否通过。

最近一次结果与具体限制见 [verification.md](./verification.md)。设计依据见 [玩法方案](../../docs/mini-exploration-design.md) 与 [技术建议评审](../../docs/threejs-technical-review.md)。后续空间与镜头迭代以现有首页质量为基准，不再用简化灰盒重做首页。
