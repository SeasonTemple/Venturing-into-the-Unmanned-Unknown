const layers = [
  ['L0','意图与表达','需求是否被清晰表达？','受控写作 / 正反例 / 不变量','受控需求、验收条件与不变量清单','表达清楚，不代表设计已经正确。'],
  ['L1','设计正确性','协议与状态转换是否满足性质？','模型检查 / 状态空间探索','协议模型、性质声明与模型检查反例','模型中的保证，仍依赖建模假设。'],
  ['L2','实现安全与局部正确性','实现的关键路径是否安全？','契约 / 有界检查 / 语言级工具','函数契约、分析边界与关键路径检查结果','局部性质，不能代替完整行为验证。'],
  ['L3','行为符合性','选定场景中的行为是否符合预期？','测试 / 场景与属性用例','场景用例、属性测试与差异测试结果','已测场景之外，仍可能有遗漏。'],
  ['L4','持续保证','这次变更是否破坏已有保证？','CI / 自动化回归','CI记录、回归结果与对应变更基线','持续执行，不能补上未定义的检查。'],
  ['L5','可理解性与审计','结果能否被解释与追溯？','反例解释 / 文档 / 差异对比','规格、实现与验证结果之间的追溯记录','可追溯的证据，也有适用条件。'],
];

export function createLayerPlate() {
  const figure=document.createElement('figure');figure.className='field-plate journal-extra';
  const shape='M80 62L330 10L520 58L270 111Z';
  const grid='M130 52L320 101M180 41L370 90M230 31L420 79M280 20L470 69M118 72L368 20M156 82L406 29M194 92L444 39M232 102L482 48';
  figure.innerHTML=`<figcaption><span>图版 01 / 证据照到哪一层？</span><span>阅读辅助 · 据本章 L0–L5 模型</span></figcaption>
    <div class="layer-select" role="group" aria-label="选择验证层级">${layers.map((l,i)=>`<button aria-pressed="${i===0}" data-layer="${i}">${l[0]}<span>${l[1]}</span></button>`).join('')}</div>
    <div class="layer-detail"><div class="layer-drawing" aria-hidden="true"><svg viewBox="0 0 600 430">
      <defs><radialGradient id="slice-light"><stop stop-color="#f5cc86" stop-opacity=".85"/><stop offset="1" stop-color="#eeb480" stop-opacity=".08"/></radialGradient><linearGradient id="slice-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5cc86" stop-opacity=".40"/><stop offset="1" stop-color="#f5cc86" stop-opacity=".04"/></linearGradient></defs>
      <g class="slice-stack">${[...layers].reverse().map((l,j)=>{const i=5-j;return `<g class="evidence-slice" data-slice="${i}" transform="translate(0 ${i*49+32})"><path class="slice-plane" d="${shape}"/><path class="slice-grid" d="${grid}"/><text x="24" y="67">${l[0]}</text></g>`;}).join('')}</g>
      <path id="layer-beam" fill="url(#slice-beam)"/>
      <g id="lit-plane"><path class="active-plane" d="${shape}"/><path class="active-grid" d="${grid}"/><path class="coverage-patch" fill="url(#slice-light)" d="M185 64L318 35L408 58L277 88Z"/><path class="coverage-edge" d="M185 64L318 35L408 58L277 88Z"/></g>
      <circle class="layer-lamp-halo" cx="475" cy="16" r="12"/><circle class="layer-lamp" cx="475" cy="16" r="4"/><text x="495" y="21">证据</text><text id="layer-code" x="544" y="115">L0</text>
    </svg><p class="layer-diagram-key">亮区：当前适用范围<br>虚线之外：未覆盖条件</p></div><div class="layer-caption"><p class="kicker" id="layer-name"></p><h3 id="layer-question"></h3><p class="layer-method" id="layer-method"></p><dl class="layer-artifact"><dt>可核对的产物</dt><dd id="layer-evidence"></dd></dl><p class="layer-reading-key">层号区分保证的角度；一层的证据不能自动照亮其余层。</p></div></div>
    <p class="layer-limit"><span>光照之外</span><span id="layer-limit"></span></p><p class="sr-only" id="layer-announcement" role="status"></p>`;
  function select(i,announce=false) {
    const layer=layers[i],offset=i*49+32;
    figure.dataset.litLayer=layer[0];
    figure.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.layer)===i)));
    figure.querySelectorAll('[data-slice]').forEach(g=>g.classList.toggle('selected',Number(g.dataset.slice)===i));
    for(const [id,value] of [['layer-code',layer[0]],['layer-name',layer[0]+' / '+layer[1]],['layer-question',layer[2]],['layer-method',layer[3]],['layer-evidence',layer[4]],['layer-limit',layer[5]]])figure.querySelector('#'+id).textContent=value;
    figure.querySelector('#lit-plane').setAttribute('transform',`translate(0 ${offset})`);
    figure.querySelector('#layer-code').setAttribute('y',String(offset+66));
    figure.querySelector('#layer-beam').setAttribute('d',`M475 16L185 ${offset+64}L408 ${offset+58}Z`);
    if(announce)figure.querySelector('#layer-announcement').textContent=layer[2]+'可核对的产物：'+layer[4]+'。'+layer[5];
  }
  figure.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>select(Number(b.dataset.layer),true)));
  select(0);return figure;
}
