import {notebookPages} from './story-notebook.mjs';
const $=id=>document.getElementById(id),asset=name=>'art-pack-media/'+name;
const environments={
 day:{src:'meadow-media/hero-v04.webp',caption:'原画基准。明确的来路、站房与溪流，作为其他三张稿的共同坐标。',action:'在檐下确认目标，沿维护路去 R1。雨前缓存与当前天气分别记录。',alt:'观测站雨后午后的认可原画。'},
 overcast:{src:asset('station-overcast.webp'),caption:'低云／细雨光色稿：天空、屋顶与地表分别调色，檐下保留遮蔽。仍沿用原云形，低云结构待重绘。',action:'端口在雨罩下读取；先留采集方式，天气不能直接用来解释缺失回传。',alt:'同一观测站在低云和细雨条件下的局部分区调色研究。'},
 evening:{src:asset('station-evening.webp'),caption:'傍晚光色稿：屋顶和远景冷暖转移，实体灯源进入照明状态。尚未重画低角度投影。',action:'回站整理与试运行，通过明确转场进入这一时段。',alt:'同一观测站的傍晚光色研究，站房和道路位置保持一致。'},
 night:{src:asset('station-night.webp'),caption:'夜间局部照明稿：檐灯照墙面与近地，新增工位灯照桌面，湿地留下对应反射。光斑边缘仍待精修。',action:'人整理收簿，载体留在已确认线路；异常只保留资料，等待新的裁决。',alt:'夜间观测站，檐灯照亮墙面与近地，独立工位灯照亮桌面。'}
};
const scenes={
 workbench:{file:'station-workbench.webp',caption:'工位取景裁切。用于器物与像素尺度对照，不当作新的完整机位。'},
 relay:{file:'relay-continuity-study.webp',caption:'R1 空间试排：同一原画坐标、新绘像素柜体、原画载体。端口与线缆接触仍需修订，不作为场景定稿。'},
 open:{file:'boundary-palette-study.webp',caption:'远景展开：上一轮像素候选的草地色温已回调。人物比例、载体与地形细节尚未全部统一。'}
};
const requests=new Map();
async function swapImage(id,src,alt,after){
 const token=Symbol(id);requests.set(id,token);const img=new Image();img.src=src;
 try{await img.decode();if(requests.get(id)!==token)return;const target=$(id);target.width=img.naturalWidth;target.height=img.naturalHeight;target.src=src;target.alt=alt;after?.();$('media-status').textContent='';}
 catch{if(requests.get(id)===token)$('media-status').textContent='这张稿暂未载入，可重选；当前画面保留。';}
}
for(const radio of document.querySelectorAll('[name=environment]'))radio.addEventListener('change',()=>{const e=environments[radio.value];void swapImage('environment-art',e.src,e.alt,()=>{$('environment-caption').textContent=e.caption;$('environment-action').textContent='行动：'+e.action;});});
for(const radio of document.querySelectorAll('[name=scene]'))radio.addEventListener('change',()=>{const s=scenes[radio.value];void swapImage('route-art',asset(s.file),s.caption,()=>{$('route-caption').textContent=s.caption;});});
const names={front:'原画站姿',side:'朝左侧面','back-side':'朝左背侧',back:'背面'};
const frameLabels={front:'原画人物输入',side:'精确帧 96 / 4.00 秒','back-side':'精确帧 48 / 2.00 秒',back:'精确帧 84 / 3.50 秒'};
for(const radio of document.querySelectorAll('[name=actor]'))radio.addEventListener('change',()=>{const name=names[radio.value];void swapImage('actor-art',asset('actor-'+radio.value+'.png'),'工程人员的'+name+'造型参照',()=>{$('actor-caption').textContent=name+' · '+frameLabels[radio.value]+'。仅作造型参照，未作为步态。';});});

const snapshots={task:['task'],returned:['task','baseline','local','receipt'],boundary:['task','baseline','local','receipt','boundary','nextTask']};
let snapshot='task',groupId='field',leaf=0;
export function paginateNotes(notes,limit=60){
 const pages=[];let page=[],length=0;
 for(const note of notes){const n=note.text.length+note.at.length;if(page.length&&length+n>limit){pages.push(page);page=[];length=0;}page.push(note);length+=n;}
 if(page.length)pages.push(page);return pages;
}
function renderBook(focus=false){
 const groups=notebookPages(snapshots[snapshot]),group=groups.find(g=>g.id===groupId)||groups[0];groupId=group.id;
 const pages=paginateNotes(group.notes);leaf=Math.min(leaf,pages.length-1);
 const index=$('book-index');index.replaceChildren();
 for(const item of groups){const button=document.createElement('button');button.type='button';button.textContent=item.chapter;if(item.id===groupId)button.setAttribute('aria-current','page');button.addEventListener('click',()=>{groupId=item.id;leaf=0;renderBook(true);});index.append(button);}
 $('book-chapter').textContent=group.chapter;$('book-title').textContent=group.title;
 $('book-principle').textContent=group.principle||'走过、读到、采用的资料分别留下；新的发现向后续写。';
 $('book-map').hidden=group.id!=='field';$('map-caption').textContent=snapshot==='task'?'虚线：尚待查的路。委托只到 R1。':'采用范围到 R1。远处反光仍未测量。';
 $('book-page').textContent=['委托初记','资料带回','坡肩续写'][['task','returned','boundary'].indexOf(snapshot)];
 const list=$('book-notes');list.replaceChildren();
 for(const note of pages[leaf]){const li=document.createElement('li'),at=document.createElement('small'),p=document.createElement('p');at.textContent=note.at;p.textContent=note.text;li.append(at,p);list.append(li);}
 $('book-source').textContent=group.id==='verification'?'情境短记 · 现场核对不等于形式化证明。':'情境短记 · 对应原章关键理念。';
 $('book-prev').disabled=leaf===0;$('book-next').disabled=leaf===pages.length-1;
 $('book-position').textContent=`${group.chapter} · ${leaf+1} / ${pages.length}`;
 if(focus)$('book-title').focus({preventScroll:true});
}
$('book-prev').addEventListener('click',()=>{leaf=Math.max(0,leaf-1);renderBook(true);});
$('book-next').addEventListener('click',()=>{leaf++;renderBook(true);});
for(const radio of document.querySelectorAll('[name=snapshot]'))radio.addEventListener('change',()=>{snapshot=radio.value;leaf=0;renderBook();});
window.__artPack={stats:()=>({snapshot,groupId,leaf,animationLoops:0}),renderBook};renderBook();
