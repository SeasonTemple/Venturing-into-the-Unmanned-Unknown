// 语义块：公理 / 不变量 / 约束 / 反模式。Sätteri（Astro 7 默认 Markdown 处理器）的 hast 插件。
// 只加样式钩子，不改正文：blockquote 的第一段以加粗关键词开头时，给该 blockquote 加 class。
//   > **公理**：……            -> .mt-block.mt-axiom
//   > **不变量 I1**：……        -> .mt-block.mt-invariant
//   > **约束**：……            -> .mt-block.mt-constraint
//   > **反模式：……**          -> .mt-block.mt-antipattern
// 关键词后允许紧跟空格、编号或冒号；不满足「第一段第一个元素是 strong 且以关键词开头」的 blockquote 不受影响。
const KINDS = [
  ['公理', 'axiom'],
  ['不变量', 'invariant'],
  ['约束', 'constraint'],
  ['反模式', 'antipattern'],
];

const textOf = (n) => (n.type === 'text' ? n.value : (n.children ?? []).map(textOf).join(''));
const isWs = (n) => n.type === 'text' && !n.value.trim();

export const semanticBlocks = {
  name: 'mt-semantic-blocks',
  element: {
    filter: ['blockquote'],
    visit(node, ctx) {
    const para = (node.children ?? []).find((n) => !isWs(n));
    if (!para || para.type !== 'element' || para.tagName !== 'p') return;
    const lead = (para.children ?? []).find((n) => !isWs(n));
    if (!lead || lead.type !== 'element' || lead.tagName !== 'strong') return;
    const t = textOf(lead).trimStart();
    const hit = KINDS.find(([zh]) => t.startsWith(zh));
    if (!hit) return;
    ctx.setProperty(node, 'className', ['mt-block', 'mt-' + hit[1]]);
    ctx.setProperty(node, 'data-mt-block', hit[1]);
    },
  },
};
