// 六个阶段是本书方法论的固定骨架：首屏闭环图与首页「推荐阅读顺序」路径条共用这一份词汇。
// orders 是该阶段对应的章号（取自 book.config.json 的 order），链接指向 orders[0]。
export const stages = [
  { zh: '意图', en: 'Intent', orders: ['1'], handoff: '验收标准' },
  { zh: '设计', en: 'Design', orders: ['2'], handoff: '接口契约' },
  { zh: '实现', en: 'Implement', orders: ['4'], handoff: '验证资产' },
  { zh: '验证', en: 'Verify', orders: ['3', '5'], handoff: '质量门禁' },
  { zh: '交付', en: 'Deliver', orders: ['6'], handoff: '运行反馈' },
  { zh: '演进', en: 'Evolve', orders: ['7'], handoff: '新意图' },
];
