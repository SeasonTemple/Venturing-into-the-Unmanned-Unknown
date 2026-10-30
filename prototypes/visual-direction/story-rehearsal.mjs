import {notebookPages,firstOutingEnvironment} from './story-notebook.mjs';

export const beats=[
 {title:'风从屋顶经过',shot:'poster',kind:'认可原画 / 开场取景',camera:'原画全景 → 檐下。进入时书名退开，先保留风与空间。',intent:'先认识这个地方，再接下一件具体的事。',visible:'雨停后的原野仍然明亮。站房、维护路与远方小设施连成一条尚未走过的线。',consequence:'进入不会自动领取任务，也不会先弹出整本书。',human:'雨停了。站内的回传还停在雨前。',agent:'站内等待本次回传。任务尚未接收。'},
 {title:'一份小委托',shot:'workbench',kind:'原画裁切 / 近景待制作',camera:'檐下近景：手、记录器、路线小图。持书与端口资产待制作。',intent:'目标足够小，边界足够清楚。',visible:'站房到 R1 的路线在草图上连着；R1 后的线没有画完。载体任务写明本地采集、离线带回。',consequence:'记下“带回 R1 的本次观测”，更远一段留待下一次。',human:'带回 R1 的本次观测。更远一段，先不作结论。',agent:'任务 T01：到 R1 采集，离线带回。范围到 R1。'},
 {title:'工位上留下基线',shot:'workbench',kind:'原画裁切 / 接口近景待制作',camera:'保持机位，焦点从工作簿移向记录器的旧条目。',intent:'先知道站里现在有什么，才能判断带回了什么。',visible:'站端缓存来自 R1，采样在降雨前。本次回传为空；这不足以宣布中继损坏。',consequence:'留一份旧缓存基线，不把旧样本再次登记成新资料。',human:'站里只有雨前的一份。去 R1 看看。',agent:'缓存基线：来源 R1，雨前采样；本次资料缺失。'},
 {title:'沿维护路，走到 R1',shot:'relay',kind:'机位示意 / 新场景待制作',camera:'工位 → 器材遮挡 → 路弯 → R1。本地端口读取，不用镜头平移冒充行走。',intent:'带着问题抵达，动作产生新的证据。',visible:'潮湿地面、可接近的端口。本地存储中有雨后的新记录，站内却还没有这一份。',consequence:'取回来源为 R1 的本地资料，传输中断的具体原因仍待查。',human:'这边已经有了。站里还没收到。',agent:'本地资料可读取。保留来源与采集方式，准备离线带回。'},
 {title:'把资料带回来',shot:'return',kind:'原画裁切 / 交接动作待制作',camera:'回到同一工位，资料并置；提交后只更新站房至 R1 的一段。',intent:'采到资料与采用资料之间，留给人一次判断。',visible:'旧缓存与新资料可以同时成立。需要核对来源、采样时点、覆盖范围，不能宣称整条线路恢复。',consequence:'可暂存、复查或确认提交。旧条目留在原处，新条目和回执彼此关联。',human:'采用这一份，范围只记到 R1。',agent:'候选资料已备妥。等待委托人确认采用范围。'},
 {title:'最后一个有依据的点',shot:'boundary',kind:'机位示意 / 边界分镜待制作',camera:'草坡遮挡 → 最后几步 → 地平线展开。先看远处，再主动翻记录。',intent:'让“可靠的部分到这里”为眼前的空间关系。',visible:'近处有 R1 和来路，远处细路继续延伸，一点反光无法辨认。没有必要把明亮原野变成黑暗雾墙。',consequence:'留下未测量线索；本次任务不会自动扩展到远处。',human:'路还在。我们带回来的，只到这里。',agent:'本次采集到 R1。远处反光尚无定位与测量。'},
 {title:'留下一页，准备下一次',shot:'boundary',kind:'机位示意 / 收束分镜待制作',camera:'停在坡肩。记录只露一角；主动打开，合上仍回这里。',intent:'一次小任务完成，世界仍然比记录更大。',visible:'手记留着旧线、新笔和下一段未完成的草图；档案保留任务、采集、授权与回执。',consequence:'可以留在这里、回站整理，或写下一份委托。阅读与继续探索彼此独立。',human:'下一次，先弄清远处那一点是什么。',agent:'任务 T01 已有回执。下一份任务范围等待确认。'}
];

const evidence={
 task:{source:'工位委托 / T01',human:'带回 R1 的本次观测；更远一段，先不作结论。',agent:'T01 · 目标 R1，本地采集、离线带回；任务边界已记录。'},
 baseline:{source:'站端缓存 / 雨前采样',human:'站里只有雨前的一份。还不能判断中继点发生了什么。',agent:'OBS-01 · 来源 R1；站内缓存；本次资料缺失。'},
 local:{source:'R1 本地端口 / 雨后采样',human:'R1 有雨后的新资料。我把它带回去，与站里那份对照。',agent:'OBS-02 · 来源 R1 本地读取；保存本次资料，尚未提交站端。'},
 receipt:{source:'工位复核 / 人工确认后接收',human:'采用本次资料，范围到 R1；旧记录保留，注明离线带回。',agent:'ACK-01 · 委托人已确认；追加 OBS-02，关联 OBS-01；覆盖至 R1。'},
 boundary:{source:'R1 坡肩 / 视觉线索',human:'在图上圈下远处反光。路还在，这一段仍没有测量。',agent:'OPEN-01 · 仅视觉线索，无本次定位与测量；任务范围未扩展。'},
 nextTask:{source:'下一次委托 / 草案',human:'下次先定位远处反光，再决定是否延伸观测线。',agent:'T02-DRAFT · 定位远处反光，待确认执行范围，尚未派发。'}
};

