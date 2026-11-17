// Layered-SVG + Monoline Geometric verification plate for Chapter 4 (L0-L5).
const layers = [
  ['L0','意图与可判定基线','这轮改动的判定标准与非目标写清了吗？','意图基线 / 正反例 / 已知未知清单','可判定的目标范围、排除项与待确认清单','写清意图不代表协议或代码天然正确。'],
  ['L1','端到端运行时路径','真实用户关键链路是否亲手跑通并留痕？','真实应用启动 / E2E 驱动 / 功能地图','截图、DOM 或接口状态快照与可审计日志','走通一条热路径，无法穷举并发交错与边界输入。'],
  ['L2','设计层协议与状态机','跨进程交错与失效恢复是否存在反例？','D1–D6 准入评估 / 模型检查（TLA+、Quint、Alloy）','有限边界协议模型、Safety/Liveness 性质与轨迹','模型只在有界节点与环境假设内成立，外部硬件与需求误写在其信任边界之外。'],
  ['L3','实现层契约与局部证明','关键函数前置条件与内存/数值边界守住了吗？','函数契约 / 有界模型检查（Kani、CBMC） / 静态分析','前后置断言记录、求解边界与编译器静态门禁','单个函数安全不等于跨模块整体行为正确。'],
  ['L4','持续行为与回归验证','面对随机输入变化与预算压力是否仍然稳固？','属性测试 / 差异测试 / Fuzz / 确定性仿真','属性种子、差异基线与性能预算对照表','既有用例回归通过，不代表未定义输入面安全。'],
  ['L5','门禁聚合与可审计记录','所有绿灯能否诚实标明未覆盖边界并一键重放？','性质账本 / 覆盖汇总 / 独立门禁脚本','含已查性质、未覆盖边界与可重放指针的结构化证据包','汇总账本不能替任何底层检查补票。'],
];

const glyphs = [
  'M208 68L298 48L392 72M244 82L356 57',
  'M192 67L255 53L312 67L396 48M192 67A3 3 0 1 1 191.9 67M312 67A3 3 0 1 1 311.9 67M396 48A3 3 0 1 1 395.9 48',
  'M256 61L300 51L344 61L300 71ZM300 51V71',
  'M230 56V70H242M370 52V66H358M268 61H332',
  'M224 62A2 2 0 1 1 223.9 62M264 53A2 2 0 1 1 263.9 53M304 64A2 2 0 1 1 303.9 64M344 55A2 2 0 1 1 343.9 55',
  'M215 61H385M268 48V74M332 48V74',
];

