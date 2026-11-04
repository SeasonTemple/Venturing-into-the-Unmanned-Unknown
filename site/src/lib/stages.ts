// 阶段骨架：首屏闭环图与首页「推荐阅读顺序」共用。
// orders 对应 book.config.json 的 chapter.order；链接默认指向 orders[0]。
export const stages = [
  { zh: '意图', en: 'Intent', orders: ['1'], handoff: '可判定验收' },
  { zh: '设计', en: 'Design', orders: ['2'], handoff: '契约与边界' },
  { zh: '实现', en: 'Implement', orders: ['3'], handoff: '可检查产物' },
  { zh: '正确性', en: 'Correctness', orders: ['4', '5'], handoff: '性质级证据' },
  { zh: '交付', en: 'Deliver', orders: ['6'], handoff: '门禁与回滚' },
  { zh: '演进', en: 'Evolve', orders: ['7'], handoff: '回归与新意图' },
];
