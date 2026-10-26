const mobile = new URLSearchParams(location.search).has('mobile');
document.body.classList.toggle('mobile', mobile);
for (const frame of document.querySelectorAll('iframe')) frame.src = `./reading.html?layout=${frame.dataset.layout}${frame.dataset.section ? '&section=' + frame.dataset.section : ''}`;
const resize = () => document.querySelectorAll('.viewport').forEach(host => host.firstElementChild.style.transform = `scale(${host.clientWidth / (mobile ? 390 : 1440)})`);
new ResizeObserver(resize).observe(document.body); resize();
const areas = [
  ['意图 / 线索谷', '狭窄、遮挡多，线索互相矛盾；没有条件就无法判断哪条路合适。', '人亲自观察、核对线索，使用记录工具，把含糊要求变成验收条件。', '人先定义探索问题和约束，再派 Agent 搜集候选线索；歧义暴露后回到人作判断。'],
  ['架构 / 连桥', '高差、分岔与跨区连接，让依赖和接口成为可以看见的空间关系。', '人分解结构、选择连接并核对接口；自动化工具帮助检查连接规则。', '人给出接口契约和禁止连接，Agent 在界限内提出方案；人裁决高风险取舍。'],
  ['实现 / 工坊', '有遮棚、可装配的部件与不同工位；形成产物的过程在现场可见。', '人主要承担装配与实施，通过工具执行检查、记录变更。', '人把有边界的工作包交给多个 Agent；查看产物和变更证据，再决定是否接受。'],
  ['验证 / 检查峡口', '收窄视野与光路，以不同装置检查表达、状态、实现与行为。', '人按风险选择检查、执行与解释结果；反例促使人修正规格或产物。', '人定义可执行条件，Agent 按 harness 执行检查并返回证据；未表达的条件不会自动被覆盖。'],
  ['交付 / 信号塔', '从遮蔽区走向开阔的高处；放行前后可以观察到不同的系统状态。', '人组织变更、检查放行条件并执行部署，保留回滚路径。', 'Agent 在门禁和权限内形成发布候选；关键放行由人裁决，异常可隔离和恢复。'],
  ['演进 / 边缘观测', '已知设施逐渐稀疏，远处仍看不清；运行反馈带来此前没有的问题。', '人解释异常、修正认知与需求，再组织下一轮工作。', 'Agent 收集反馈和候选解释，人判断是否需要新约束、新检查或新的目标。'],
];
function select(index) {
  const [title, form, human, agent] = areas[index];
  document.getElementById('area-number').textContent = `REGION ${String(index + 1).padStart(2, '0')}`;
  for (const [name, value] of Object.entries({ title, form, human, agent })) document.getElementById(`area-${name}`).textContent = value;
  document.querySelectorAll('.area-choices button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  document.querySelectorAll('g.area').forEach((group, i) => group.dataset.active = String(i === index));
}
document.querySelectorAll('.area-choices button').forEach((button, i) => button.addEventListener('click', () => select(i))); select(0);
