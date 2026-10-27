// Fixed-view observation, using landmarks actually present in the approved art.
// Findings survive closing the station; no walking is implied by a marker click.
export function createMeadowStation({stage,camera}){
 const $=id=>document.getElementById(id),enter=$('enter-field'),panel=$('field-controls'),button=$('field-action'),note=$('field-note');
 const abort=new AbortController(),{signal}=abort,found=new Set();
 let active=false,observed=false,clue=false,view='archive',disposed=false;
 const archive='“沿维护路出站，临水旧桩在路的右侧。上游风标立在下一处水弯旁。”';
 const entries={
  archive:{eyebrow:'观测站 · 旧记录',title:'记录，先当作线索。',body:'记录没有日期。画面中可以找到旧桩和上游风标；先用这两处参照，看看它还对应多少现场。',next:'点击画面中的两处标记，或使用下方按钮逐一查看。'},
  stake:{eyebrow:'现场 · 01 / 临水旧桩',title:'旧桩在路的另一侧。',body:'近处旧桩立在维护路左侧，与记录的“右侧”不符。这个偏差值得留下，但还不足以判断是记录过期，还是桩位被移动。',next:'再核对上游风标，看看是否只有这一处对不上。'},
  reference:{eyebrow:'现场 · 02 / 上游风标',title:'水弯旁，风标还在。',body:'沿水道向远处看，风标仍在下一处水弯旁，与记录描述一致。一处吻合不能替另一处偏差作证。',next:'回看临水旧桩，完成两处参照的对照。'},
  comparison:{eyebrow:'现场对照 · 两处参照',title:'只确认眼前这一段。',body:'风标与水弯的关系仍能对上，旧桩与维护路的关系却变了。保留吻合，也保留偏差；旧记录还不能直接当作下一段路线。',next:'留下待查线索：去上游补一次定位，并寻找旧桩是否迁移的记录。'},
  clue:{eyebrow:'场景手记 · 待查线索',title:'下一步，去上游核实。',body:'已记下：风标位置关系吻合，临水旧桩位置关系不符。原因尚未确认，下一段路线暂不延伸。先补定位和迁移记录，再决定地图如何修改。',next:'本段对照已保存至当前页面。可以回看现场，或翻开「验证」继续阅读。'}
 };
 const position=(id,x,y)=>{const element=$(id);element.style.left=x/1920*100+'%';element.style.top=y/1080*100+'%';};
 position('field-record',1520,825);position('field-pin',398,784);position('field-reference',498,714);
 function update(){
  const complete=found.size===2,entry=entries[view];
  stage.classList.toggle('exploring',active);stage.dataset.field=active?(clue?'clue':complete?'compared':observed?'observed':'station'):'poster';
  camera?.setView(!active?'poster':!observed?'station':view);
  panel.hidden=!active;note.hidden=!active||!observed;$('field-sites').hidden=!active;
  $('field-record').hidden=observed;$('field-pin').hidden=$('field-reference').hidden=!observed;
  for(const [id,key]of [['field-pin','stake'],['field-reference','reference']]){
   $(id).setAttribute('aria-pressed',String(found.has(key)));$(id).classList.toggle('is-checked',found.has(key));
  }
  $('note-eyebrow').textContent=entry.eyebrow;$('note-title').textContent=entry.title;$('note-body').textContent=entry.body;$('note-next').textContent=entry.next;
  $('note-source').textContent=archive;$('note-source').hidden=view!=='archive';
  $('field-findings').hidden=!found.size;
  $('finding-stake').textContent=found.has('stake')?'现场在路左侧 · 与记录不符':'尚未查看';
  $('finding-reference').textContent=found.has('reference')?'仍在上游水弯旁 · 关系吻合':'尚未核对';
  $('field-status').textContent=!observed?'檐下工位 · 查阅旧记录，再对照现场':clue?'手记已记下 · 原因待查':complete?'两处参照已对照 · 留下待查线索':'对照现场 · '+(found.size?'还有一处参照待核对':'记录中的两处参照就在眼前');
  $('field-progress').hidden=!observed;$('field-progress').textContent='现场对照 '+found.size+' / 2';
  button.textContent=!observed?'查阅旧记录':clue?'重新核对':complete?'留下待查线索':!found.has('stake')?'查看临水旧桩':'核对上游风标';
  $('field-reread').hidden=!found.size||view==='archive';
  const reading=$('field-reading');reading.href=clue?new URL('ch3/',new URL(stage.dataset.mediaBase+'../',location.href)).href:document.querySelector('.read-link').href;reading.textContent=clue?'阅读「验证」 ↗':'翻开手记 ↗';
 }
 function open(){if(disposed)return;active=true;stage.classList.remove('art-only');$('art-only').setAttribute('aria-pressed','false');$('art-only').textContent='只看画面';update();button.focus({preventScroll:true});}
 function close(){if(!active)return;active=false;update();enter.focus({preventScroll:true});}
 function read(){if(!active)return;const fromMarker=document.activeElement===$('field-record');observed=true;view='archive';update();if(fromMarker)button.focus({preventScroll:true});}
 function inspect(key){if(!active||!observed||!['stake','reference'].includes(key))return;found.add(key);view=found.size===2&&!clue?'comparison':key;update();}
 function action(){
  if(!active)return;
  if(!observed){read();return;}
  if(clue){found.clear();clue=false;view='archive';update();return;}
  if(found.size===2){clue=true;view='clue';update();return;}
  inspect(found.has('stake')?'reference':'stake');
 }
 enter.addEventListener('click',open,{signal});button.addEventListener('click',action,{signal});$('field-record').addEventListener('click',read,{signal});$('field-reread').addEventListener('click',read,{signal});
 $('field-pin').addEventListener('click',()=>inspect('stake'),{signal});$('field-reference').addEventListener('click',()=>inspect('reference'),{signal});$('field-exit').addEventListener('click',close,{signal});
 for(const [id,shot]of [['field-pin','stake'],['field-reference','reference'],['field-record','station']])$(id).addEventListener('focus',()=>camera?.setView(shot),{signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.querySelector('dialog[open]')){e.preventDefault();close();}},{signal});
 enter.hidden=false;update();
 return{open,close,action,pause(value){camera?.pause(value);},stats:()=>({mode:'station-review',active,observed,findings:[...found],clue,view,disposed,directionalAnimation:false,camera:camera?.stats()}),destroy(){disposed=true;abort.abort();camera?.destroy();}};
}