export function createLayerPlate() {
  const figure = document.createElement('figure');
  figure.className = 'field-plate journal-extra';
  const shape = 'M80 62L330 10L520 58L270 111Z';
  const grid = 'M130 52L320 101M180 41L370 90M230 31L420 79M280 20L470 69M118 72L368 20M156 82L406 29M194 92L444 39M232 102L482 48';
  figure.innerHTML = `<figcaption><span>图版 01 / 证据照到哪一层？（分层剖面）</span><span>阅读辅助 · 据本章 L0–L5 模型</span></figcaption>
    <div class="layer-select" role="group" aria-label="选择验证层级">${layers.map((l, i) => `<button aria-pressed="${i === 0}" data-layer="${i}">${l[0]}<span>${l[1]}</span></button>`).join('')}</div>
    <div class="layer-controls"><label class="layer-spread-control"><span>剖面层距</span><input type="range" class="layer-spread-range" min="0" max="100" value="48" aria-label="调节验证层级剖面展开间距" /><span class="layer-spread-value">48%</span></label></div>
    <div class="layer-detail"><div class="layer-drawing" aria-hidden="true"><svg viewBox="0 0 600 440">
      <defs><radialGradient id="slice-light"><stop stop-color="#f5cc86" stop-opacity=".85"/><stop offset="1" stop-color="#eeb480" stop-opacity=".08"/></radialGradient><linearGradient id="slice-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5cc86" stop-opacity=".40"/><stop offset="1" stop-color="#f5cc86" stop-opacity=".04"/></linearGradient></defs>
      <g class="slice-stack">${[...layers].reverse().map((l, j) => {
        const i = 5 - j;
        return `<g class="evidence-slice" data-slice="${i}"><path class="slice-plane" d="${shape}"/><path class="slice-grid" d="${grid}"/><path class="slice-mark" d="${glyphs[i]}"/><text x="24" y="67">${l[0]}</text></g>`;
      }).join('')}</g>
      <path id="layer-beam" fill="url(#slice-beam)"/>
      <g id="lit-plane"><path class="active-plane" d="${shape}"/><path class="active-grid" d="${grid}"/><path class="active-mark" d="${glyphs[0]}"/><path class="coverage-patch" fill="url(#slice-light)" d="M185 64L318 35L408 58L277 88Z"/><path class="coverage-edge" d="M185 64L318 35L408 58L277 88Z"/></g>
      <circle class="layer-lamp-halo" cx="475" cy="16" r="12"/><circle class="layer-lamp" cx="475" cy="16" r="4"/><text x="495" y="21">证据</text><text id="layer-code" x="544" y="115">L0</text>
    </svg><p class="layer-diagram-key">亮区：当前适用范围<br>虚线之外：未覆盖条件</p></div><div class="layer-caption"><p class="kicker" id="layer-name"></p><h3 id="layer-question"></h3><p class="layer-method" id="layer-method"></p><dl class="layer-artifact"><dt>可核对的产物</dt><dd id="layer-evidence"></dd></dl><p class="layer-reading-key">拖动“剖面层距”可剥离各层平面；一层的证据不能自动照亮其余层。</p></div></div>
    <p class="layer-limit"><span>光照之外</span><span id="layer-limit"></span></p><p class="sr-only" id="layer-announcement" role="status"></p>`;

  const sliceGroups = [...figure.querySelectorAll('[data-slice]')];
  const litPlane = figure.querySelector('#lit-plane');
  const activeMark = figure.querySelector('.active-mark');
  const layerCode = figure.querySelector('#layer-code');
  const layerBeam = figure.querySelector('#layer-beam');
  const range = figure.querySelector('.layer-spread-range');
  const rangeValue = figure.querySelector('.layer-spread-value');
  const drawing = figure.querySelector('.layer-drawing');

  let activeIndex = 0;
  let spread = Number(range.value) / 100;
  let tiltX = 0, tiltY = 0, targetX = 0, targetY = 0, frame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  function planePos(i) {
    const step = 20 + spread * 34;
    const baseY = 160 - step * 2.5;
    const depthBias = (i - 2.5) * (0.4 + spread * 0.6);
    return {
      dx: tiltX * depthBias * 7,
      dy: baseY + i * step + tiltY * depthBias * 4,
    };
  }

  function layout() {
    for (const group of sliceGroups) {
      const i = Number(group.dataset.slice);
      const { dx, dy } = planePos(i);
      group.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    }
    const { dx, dy } = planePos(activeIndex);
    litPlane.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    layerCode.setAttribute('x', (544 + dx).toFixed(1));
    layerCode.setAttribute('y', (dy + 66).toFixed(1));
    layerBeam.setAttribute('d', `M475 16L${(185 + dx).toFixed(1)} ${(dy + 64).toFixed(1)}L${(408 + dx).toFixed(1)} ${(dy + 58).toFixed(1)}Z`);
  }

  function stepTilt() {
    tiltX += (targetX - tiltX) * 0.14;
    tiltY += (targetY - tiltY) * 0.14;
    layout();
    if (Math.abs(targetX - tiltX) + Math.abs(targetY - tiltY) > 0.002) {
      frame = requestAnimationFrame(stepTilt);
    } else {
      tiltX = targetX;
      tiltY = targetY;
      layout();
      frame = 0;
    }
  }

  function aim(nx, ny) {
    targetX = nx;
    targetY = ny;
    if (!frame) frame = requestAnimationFrame(stepTilt);
  }

  function select(i, announce = false) {
    activeIndex = i;
    const layer = layers[i];
    figure.dataset.litLayer = layer[0];
    figure.querySelectorAll('[data-layer]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.layer) === i)));
    sliceGroups.forEach(g => g.classList.toggle('selected', Number(g.dataset.slice) === i));
    activeMark.setAttribute('d', glyphs[i]);
    for (const [id, value] of [
      ['layer-code', layer[0]],
      ['layer-name', `${layer[0]} / ${layer[1]}`],
      ['layer-question', layer[2]],
      ['layer-method', layer[3]],
      ['layer-evidence', layer[4]],
      ['layer-limit', layer[5]],
    ]) figure.querySelector('#' + id).textContent = value;
    layout();
    if (announce) figure.querySelector('#layer-announcement').textContent = `${layer[2]}可核对的产物：${layer[4]}。${layer[5]}`;
  }

  figure.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => select(Number(b.dataset.layer), true)));
  range.addEventListener('input', () => {
    spread = Number(range.value) / 100;
    rangeValue.textContent = `${range.value}%`;
    layout();
  });
  drawing.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches) return;
    const rect = drawing.getBoundingClientRect();
    aim(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
  });
  drawing.addEventListener('pointerleave', () => aim(0, 0));

  select(0);
  return figure;
}
