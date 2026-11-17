// Monoline-geometric + Observatory interactive technical plates for Chapters 2 & 6.

const BOUNDARIES = [
  {
    code: 'B1',
    title: '模块与导入边界',
    question: '越界调用能在编码前被目录与依赖检查拦住吗？',
    mechanism: '领域边界 / 单向依赖检查 / 目录隔离',
    artifact: '依赖有向图规则、私有内部包结构与静态导入检查脚本',
    limit: '目录隔离能挡住误引用，但不能替接口校验运行时参数合法性。',
  },
  {
    code: 'B2',
    title: '接口前后置契约',
    question: '非法的中间状态是否在类型与构造入口处就被剔除？',
    mechanism: '显式状态机枚举 / 类型收紧 / 前后置不变量',
    artifact: '状态转移白名单、不可变标识与边界契约表格',
    limit: '类型与单接口契约稳固，仍需并发交错检查来兜住跨节点竞态。',
  },
  {
    code: 'B3',
    title: '非确定性隔离底座',
    question: '时钟、随机数、网络与存储是否可插拔替换为确定性实现？',
    mechanism: '依赖注入边界 / 可控伪时钟 / 录制回放接口',
    artifact: '抽象 Port 接口、故障注入钩子与固定种子测试底座',
    limit: '隔离外部副作用便于仿真验证，但仍要面对真实生产环境的超时波动。',
  },
];

const GATES = [
  {
    code: 'G0',
    title: '本地秒级防线',
    question: '格式、导入越界与低级语法错误是否秒级拦截？',
    mechanism: 'Formatter / Linter / 类型与边界静态检查',
    artifact: '秒级退出码与本地 Pre-commit 核验报告',
    limit: '静态检查只验证结构合法，不证明真实用户路径能跑通。',
  },
  {
    code: 'G1',
    title: '增量正确性门禁',
    question: '受影响场景与核心性质是否产出真实运行证据？',
    mechanism: '增量端到端驱动 / 属性测试 / 差异比对',
    artifact: '性质覆盖条目（含未覆盖边界）与可重放截图/日志',
    limit: '增量校验聚焦改动面，跨子系统回归需更高一级门禁承接。',
  },
  {
    code: 'G2',
    title: '集成仿真与预算',
    question: '全链路并发交错与承诺性能指标是否在基线预算内？',
    mechanism: '全量回归 / 确定性仿真（DST）/ 资源预算探针',
    artifact: '尾延迟与内存占用对比基线、固定故障种子清单',
    limit: '仿真通过依赖预置故障模型，未建模的硬件异常仍在边界之外。',
  },
  {
    code: 'G3',
    title: '基线锁定与人工裁决',
    question: '门禁配置是否从主干基线读取，防止待合入变更篡改规则？',
    mechanism: '独立 Baseline Runner / 证据包审阅 / 灰度回滚就绪',
    artifact: '结构化发布证据包、主干校验签名与一键回滚验证记录',
    limit: '门禁防线严密仍需人类在有限预算下审视残余风险并签核放行。',
  },
];

function buildInteractivePlate({ captionLeft, captionRight, roleLabel, items, drawingSvg, keyHint, readingKey, footerLabel, activeAttr }) {
  const figure = document.createElement('figure');
  figure.className = 'field-plate journal-extra';
  figure.innerHTML = `<figcaption><span>${captionLeft}</span><span>${captionRight}</span></figcaption>
    <div class="layer-select plate-select-${items.length}" role="group" aria-label="${roleLabel}">${items.map((item, i) => `<button aria-pressed="${i === 0}" data-item="${i}">${item.code}<span>${item.title}</span></button>`).join('')}</div>
    <div class="layer-detail plate-detail">
      <div class="layer-drawing plate-drawing" aria-hidden="true">${drawingSvg}<p class="layer-diagram-key">${keyHint}</p></div>
      <div class="layer-caption"><p class="kicker" data-plate-name></p><h3 data-plate-question></h3><p class="layer-method" data-plate-mechanism></p><dl class="layer-artifact"><dt>可核对的产物</dt><dd data-plate-artifact></dd></dl><p class="layer-reading-key">${readingKey}</p></div>
    </div>
    <p class="layer-limit"><span>${footerLabel}</span><span data-plate-limit></span></p><p class="sr-only" data-plate-live role="status"></p>`;

  const nodes = [...figure.querySelectorAll('[data-plate-node]')];
  const buttons = [...figure.querySelectorAll('[data-item]')];
  const live = figure.querySelector('[data-plate-live]');

  function select(i, announce = false) {
    const item = items[i];
    figure.setAttribute(activeAttr, item.code);
    buttons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.item) === i)));
    nodes.forEach(n => n.classList.toggle('is-active', Number(n.dataset.plateNode) === i));
    figure.querySelector('[data-plate-name]').textContent = `${item.code} / ${item.title}`;
    figure.querySelector('[data-plate-question]').textContent = item.question;
    figure.querySelector('[data-plate-mechanism]').textContent = item.mechanism;
    figure.querySelector('[data-plate-artifact]').textContent = item.artifact;
    figure.querySelector('[data-plate-limit]').textContent = item.limit;
    if (announce) live.textContent = `${item.title}：${item.question}${item.artifact}。`;
  }

  buttons.forEach(b => b.addEventListener('click', () => select(Number(b.dataset.item), true)));
  select(0);
  return figure;
}

