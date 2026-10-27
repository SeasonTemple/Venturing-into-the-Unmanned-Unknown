import{createRift,shots}from'./rift-scene.mjs';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search),errors=[];
let world,selected=0,playing=false,stamp=0;
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function update(state){document.body.dataset.moving=String(state.moving&&!state.paused);$('mode-controls').disabled=state.moving;$('walk-next').disabled=state.moving;$('playback-progress').style.transform=`scaleX(${state.progress})`;$('playback-status').textContent=state.moving?(state.paused?'停步 / 可继续':`沿路行进 ${Math.round(state.progress*100)}%`):state.selected===4?'已到通路边缘':'静止观察';$('hold').disabled=!state.moving;$('hold').textContent=state.paused?'继续行进':'停步观察';}
function controls(index){const shot=shots[index];$('hero-copy').hidden=index!==0;$('enter').hidden=index!==0;$('shot-copy').hidden=index===0;$('frame-actions').hidden=index===0;$('mode-controls').hidden=index!==3;
 $('shot-kicker').textContent=`${String(index+1).padStart(2,'0')} / ${shot.label}`;$('shot-title').textContent=shot.title;$('shot-description').textContent=shot.copy;
 $('frame-number').textContent=`${String(index+1).padStart(2,'0')} / ${['THRESHOLD','SHELTER','PASSAGE','WORKSITE','THE EDGE','LOOKING BACK'][index]}`;
 $('read-chapter').href=`/Venturing-into-the-Unmanned-Unknown/${shot.chapter}/`;
 $('walk-next').textContent=index===4?'回望来路 ↶':index===5?'回到门外 ↶':index===3?'走向观测边缘 →':'沿壁继续 →';
 document.querySelectorAll('#shots button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
}
async function select(index,animate=true){selected=index;controls(index);return world?.select(index,animate);}
function stopSequence(pause=false){playing=false;stamp++;$('sequence').textContent='顺序试看';const state=world?.stats();if(pause&&state.moving&&!state.paused)world.togglePause();}
for(const[ i,shot]of shots.entries()){const b=document.createElement('button'),number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');b.append(number,document.createTextNode(shot.label));b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{stopSequence();select(i);});$('shots').append(b);}
$('enter').addEventListener('click',()=>select(1));$('walk-next').addEventListener('click',()=>{stopSequence();select((selected+1)%shots.length);});$('hold').addEventListener('click',()=>world?.togglePause());
$('sequence').addEventListener('click',async()=>{
 if(playing){stopSequence(true);return;}playing=true;const token=++stamp;$('sequence').textContent='停止试看';
 for(let i=0;i<shots.length&&token===stamp;i++){if(!await select(i))break;await new Promise(resolve=>setTimeout(resolve,i===4?2500:900));}
 if(token===stamp)stopSequence();
});
document.querySelectorAll('[name=rift-mode]').forEach(radio=>radio.addEventListener('change',()=>{if(!radio.checked)return;world?.setMode(radio.value);$('mode-description').textContent=radio.value==='agent'?'人给定意图与约束，任务单元分布在不同工作面；系统门禁与人的必要裁决共同约束产出。':'人沿工作面组织与直接实施，工具和自动化辅助检查。这里尚未接入实际工程任务。';}));
try{world=createRift($('rift-canvas'),{still:query.has('still'),onUpdate:update});$('rift-status').textContent='';await select(Math.max(0,Math.min(5,Number(query.get('shot'))||0)),false);}catch(error){errors.push(String(error));$('rift-status').textContent='当前设备未能显示三维场景。可继续阅读下方设计说明，或直接打开章节。';$('enter').disabled=$('sequence').disabled=true;}
addEventListener('pagehide',event=>{stopSequence();if(!event.persisted)world?.destroy();});
window.__riftStudy={ready:!!world,select,mode:value=>{const input=document.querySelector(`[name=rift-mode][value=${value}]`);input.checked=true;input.dispatchEvent(new Event('change'));},pause:()=>world?.togglePause(),state:()=>({selected,playing,errors:[...errors],world:world?.stats()}),dispose:()=>{stopSequence();world?.destroy();}};