export function createRehearsal(){
 let state={beat:0,furthest:0,role:'human',entries:[],stashed:false,failed:false,message:''};
 const has=key=>state.entries.includes(key);
 function record(key){if(!has(key))state.entries.push(key);}
 function act(event){
  state.message='';
  if(event==='restart'){const role=state.role;state={beat:0,furthest:0,role,entries:[],stashed:false,failed:false,message:'已从开场重新排演。'};return snapshot();}
  if(event==='back'){state.beat=Math.max(0,state.beat-1);return snapshot();}
  if(event==='next'){
   const requirements={2:'baseline',3:'local',4:'receipt',5:'boundary'};
   if(requirements[state.beat]&&!has(requirements[state.beat])){state.message='先完成这一次行动，再向下推进。';return snapshot();}
   if(state.beat===1)record('task');
   state.beat=Math.min(6,state.beat+1);state.furthest=Math.max(state.furthest,state.beat);return snapshot();
  }
  if(event==='cache'&&state.beat===2){record('baseline');state.message='已留下基线：缺少本次资料，未认定故障原因。';}
  if(event==='read-failure'&&state.beat===3&&!has('local')){state.failed=true;state.message='本次端口未读出资料。保持待核对，可以重新连接；没有生成新证据。';}
  if(event==='read-local'&&state.beat===3&&has('baseline')){state.failed=false;record('local');state.message='已取得本次本地资料，来源 R1；等待回站核对。';}
  if(event==='stash'&&state.beat===4&&!has('receipt')){state.stashed=true;state.message='候选资料已暂存。站内记录仍是旧版本；可以继续复查或确认。';}
  if(event==='source'&&state.beat===4)state.message='两份都来自 R1：旧缓存采于雨前，新资料采于雨后、经本地端口读取。更远区域没有本次样本。';
  if(event==='commit'&&state.beat===4&&has('baseline')&&has('local')){record('receipt');state.message='本次资料已接收，原记录保留。更新范围到 R1，未宣布端到端链路修复。';}
  if(event==='observe'&&state.beat===5&&has('receipt')){record('boundary');state.message='把反光点留下，范围保持到 R1。这里可以停留，不强制等待。';}
  if(event==='next-task'&&state.beat===6){record('nextTask');state.message='下一份委托已留下草案；本次资料与回执保留。';}
  if(event==='return'&&state.beat===6){state.beat=4;state.message='回站整理：本次提交仍在，不重新领取或重复追加。';}
  return snapshot();
 }
 function snapshot(){return structuredClone({...state,records:state.entries.map(key=>({key,...evidence[key]}))});}
 return {act,snapshot,setRole(role){if(['human','agent'].includes(role))state.role=role;return snapshot();},revisit(beat){if(Number.isInteger(beat)&&beat>=0&&beat<=state.furthest)state.beat=beat;state.message='回看已走过的镜头，已有证据保留。';return snapshot();}};
}