export function createBoundaryPlate() {
  return buildInteractivePlate({
    captionLeft: '图版 01 / 结构防错与非确定性隔离剖面',
    captionRight: '阅读辅助 · 架构边界约束',
    roleLabel: '选择架构隔离边界',
    items: BOUNDARIES,
    keyHint: '实线边界：结构硬约束<br>底座虚线：外部非确定性入口',
    readingKey: '好的设计先用目录、类型与可控接口把错误挡在门外，再交由 Agent 在内环实现。',
    footerLabel: '边界之外',
    activeAttr: 'data-active-boundary',
    drawingSvg: `<svg viewBox="0 0 560 320" class="plate-svg plate-svg-boundary">
      <g class="plate-grid" stroke="#577278" stroke-width="0.6" opacity="0.45">
        <path d="M40 48H520M40 96H520M40 144H520M40 192H520M40 240H520"/>
        <path d="M90 30V285M180 30V285M280 30V285M380 30V285M470 30V285"/>
      </g>
      <g class="plate-node" data-plate-node="0">
        <rect x="64" y="42" width="432" height="196" fill="none" stroke-width="1.4" stroke-dasharray="6 4"/>
        <path d="M64 78H496M210 42V238M350 42V238" fill="none" stroke-width="0.9"/>
        <text x="76" y="65">B1 · 模块导入与依赖流向约束</text>
      </g>
      <g class="plate-node" data-plate-node="1">
        <rect x="116" y="96" width="328" height="92" rx="3" fill="none" stroke-width="1.5"/>
        <path d="M210 142H350M338 134L350 142L338 150" fill="none" stroke-width="1.4"/>
        <rect x="132" y="118" width="78" height="48" fill="none" stroke-width="1"/>
        <rect x="350" y="118" width="78" height="48" fill="none" stroke-width="1"/>
        <text x="171" y="146" text-anchor="middle">INPUT</text>
        <text x="389" y="146" text-anchor="middle">STATE</text>
        <text x="280" y="115" text-anchor="middle">B2 · 契约与非法状态收紧</text>
      </g>
      <g class="plate-node" data-plate-node="2">
        <rect x="86" y="246" width="388" height="44" fill="none" stroke-width="1.4"/>
        <path d="M168 238V246M280 238V246M392 238V246" fill="none" stroke-width="1.4"/>
        <text x="168" y="273" text-anchor="middle">CLOCK</text>
        <text x="280" y="273" text-anchor="middle">RNG / NET</text>
        <text x="392" y="273" text-anchor="middle">STORAGE</text>
        <text x="280" y="308" text-anchor="middle">B3 · 可替换的非确定性底座</text>
      </g>
    </svg>`,
  });
}

export function createGatePlate() {
  return buildInteractivePlate({
    captionLeft: '图版 01 / 四级递进门禁与基线防篡改',
    captionRight: '阅读辅助 · 交付治理流程',
    roleLabel: '选择交付门禁层级',
    items: GATES,
    keyHint: '主干实线：从基线读取的强制规则<br>上行虚线：阻断自改门禁规则的变更',
    readingKey: '判定规则固定由基线读取，变更包只需提交证据包并接受同一尺度的检验。',
    footerLabel: '放行底线',
    activeAttr: 'data-active-gate',
    drawingSvg: `<svg viewBox="0 0 560 320" class="plate-svg plate-svg-gate">
      <g class="plate-grid" stroke="#577278" stroke-width="0.6" opacity="0.45">
        <path d="M36 160H524M36 86H524M36 244H524"/>
      </g>
      <path d="M44 244H516" fill="none" stroke="#8f9c8c" stroke-width="1" stroke-dasharray="4 5"/>
      <text x="48" y="264" fill="#c0cbc1" font-size="11">MAIN BASELINE · 门禁定义固定自基线仓库读取</text>
      <path d="M126 160H194M246 160H314M366 160H434" fill="none" stroke="#8f9c8c" stroke-width="1.3"/>
      <g class="plate-node" data-plate-node="0">
        <path d="M100 112V244" fill="none" stroke-width="1" stroke-dasharray="3 4"/>
        <circle cx="100" cy="160" r="26" fill="none" stroke-width="1.5"/>
        <text x="100" y="164" text-anchor="middle">G0</text>
        <text x="100" y="102" text-anchor="middle">静态与构建</text>
      </g>
      <g class="plate-node" data-plate-node="1">
        <path d="M220 112V244" fill="none" stroke-width="1" stroke-dasharray="3 4"/>
        <circle cx="220" cy="160" r="26" fill="none" stroke-width="1.5"/>
        <text x="220" y="164" text-anchor="middle">G1</text>
        <text x="220" y="102" text-anchor="middle">增量性质</text>
      </g>
      <g class="plate-node" data-plate-node="2">
        <path d="M340 112V244" fill="none" stroke-width="1" stroke-dasharray="3 4"/>
        <circle cx="340" cy="160" r="26" fill="none" stroke-width="1.5"/>
        <text x="340" y="164" text-anchor="middle">G2</text>
        <text x="340" y="102" text-anchor="middle">仿真与预算</text>
      </g>
      <g class="plate-node" data-plate-node="3">
        <path d="M460 112V244" fill="none" stroke-width="1" stroke-dasharray="3 4"/>
        <rect x="434" y="134" width="52" height="52" rx="4" fill="none" stroke-width="1.6"/>
        <text x="460" y="164" text-anchor="middle">G3</text>
        <text x="460" y="102" text-anchor="middle">证据与发布</text>
      </g>
    </svg>`,
  });
}
