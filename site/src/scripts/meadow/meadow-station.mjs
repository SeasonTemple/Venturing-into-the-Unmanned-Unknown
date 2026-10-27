// The approved painting contains one facing only. Until directional assets pass
// review, the production station never translates a front-facing character.
export function createMeadowStation({stage}){
 const $=id=>document.getElementById(id),enter=$('enter-field'),panel=$('field-controls'),button=$('field-action'),note=$('field-note'),pin=$('field-pin');
 const abort=new AbortController(),{signal}=abort;
 let active=false,observed=false,disposed=false;
 function update(){
  stage.classList.toggle('exploring',active);stage.dataset.field=active?(observed?'observed':'station'):'poster';
  panel.hidden=!active;note.hidden=!active||!observed;pin.hidden=!active||!observed;
  button.textContent=observed?'收起记录':'查阅临水记录';$('field-status').textContent=observed?'临水旧桩 · 记录中的位置与眼前不符':'檐下工位 · 查阅临水测点的旧记录';
  $('field-progress').hidden=true;
  pin.style.left=(370/1920*100)+'%';pin.style.top=(795/1080*100)+'%';
 }
 function open(){if(disposed)return;active=true;observed=false;stage.classList.remove('art-only');$('art-only').setAttribute('aria-pressed','false');$('art-only').textContent='只看画面';update();button.focus({preventScroll:true});}
 function close(){if(!active)return;active=false;update();enter.focus({preventScroll:true});}
 function action(){if(!active)return;observed=!observed;update();}
 enter.addEventListener('click',open,{signal});button.addEventListener('click',action,{signal});$('field-exit').addEventListener('click',close,{signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.querySelector('dialog[open]')){e.preventDefault();close();}},{signal});
 enter.hidden=false;update();
 return{open,close,action,pause(){},stats:()=>({mode:'station-review',active,observed,disposed,directionalAnimation:false}),destroy(){disposed=true;abort.abort();}};
}