if(typeof document!=='undefined'){
 const flow=createRehearsal(),$=id=>document.getElementById(id);
 let notebookId='field';
 function renderNotebook(s,focus=false){
  const pages=notebookPages(s.entries,s.role),index=Math.max(0,pages.findIndex(page=>page.id===notebookId)),page=pages[index];
  $('notebook-empty').hidden=!!page;$('notebook-body').hidden=!page;
  $('notebook-kind').textContent=s.role==='human'?'人的手记 / 内容翻阅排演':'设备档案 / 理念与来源对照';
  const nav=$('notebook-index');nav.replaceChildren();
  for(const item of pages){
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=item.chapter;
   if(item.id===page.id)button.setAttribute('aria-current','page');
   button.addEventListener('click',()=>{notebookId=item.id;renderNotebook(flow.snapshot(),true);});li.append(button);nav.append(li);
  }
  if(!page)return;
  notebookId=page.id;$('notebook-title').textContent=page.title;
  $('notebook-count').textContent=`第 ${index+1} / ${pages.length} 组 · 已写 ${page.notes.length} 条`;
  $('notebook-principle').textContent=page.principle||'一次任务的来路、发现和修订。';
  $('notebook-caveat').textContent=page.caveat||'';$('notebook-caveat').hidden=!page.caveat;
  $('notebook-route').hidden=!page.sketch;
  $('notebook-route').dataset.adopted=String(s.entries.includes('receipt'));
  $('notebook-route-known').textContent=s.entries.includes('receipt')?'站房 → R1：本次资料已采用':'站房 → R1：本次委托，尚待复核';
  $('notebook-route-unknown').textContent=s.entries.includes('boundary')?'远处反光：目视线索，未定位、未测量':'R1 之外：尚未纳入本次观测';
  const notes=$('notebook-notes');notes.replaceChildren();
  for(const note of page.notes){const li=document.createElement('li'),at=document.createElement('small'),p=document.createElement('p');at.textContent=note.at;p.textContent=note.text;li.append(at,p);notes.append(li);}
  $('notebook-prev').disabled=index===0;$('notebook-next').disabled=index===pages.length-1;
  $('notebook-prev').onclick=()=>{notebookId=pages[index-1].id;renderNotebook(flow.snapshot(),true);};
  $('notebook-next').onclick=()=>{notebookId=pages[index+1].id;renderNotebook(flow.snapshot(),true);};
  if(focus)$('notebook-title').focus({preventScroll:true});
 }
 function render(focus=false){
  const s=flow.snapshot(),b=beats[s.beat],human=s.role==='human',has=key=>s.entries.includes(key);
  $('beat-title').textContent=b.title;$('beat-number').textContent=`${String(s.beat).padStart(2,'0')} / ${human?'人的任务视角':'载体的执行视角'}`;
  $('beat-intent').textContent=b.intent;$('visible').textContent=b.visible;$('consequence').textContent=b.consequence;
  $('spoken').textContent=b[s.role];$('camera-cue').textContent=b.camera;$('frame-label').textContent=`分镜 ${String(s.beat).padStart(2,'0')}`;$('frame-type').textContent=b.kind;
  const environment=firstOutingEnvironment[s.beat];
  $('environment-time').textContent=`${environment.time} / ${environment.place}`;
  $('environment-weather').textContent=environment.weather;$('environment-effect').textContent=environment.effect;
  renderNotebook(s);
  const proposed=['relay','boundary'].includes(b.shot);$('painting').hidden=proposed;$('blocking').toggleAttribute('hidden',!proposed);
  $('frame').dataset.shot=b.shot;$('frame').dataset.role=s.role;$('frame').dataset.revealed=String(has('boundary'));
  $('blocking-title').textContent=b.shot==='relay'?'R1 本地端口所在场地的待制作空间示意':'R1 坡肩与远处未测量反光的待制作空间示意';
  $('record-kind').textContent=human?'人的手记 / 内容排演':'设备资料束 / 内容排演';
  $('feedback').textContent=s.message;$('back').disabled=s.beat===0;
  const list=$('beats');list.replaceChildren();
  for(const [i,beat]of beats.entries()){
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`0${i} · ${['入场','委托','基线','R1','交接','边界','下一页'][i]}`;button.disabled=i>s.furthest;
   if(i===s.beat)button.setAttribute('aria-current','step');button.addEventListener('click',()=>{flow.revisit(i);render(true);});li.append(button);list.append(li);
  }
  const records=$('records');records.replaceChildren();
  if(!s.records.length){const li=document.createElement('li');li.textContent='本次任务还没有留下记录。';records.append(li);}
  for(const record of s.records){const li=document.createElement('li'),source=document.createElement('small');li.append(document.createTextNode(record[s.role]));source.textContent=record.source;li.append(source);records.append(li);}
  const actions=$('actions');actions.replaceChildren();
  function button(label,event,primary=false){const el=document.createElement('button');el.type='button';el.textContent=label;el.dataset.action=event;if(primary)el.className='primary';el.addEventListener('click',()=>{flow.act(event);render(true);});actions.append(el);}
  if(s.beat===0)button('走进檐下','next',true);
  if(s.beat===1)button(human?'接下这段，记入手记':'读取边界，接收任务','next',true);
  if(s.beat===2)button(has('baseline')?'沿维护路出发':human?'查看站内旧回传':'读取缓存与来源',has('baseline')?'next':'cache',true);
  if(s.beat===3){button(has('local')?'带回工位核对':s.failed?'重新连接本地端口':human?'连接记录器，读取本地资料':'停靠端口，采集本次资料',has('local')?'next':'read-local',true);if(!has('local'))button('排演：读取失败','read-failure');}
  if(s.beat===4){if(has('receipt'))button('到最后一个有依据的点','next',true);else{button(human?'采用本次资料，范围到 R1':'以委托人身份授权追加','commit',true);button('先暂存，继续复查','stash');}button('复查来源与覆盖范围','source');}
  if(s.beat===5)button(has('boundary')?'留下这一页':human?'停下来，圈下远处反光':'记录未测量线索',has('boundary')?'next':'observe',true);
  if(s.beat===6){button('写下一份委托','next-task',true);button('回站整理','return');}
  document.title=`${b.title} · 雨后的第一份回传`;
  if(focus)$('beat-title').focus();
 }
 $('back').addEventListener('click',()=>{flow.act('back');render(true);});$('restart').addEventListener('click',()=>{flow.act('restart');render(true);});
 for(const radio of document.querySelectorAll('input[name=role]'))radio.addEventListener('change',()=>{flow.setRole(radio.value);render();});
 window.__storyRehearsal={flow,render};render();
}
