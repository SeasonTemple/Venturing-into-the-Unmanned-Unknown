const storageKey='unmapped-field-notebook-v1';
const catalog={
 archive:{title:'檐下，读到一份没有日期的记录。',body:'记录说：临水旧桩在维护路右侧，上游风标在下一处水弯旁。先把它当作线索。',source:'檐下旧记录',relation:'参照待核对'},
 stake:{title:'近处旧桩，与记录对不上。',body:'现场旧桩在维护路左侧。留下位置关系的偏差，尚不能判断是记录过期还是桩位迁移。',source:'临水旧桩 / 现场观察',relation:'位置关系不符'},
 reference:{title:'水弯旁，风标的位置关系还吻合。',body:'上游风标仍立在下一处水弯旁。这处吻合保留，但不能替旧桩的偏差作证。',source:'上游风标 / 现场观察',relation:'位置关系吻合'},
 clue:{title:'把吻合与偏差一起留下。',body:'下一步补定位，并寻找旧桩是否迁移的记录。只确认眼前这一段，原因仍待查。由此关联到「验证」。',source:'两处参照 / 人工对照',relation:'线索已整理，原因待查'}
};

// Only copy reading content, never scripts, controls or navigation from the page.
function readingFragment(source){
 const allowed=new Set(['H2','H3','H4','H5','P','UL','OL','LI','BLOCKQUOTE','STRONG','EM','CODE','PRE','TABLE','THEAD','TBODY','TR','TH','TD','DL','DT','DD','HR','BR']);
 const omit=new Set(['SCRIPT','STYLE','BUTTON','SVG','IFRAME','OBJECT','EMBED','LINK','TEMPLATE','NOSCRIPT']);
 function copy(node){
  if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);
  if(node.nodeType===Node.ELEMENT_NODE&&(node.classList.contains('sr-only')||node.hasAttribute('data-pagefind-ignore')||node.getAttribute('aria-hidden')==='true'))return document.createDocumentFragment();
  const result=allowed.has(node.nodeName)?document.createElement(node.nodeName.toLowerCase()):document.createDocumentFragment();
  if(omit.has(node.nodeName))return document.createDocumentFragment();
  if(['TD','TH'].includes(node.nodeName))for(const name of ['colspan','rowspan'])if(node.hasAttribute(name))result.setAttribute(name,node.getAttribute(name));
  for(const child of node.childNodes)result.append(copy(child));
  return result;
 }
 return copy(source);
}

