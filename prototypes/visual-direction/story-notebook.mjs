// Contextual paraphrases of the book, not quotations or chapter-completion marks.
// Evidence keys belong to story-rehearsal.mjs. A revisit never removes an addition.
const pages=[
 {id:'field',title:'雨后的第一份回传',chapter:'行动记录',sketch:true,notes:[
  {on:'task',at:'接下委托',human:'带回 R1 的本次观测。站房到 R1 是这次要走的一段；更远处先留白。',agent:'T01 / 目标 R1；本地采集、离线带回。范围到 R1。'},
  {on:'baseline',at:'站内旧缓存',human:'站里只有雨前采样的一份。先保留它，回来才有可对照的基线。',agent:'OBS-01 / 保留雨前缓存、来源与采样时点，作为本次基线。'},
  {on:'local',at:'R1 本地端口',human:'这里已有雨后的新记录。站里没收到，不等于这里没有；原因还不能下结论。',agent:'OBS-02 / 雨后样本，经 R1 本地端口读取；原因未定位，尚未提交。'},
  {on:'receipt',at:'回站采用',human:'采用这份新资料，更新范围到 R1。旧记录保留；“离线带回”不能写成“链路恢复”。',agent:'ACK-01 / 人工确认后追加 OBS-02，关联 OBS-01。覆盖到 R1，未声明通信恢复。'},
  {on:'boundary',at:'坡肩停步',human:'远处有一点反光，还没有定位和测量。图到这里有依据，路却仍向前。',agent:'OPEN-01 / 视觉线索；无定位、无本次测量，不扩大 T01 范围。'},
  {on:'nextTask',at:'下一次草案',human:'下一次先定位那一点，再决定是否延伸观测线。这一页留给之后续写。',agent:'T02-DRAFT / 定位反光点；执行范围待确认，未派发。'}
 ]},
 {id:'intent',title:'先说清，要带回什么',chapter:'第 1 章 · 意图与需求',principle:'目标、边界和完成依据，应当能被共同理解与检查；新的发现还会让意图继续修订。',notes:[
  {on:'task',at:'接下委托 · 初记',human:'“去看看”太含糊。这次要带回 R1 的本次资料；带回后核对来源和范围。没有委托我判断更远一段。',agent:'任务需显式区分目标、边界与验收：取回本次资料，保留来源，供站端复核。'},
  {on:'receipt',at:'回站 · 补记',human:'本次资料已接收，委托可以结束。还有未查明的原因，不妨碍把已做与未做分清。',agent:'已取得本次回执；未查明事项独立保留，不把 T01 的完成扩大为全线恢复。'},
  {on:'nextTask',at:'坡肩 · 续写',human:'新委托从新问题开始：先定位反光点，再决定观测范围。上一份目标不偷偷改大。',agent:'新问题建立 T02 草案并等待确认，不静默改写已接收任务的范围。'}
 ]},
 {id:'verification',title:'证据，能照到哪里',chapter:'第 3 章 · 验证',principle:'结论必须说明依据、假设和适用范围；验证手段随风险分层，测试与形式化验证各有分工。',notes:[
  {on:'baseline',at:'站内 · 初记',human:'“没有本次回传”只描述站内所见。还不足以写成“中继损坏”——先把观察和猜测分开。',agent:'仅知站端缺少新样本；无故障原因证据。将原因记为待查。'},
  {on:'local',at:'R1 · 补记',human:'灯亮，只说明设备有某种状态。读到资料后，还要看来源、采样时间和读取方式。',agent:'亮灯不作可信判据；保留来源 R1、雨后采样、本地读取三个可核对字段。'},
  {on:'receipt',at:'复核后 · 续写',human:'新资料支持更新到 R1；没有证明整条线路恢复。能采用一份记录，与能解释故障，是两件事。',agent:'接收的覆盖范围到 R1；记录采用结果，不生成端到端修复结论。'},
  {on:'boundary',at:'坡肩 · 页边留问',human:'看见，不等于测过。下一次需要什么证据，才可以把远处那一段描实？',agent:'远处仅有视觉线索；下一轮需定位与测量，满足条件后才提议扩大记录范围。'}
 ],caveat:'此处是证据边界的情境化入门；现场取回资料不等同于完成形式化验证。'},
 {id:'roles',title:'采到以后，还要由谁决定',chapter:'第 0 章 · 导论',principle:'Agent 承担生产与执行，人提供意图和环内裁决，系统保证提供可重复的否决与放行。',notes:[
  {on:'receipt',at:'交接 · 初记',human:'带回候选资料后，我确认采用范围，才写入共同记录。执行、判断和检查各有责任。',agent:'采集者保留候选与来源，等待授权追加；不因已采集就自行扩大任务。'}
 ],caveat:'本段只体验采集与授权；独立系统门禁留待后续配置试运行，不宣称已体验完整 AI 原生流程。'}
];

export function notebookPages(entries,role='human'){
 const acquired=new Set(entries),voice=role==='agent'?'agent':'human';
 return pages.map(page=>({...page,notes:page.notes.filter(note=>acquired.has(note.on)).map(note=>({on:note.on,at:note.at,text:note[voice]}))})).filter(page=>page.notes.length);
}

// First short outing remains one afternoon. Larger time/weather changes belong
// to explicit later story segments, not computer time or a reading timer.
export const firstOutingEnvironment=[
 {time:'雨后 · 午后',place:'站前低地',weather:'云隙放晴，草叶仍湿，屋顶与草梢保持同一风向。',effect:'站内缓存较旧；降雨是事件背景，尚不能认定是缺失回传的原因。'},
 {time:'同一午后',place:'檐下工位',weather:'檐下避风，屋外仍有滴水；桌面接住稳定的散射天光。',effect:'在干燥工位翻记、确认任务。'},
 {time:'同一午后',place:'站内记录器',weather:'延续上一镜的天光与风向，翻阅不改变天气。',effect:'保留雨前采样的时间与来源，区别于当前环境。'},
 {time:'午后 · 短途步行后',place:'R1 水道边',weather:'离开建筑遮蔽，横风更明显；草边泥湿，端口有防雨罩。',effect:'沿维护路接近，在罩下接入；能读取不表示实时链路恢复。'},
 {time:'午后 · 返回工位',place:'原来的檐下',weather:'仍是同一场雨后的光线，滴水渐少，湿痕还在。',effect:'回到同一地点核对资料；不靠突然入夜表现完成。'},
 {time:'午后 · 抵达坡肩',place:'暴露坡肩',weather:'风更强，近坡遮挡解除，远处仍有低云；日光没有变成雾墙。',effect:'风与距离影响辨识，只圈下反光，不能把目视写成测量。'},
 {time:'同一午后',place:'坡肩停留',weather:'保持刚才的风、云和光；打开手记不会推进剧情时钟。',effect:'原地整理，或主动回站。后续傍晚片段通过明确转场进入。'}
];
