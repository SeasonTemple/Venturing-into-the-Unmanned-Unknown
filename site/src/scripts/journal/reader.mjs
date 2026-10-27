import { createReaderAtmosphere } from './reader-atmosphere.mjs';
import { createLayerPlate } from './layer-plate.mjs';

const host=document.getElementById('production-journal');
if(host) init();
function init(){
  const $=id=>document.getElementById(id),chapter=JSON.parse(host.dataset.chapter),article=$('body');
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state={ready:false,errors:[],sections:0,artwork:{status:'ready',mode:'shared-poster',frames:0,disposed:false},disposed:false};
  window.__readingStudy=state;
  const abort=new AbortController(),{signal}=abort;
  let atmosphere,frame=0,sections=[],current=-1;
  // Move the existing nodes; Expressive Code and the canonical heading IDs survive.
  const originals=Array.from(article.childNodes);let content,section;
  for(const node of originals){
    const h=node.nodeType===1&&(node.matches('h2')?node:node.querySelector('h2'));
    if(h||!section){
      if(!h&&node.nodeType===3&&!node.textContent.trim())continue;
      section=document.createElement('section');section.className='article-section';
      const marker=document.createElement('span');marker.className='section-marker';marker.setAttribute('aria-hidden','true');marker.textContent=`原文 / ${chapter.order.padStart(2,'0')}.${String(sections.length+1).padStart(2,'0')}`;
      content=document.createElement('div');content.className='section-content';content.append(marker);section.append(content);article.append(section);sections.push(section);
    }
    content.append(node);
  }
  sections=sections.filter(s=>s.querySelector('h2'));
  state.sections=sections.length;
  for(const table of article.querySelectorAll('table')){const wrap=document.createElement('div');wrap.className='table-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','可横向滚动的章节表格');table.before(wrap);wrap.append(table);}
  // Editorial aids attach by subject, since upstream chapters may gain sections.
  const aids=[
    [/分层验证模型/,'观察 / 阅读辅助','一道光，照不见全部层次。','每种证据回答不同的问题。一层通过，不能代替其余层的检查。'],
    [/规格歧义/,'边界 / 阅读辅助','通过检查的，也可能是错误的解释。','把尚未表达的条件带回规格。检查结果的适用范围，取决于已写下的问题。'],
    [/模型检查/,'尺度 / 阅读辅助','模型是一张有取舍的地图。','留意状态空间省略了什么，以及这些省略会影响哪些性质。'],
    [/简洁实例/,'实例 / 阅读辅助','沿着一把锁，追到证据的来处。','把性质、模型、实现与回归联系起来；这张阅读页没有实际运行任何验证。'],
  ];
  if(chapter.slug==='ch3')for(const s of sections){
    const title=s.querySelector('h2').textContent;
    const aid=aids.find(([pattern])=>pattern.test(title));if(!aid)continue;
    const note=document.createElement('aside');note.className='section-note field-note';note.setAttribute('aria-label','阅读辅助批注');
    const label=document.createElement('span');label.className='note-label';label.textContent=aid[1];const strong=document.createElement('strong');strong.textContent=aid[2];const p=document.createElement('p');p.textContent=aid[3];note.append(label,strong,p);s.append(note);
    if(/分层验证模型/.test(title)){const heading=s.querySelector('h2');(heading.parentElement===s.querySelector('.section-content')?heading:heading.parentElement).after(createLayerPlate());}
  }
  function marginNote(index){
    const destination=$('margin-note');destination.replaceChildren();
    const section=sections[index];if(!section)return;
    const note=section.querySelector('.section-note');
    if(note){destination.append(...Array.from(note.childNodes,n=>n.cloneNode(true)));return;}
    const subheads=[...section.querySelectorAll('h3')];if(!subheads.length)return;
    const label=document.createElement('span');label.className='note-label';label.textContent='本节线索';destination.append(label);
    for(const h of subheads){const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent;destination.append(a);}
  }
  $('margin-note').addEventListener('click',goHeading,{signal});
  let trigger;
  function tab(name,focus=false){for(const key of ['book','outline']){const active=name===key;$(`${key}-tab`).setAttribute('aria-selected',String(active));$(`${key}-tab`).tabIndex=active?0:-1;$(`${key}-panel`).hidden=!active;}if(focus)$(`${name}-tab`).focus();}
  function openNavigation(name='book'){trigger=document.activeElement;tab(name);$('navigation').showModal();}
  $('navigation').addEventListener('close',()=>trigger?.focus({preventScroll:true}),{signal});
  $('close-navigation').addEventListener('click',()=>$('navigation').close(),{signal});
  $('navigation').addEventListener('click',event=>{if(event.target!==$('navigation'))return;const r=$('navigation').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('navigation').close();},{signal});
  for(const key of ['book','outline']){
    $(`${key}-tab`).addEventListener('click',()=>tab(key),{signal});
    $(`${key}-tab`).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();tab(event.key==='Home'?'book':event.key==='End'?'outline':key==='book'?'outline':'book',true);}},{signal});
  }
  $('open-navigation').addEventListener('click',()=>openNavigation(),{signal});
  $('route-book').addEventListener('click',event=>{event.preventDefault();openNavigation();},{signal});
  $('journal-book').hidden=true;
  for(const id of ['open-navigation','focus'])$(id).hidden=false;
  host.querySelector('[data-mt-copy]').hidden=false;
  function goHeading(event){const anchor=event.target.closest('a[href^="#"]');if(!anchor)return;const hash=anchor.getAttribute('href'),target=document.getElementById(decodeURIComponent(hash.slice(1)));if(!target)return;event.preventDefault();if($('navigation').open)$('navigation').close();target.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});target.tabIndex=-1;target.focus({preventScroll:true});history.replaceState(null,'',hash);}
  $('outline-panel').addEventListener('click',goHeading,{signal});$('route-links').addEventListener('click',goHeading,{signal});
  $('focus').addEventListener('click',()=>{const anchor=sections[current]||article;const onBody=scrollY>=$('opening').offsetHeight;const focused=document.body.classList.toggle('focused');$('focus').setAttribute('aria-pressed',String(focused));$('focus').textContent=focused?'完整阅读':'专注阅读';if(onBody||focused)anchor.scrollIntoView({behavior:'instant',block:'start'});schedule();},{signal});
  $('production-journal').querySelector('[data-mt-copy]').addEventListener('click',async event=>{
    const button=event.currentTarget,label=button.querySelector('.mt-action-label');
    try{const text=JSON.parse($('mt-raw-md').textContent);if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else{const input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;top:-1000px';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error('copy failed');}label.textContent='已复制';$('status').textContent='Markdown 已复制';}
    catch{label.textContent='复制失败';$('status').textContent='未能复制，请选择正文或使用浏览器复制功能。';}
  },{signal});
  function update(){frame=0;const h=document.documentElement.scrollHeight-innerHeight;$('progress').style.transform=`scaleX(${h?Math.min(1,Math.max(0,scrollY/h)):0})`;const index=Math.max(0,sections.findLastIndex(s=>s.getBoundingClientRect().top<document.querySelector('.chapter-travel').getBoundingClientRect().bottom+65));if(index!==current){current=index;marginNote(index);atmosphere?.update(index);for(const[s,i]of sections.map((s,i)=>[s,i]))s.dataset.current=String(i===index);const heading=sections[index]?.querySelector('h2');$('route-links').querySelectorAll('a').forEach(a=>{if(decodeURIComponent(a.hash.slice(1))===heading?.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}}
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  addEventListener('scroll',schedule,{passive:true,signal});addEventListener('resize',schedule,{signal});
  try{atmosphere=createReaderAtmosphere(sections);}catch(error){state.errors.push(String(error));}
  function routeSize(){document.querySelector('.field-route').classList.toggle('route-flow',document.querySelector('.field-route').scrollHeight>innerHeight-140);}
  addEventListener('resize',routeSize,{signal});routeSize();update();
  // Shared baked relief and CSS underlay: reading does not allocate WebGL contexts.
  $('chapter-art').addEventListener('click',goHeading,{signal});
  function dispose(event){if(event.persisted)return;state.disposed=true;state.artwork.disposed=true;cancelAnimationFrame(frame);abort.abort();atmosphere?.dispose();}
  addEventListener('pagehide',dispose,{signal});state.ready=true;
  // Existing deep links retain their heading IDs and land after enhancement.
  if(location.hash){try{document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({behavior:'instant'});}catch{}}
}