export function createMeadowNotebook({stage,initialState}){
 const $=id=>document.getElementById(id),dialog=$('field-notebook'),abort=new AbortController(),{signal}=abort;
 let entries=[],run=1,carrier='human',page='records',disposed=false,chapterRequest,chapterLoaded=false,stored=true;
 try{const data=JSON.parse(localStorage.getItem(storageKey)||'null');if(data?.version===1&&Array.isArray(data.entries))entries=data.entries.filter(e=>e&&Number.isInteger(e.seq)&&e.seq>0&&Number.isInteger(e.run)&&e.run>0&&typeof e.body==='string'&&typeof e.title==='string'&&typeof e.source==='string'&&typeof e.relation==='string'&&typeof e.date==='string'&&(Object.hasOwn(catalog,e.type)||e.type==='addition'));}catch{stored=false;}
 if(initialState){entries=initialState.entries;run=initialState.run;}else run=Math.max(0,...entries.map(e=>e.run))+1;
 const unlocked=()=>entries.some(e=>e.type==='clue');
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:1,entries}));stored=true;}catch{stored=false;}};
 function render(){
  const machine=carrier==='agent';dialog.dataset.carrier=carrier;
  $('notebook-title').textContent=machine?'设备资料档案':'随身手记';
  $('notebook-human').setAttribute('aria-pressed',String(!machine));$('notebook-agent').setAttribute('aria-pressed',String(machine));
  $('notebook-location').textContent=machine?'FIELD STATION / 01 · 来源与证据':'01 / 沿维护路';
  $('notebook-leaf-title').textContent=machine?'逐条追加，保留原始记录':'沿维护路留下的记录';
  $('notebook-empty').hidden=entries.length>0;
  $('notebook-empty').textContent=machine?'尚无现场资料。观察与补充将逐条追加，来源和待核对状态会一同保留。':'手记还是空的。合上它，先到檐下查阅旧记录。';
  const list=$('notebook-entries');list.replaceChildren();
  for(const entry of entries){
   const item=document.createElement('li'),meta=document.createElement('p'),title=document.createElement('h4'),body=document.createElement('p');
   meta.className='notebook-entry-meta';meta.textContent=machine?`OBS-${String(entry.seq).padStart(4,'0')} · ${entry.source}`:`第 ${entry.run} 次出站 · ${new Date(entry.date).toLocaleDateString('zh-CN')}`;
   title.textContent=machine?entry.relation:entry.title;body.textContent=entry.body;
   item.append(meta,title,body);
   if(machine){const status=document.createElement('p');status.className='notebook-entry-meta';status.textContent='观察记录 · '+entry.relation+' · 未推断原因';item.append(status);}
   list.append(item);
  }
  const discovered=unlocked();$('notebook-chapter').disabled=!discovered;$('notebook-chapter').textContent=discovered?'验证 · 展开章节 →':'验证 · 尚未关联';
  $('notebook-discovery').textContent=discovered?'两处现场参照形成了对照。发现「验证」：已覆盖的关系和未解释的偏差，应该分别留下。':'先读旧记录、核对两处参照，再主动留下线索，关联「验证」章节。';
  $('notebook-addition-label').textContent=machine?'追加资料说明（保留原记录）':'补写一条手记';$('notebook-submit').textContent=machine?'追加档案':'记入手记';
  $('notebook-record-count').textContent=`${entries.length} 条${machine?'档案':'记录'} · ${discovered?'已发现「验证」':'方法页签待发现'}`;
  $('notebook-save-status').textContent=stored?'已在此浏览器保存。':'浏览器存储不可用，本次页面内仍保留记录。';
  dialog.querySelector('.notebook-spread').hidden=page==='chapter';$('notebook-chapter-page').hidden=page!=='chapter';
 }
 function append(type,addition){
  if(disposed)return;
  if(type!=='addition'&&entries.some(e=>e.run===run&&e.type===type))return;
  const data=type==='addition'?{title:carrier==='agent'?'补充资料，待核对。':'补记一条待查事项。',body:addition,source:carrier==='agent'?'设备档案 / 手动追加':'随身手记 / 人工补记',relation:'补充资料待核对'}:catalog[type];
  if(!data)return;
  entries.push({...data,type,run,seq:Math.max(0,...entries.map(e=>e.seq))+1,date:new Date().toISOString()});save();render();
 }
 function open(next='human'){
  if(disposed)return;carrier=next;page='records';render();
  if(!dialog.open){stage.setAttribute('data-notebook-open','');dialog.showModal();}
 }
 const close=()=>{if(dialog.open)dialog.close();};
 dialog.addEventListener('close',()=>{stage.removeAttribute('data-notebook-open');chapterRequest?.abort();chapterRequest=undefined;dialog.returnValue='';},{signal});
 $('field-reading').addEventListener('click',()=>open(),{signal});$('field-archive').addEventListener('click',()=>open('agent'),{signal});
 for(const [id,value]of [['notebook-human','human'],['notebook-agent','agent']])$(id).addEventListener('click',()=>{carrier=value;page='records';render();},{signal});
 $('notebook-append').addEventListener('submit',event=>{event.preventDefault();const value=$('notebook-addition').value.trim();if(!value)return;append('addition',value);$('notebook-addition').value='';$('notebook-save-status').textContent=stored?'已追加记录，原记录保留。':'已追加至本次页面，浏览器存储暂不可用。';},{signal});
 $('notebook-return').addEventListener('click',()=>{page='records';render();$('notebook-chapter').focus();},{signal});
 $('notebook-chapter').addEventListener('click',async()=>{
  if(!unlocked()||disposed)return;page='chapter';render();dialog.scrollTop=0;$('notebook-return').focus({preventScroll:true});
  const body=$('notebook-chapter-body');
  if(chapterLoaded)return;
  chapterRequest?.abort();const request=new AbortController();chapterRequest=request;body.textContent='正在取出章节……';
  try{
   const response=await fetch(dialog.dataset.chapterUrl,{signal:request.signal});if(!response.ok)throw Error('Chapter unavailable');
   const parsed=new DOMParser().parseFromString(await response.text(),'text/html'),content=parsed.querySelector('.sl-markdown-content');
   if(!content)throw Error('Chapter content missing');
   if(disposed||request.signal.aborted)return;
   body.replaceChildren(readingFragment(content));chapterLoaded=true;
  }catch(error){if(!request.signal.aborted&&!disposed)body.textContent='暂时未能取出章节。回到记录页后可以重试，现场与已有记录仍在。';}
 },{signal});
 render();
 return{record:append,newRun(){run++;},close,stats:()=>({entries:[...entries],run,carrier,page,open:dialog.open,chapterLoaded,unlocked:unlocked()}),destroy(){if(disposed)return;close();stage.removeAttribute('data-notebook-open');disposed=true;chapterRequest?.abort();abort.abort();}};
}
