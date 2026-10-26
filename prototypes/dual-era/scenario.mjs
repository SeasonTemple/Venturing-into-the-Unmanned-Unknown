// Shared task facts and acceptance rules. Rendering never decides acceptance.
export const CHECKS = {
  interface: { label: '接口兼容', pass: '接头规格一致，数据到达指定接收端。', fail: '近路使用旧规格接头，连接看似成立，数据不能被接收。' },
  backup: { label: '备用接替', pass: '注入主线路故障后，备用路径完成传输。', fail: '主线路失效后没有可用备用路径。' },
  isolation: { label: '异常隔离', pass: '异常段可以隔离，检查记录可定位到部件。', fail: '异常无法隔离或没有定位记录。' },
  interference: { label: '新环境干扰', pass: '新屏蔽要求已落实，并通过干扰条件检查。', fail: '新的外部干扰条件尚未被处理。' },
};
export function createTask(mode = 'human') {
  if (!['human', 'agent'].includes(mode)) throw new Error('Unknown execution mode');
  return { mode, phase: 'survey', revision: 0, candidate: null, evidence: {}, harness: [], disturbed: false, accepted: false, history: [] };
}
export const requiredChecks = (s) => ['interface', 'backup', 'isolation', ...(s.disturbed ? ['interference'] : [])];
export const canDeploy = (s) => !!s.candidate && requiredChecks(s).every(k => s.evidence[k]?.revision === s.revision && s.evidence[k]?.pass === true);
export function transition(previous, event) {
  const s = structuredClone(previous);
  const require = (value, message) => { if (!value) throw new Error(message); };
  let message;
  switch (event.type) {
    case 'SURVEY':
      require(s.phase === 'survey', '任务已经确认'); s.phase = 'ready';
      message = '共同验收：兼容接口、备用接替、异常隔离。'; break;
    case 'SET_CHECK':
      require(CHECKS[event.key], '未知检查项');
      s.harness = event.enabled ? [...new Set([...s.harness, event.key])] : s.harness.filter(k => k !== event.key);
      message = `${event.enabled ? '配置' : '移除'}检查：${CHECKS[event.key].label}。已有证据不会因选择框被伪造。`; break;
    case 'CONFIGURE':
      s.harness = requiredChecks(s); message = '把当前验收条件加入检查清单；仍须执行检查取得证据。'; break;
    case 'BUILD':
      require(s.phase === 'ready', '先确认任务目标');
      // Both strategies produce the same first candidate; only execution differs.
      s.candidate = { connector: 'legacy', backup: true, isolation: true, shielded: false };
      s.revision++; s.evidence = {}; s.phase = 'candidate';
      message = '两条线路已形成候选，尚无验收证据，暂未接入运行。'; break;
    case 'CHECK': {
      require(s.candidate && !s.accepted, '当前没有待检查的候选');
      const enabled = s.mode === 'human' ? requiredChecks(s) : s.harness.filter(k => requiredChecks(s).includes(k));
      const results = { interface: s.candidate.connector === 'current', backup: s.candidate.backup, isolation: s.candidate.isolation, interference: s.candidate.shielded };
      s.evidence = Object.fromEntries(enabled.map(k => [k, { revision: s.revision, pass: !!results[k], detail: results[k] ? CHECKS[k].pass : CHECKS[k].fail }]));
      s.phase = 'evidence';
      const failed = enabled.filter(k => !results[k]);
      const missing = requiredChecks(s).filter(k => !enabled.includes(k));
      message = [failed.length ? `发现：${failed.map(k => CHECKS[k].label).join('、')}未通过。` : '已执行的检查未发现失败。', missing.length ? `缺少：${missing.map(k => CHECKS[k].label).join('、')}的证据。` : '', canDeploy(s) ? '当前明确条件已满足，可选择接入。' : '保留候选状态，不能接入运行。'].filter(Boolean).join(' ');
      break;
    }
    case 'FIX':
      require(s.candidate && s.evidence.interface?.pass === false, '先定位接口问题');
      s.candidate.connector = 'current'; s.revision++; s.evidence = {}; s.phase = 'candidate';
      message = '已更换兼容接头。候选版本改变，原有检查证据作废，需要重新检查。'; break;
    case 'DEPLOY':
      require(canDeploy(s), '检查证据不完整、失败或已过期，不能接入运行');
      s.accepted = true; s.phase = 'operating';
      message = '在当前已知条件下，中继与备用链路恢复。外部未知仍然存在。'; break;
    case 'ENV_CHANGE':
      require(s.accepted && !s.disturbed, '当前不能触发新环境事件');
      s.disturbed = true; s.accepted = false; s.evidence = {}; s.phase = 'disturbance';
      message = '共同事件：外部频段出现新干扰。原验收未覆盖此条件，补充要求后重新验证。'; break;
    case 'ADAPT':
      require(s.phase === 'disturbance', '当前没有新的环境问题');
      s.candidate.shielded = true; s.revision++; s.evidence = {}; s.phase = 'candidate';
      if (s.mode === 'agent') s.harness = [...new Set([...s.harness, 'interference'])];
      message = '已增加屏蔽并补充新干扰条件。修复完成仍需重新取得证据。'; break;
    default: throw new Error('Unknown task event');
  }
  s.history.push({ index: s.history.length + 1, event: structuredClone(event), revision: s.revision, message });
  return s;
}
export function actionsFor(s) {
  if (s.phase === 'survey') return [{ type: 'SURVEY', label: s.mode === 'human' ? '到现场确认任务' : '在意图台确认目标与约束', node: 'relay' }];
  if (s.phase === 'ready') return [{ type: 'BUILD', label: s.mode === 'human' ? '亲自装配主线与备用线' : '派发接口、主线与备用任务', node: 'relay' }];
  if (s.phase === 'disturbance') return [{ type: 'ADAPT', label: s.mode === 'human' ? '定位干扰，增加屏蔽' : '修订任务与约束，委派屏蔽修复', node: 'relay' }];
  if (s.accepted) return s.disturbed ? [] : [{ type: 'ENV_CHANGE', label: '继续接收外部环境反馈', node: 'receiver' }];
  const actions = [];
  if (s.evidence.interface?.pass === false) actions.push({ type: 'FIX', label: s.mode === 'human' ? '更换兼容接头' : '依据失败证据委派修正', node: 'relay' });
  if (s.mode === 'agent' && requiredChecks(s).some(k => !s.harness.includes(k))) actions.push({ type: 'CONFIGURE', label: '把当前验收条件加入门禁', node: 'console' });
  actions.push({ type: 'CHECK', label: s.mode === 'human' ? '使用工具运行当前完整检查' : '运行已配置的检查门禁', node: 'verify' });
  if (canDeploy(s)) actions.unshift({ type: 'DEPLOY', label: s.mode === 'human' ? '确认并接入运行' : '审阅证据，放行当前提交', node: 'receiver' });
  return actions;
}
