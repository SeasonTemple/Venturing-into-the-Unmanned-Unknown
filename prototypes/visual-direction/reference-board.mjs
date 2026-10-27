const media='./reference-media/';
const refs=[
 {name:'Jusant',studio:'DON’T NOD',source:'https://dont-nod.com/en/games/jusant/',rights:'© DON’T NOD',lenses:{
  world:{image:'jusant-7',alt:'Jusant 中人物悬在狭窄红色岩缝中，岩壁上有化石、梯架与旧物，缝隙透出日光。',caption:'官方 Gameplay 7 · 岩缝、化石、旧梯架与人物。',title:'让环境带着被使用过的历史。',see:'暖色岩层是大形，化石与旧梯架是中层，悬挂人物是尺度参照；窄亮缝给出明确的视线方向。',learn:'先区分地貌、构筑物和人物的尺度，再让少量有来历的旧物说明这里发生过什么。',apply:'观测站保留更换过的面板、收拢的线缆与检修通路；这些痕迹需对应具体工作。'},
  person:{image:'jusant-10',alt:'Jusant 主角站在日光下，身穿分层外衣和靴子，身后是有器物、绳索与植物的居住遗迹。',caption:'官方 Gameplay 10 · 连续服装轮廓、鞋、随身装备与落地阴影。',title:'服装与姿态把简化的人物连成整体。',see:'外衣、围巾、护腿与鞋形成可辨识的连续轮廓，脚底阴影给出站姿和重量；背景器物仍有形状差异。',learn:'风格化角色需要服装分层与稳定比例。关节可简化，身体重心和接触关系仍须可信。',apply:'先画野外工程人员的正侧轮廓与行进、检查、观察姿态，再决定建模方式。'},
  function:{image:'jusant-1',alt:'Jusant 中人物沿一组依附岩壁的支架和大型管件攀爬，近景结构与岩石有不同轮廓和色彩。',caption:'官方 Gameplay 1 · 岩壁、支架与管状构筑物的关系。',title:'构筑物与环境有相互依附的关系。',see:'支架的重复节奏区别于岩层的大形，管件和支架共同提供可读的结构与人物尺度。',learn:'装置需要支承、连接和可使用的位置。空间叙事可以从这些关系展开。',apply:'站房、仪器、接头与线缆先有功能布置；装饰细节在用途明确后添加。'}
 }},
 {name:'INSIDE',studio:'Playdead',source:'https://playdead.com/games/inside/',rights:'© Playdead',lenses:{
  world:{image:'inside-6',alt:'INSIDE 中小型红衣人物奔过工业屋顶，大型黑色支架位于前景，远处屋顶被光与空气透视分层。',caption:'官方截图 06 · 前景支架、中景人物与远处屋顶。',title:'遮挡把大空间拆成有顺序的发现。',see:'深色支架占据前景，人物在中景亮面行动，远处屋顶和开口提供下一层空间；形体的大小与明暗同时分层。',learn:'世界不必一次展示全貌。前景遮挡应在行进时产生变化，让后方空间逐步被看见。',apply:'从站房门廊进入检查现场，再转向外面的观测目标；各个取景保留能认出的空间线索。'},
  person:{image:'inside-1',alt:'INSIDE 的小型红衣人物站在一束光照亮的工业地面上，人物及落地阴影与暗背景分离。',caption:'官方截图 01 · 人物剪影、少量色彩与落地阴影。',title:'人物很小，动作仍能被读懂。',see:'红衣区分身体，手脚和躯干之间有清楚的空隙，投影把人物固定在地面；大量面部细节并非识别的前提。',learn:'先校准比例、重心、步态和剪影。少量对比足以建立焦点，环境仍可保留安静的大形。',apply:'避免零散胶囊组成的木偶感。人弯腰检查接口时，头、手、工具和接头应形成明确关系。'},
  function:{image:'inside-6',alt:'INSIDE 中屋顶支架有可辨认的斜撑、底部机构和通路，人物位于结构之间。',caption:'官方截图 06 · 斜撑、机构、通路与身体尺度。',title:'工业形体靠结构关系成立。',see:'斜撑、横梁和底部机构形成连贯的受力轮廓；通行面和人物尺寸可相互比较。',learn:'设备轮廓需要主结构与必要部件；加上支承和操作尺度，简单几何才有可信的来处。',apply:'优先设计一台能看出如何安装和操作的仪器，避免在空平台上重复摆放抽象节点。'}
 }},
 {name:'Death Stranding',studio:'KOJIMA PRODUCTIONS',source:'https://www.playstation.com/en-us/games/death-stranding/',rights:'原权利人：Sony Interactive Entertainment / KOJIMA PRODUCTIONS 等',lenses:{
  world:{image:'ds-world',alt:'Death Stranding 的小型负重人物站在岩石和草地间，溪流延伸到中景，远处山形逐渐被亮雾削弱。',caption:'官方环境背景 · 岩石、溪流、人物与远方轮廓。',title:'距离来自沿途仍可辨认的东西。',see:'近处石块和人物给出尺度，溪流连接中景，远处山形随距离减弱。雾中仍有地形关系。',learn:'未知可以保留可见线索。空气透视负责距离，不必消除所有前方信息。',apply:'观测路线在中景有真实障碍与遮挡，远端仪器只部分可见；走近后能获得新的观察。'},
  person:{image:'ds-equipment',alt:'Death Stranding 中负重人物贴近一台带基座、转轴和支承杆的货物设备操作，背景有野外地貌。',caption:'官方 Director’s Cut 设备截图 · 装备、身体和操作位置。',title:'装备与操作共同说明人的身份。',see:'背负载荷、服装分区与身体姿态相互配合；人靠近设备的具体位置，使尺度和使用关系清楚。',learn:'人物的身份可以从装备与工作被读出。装备数量应由用途决定，避免成为无功能的装饰。',apply:'只保留和观测、检查有关的随身工具；近景要能认出人是观察、连接还是等待结果。'},
  function:{image:'ds-bridge',alt:'Death Stranding 中负重人物沿一座蓝色临时连接设施跨越岩石地形，连接物的两端与中间跨度清楚可见。',caption:'官方 Chiral Bridge 截图 · 连接物跨越一个具体地形障碍。',title:'一次行动，让空间关系发生改变。',see:'蓝色连接物的跨度与岩体障碍对应，人物正在使用它。连接的作用可以从画面理解。',learn:'空间中的产物应改变可达性或可用性。画面中的连接不只是装饰线。',apply:'候选线路、检查证据与接入后的运行状态分别表达；恢复回传让某个仪器真正可用。'}
 }}
];
const notes={world:'比较近景、中景与远景怎样联系。这里关注空间线索和环境痕迹，不指定本站必须采用哪种地貌。',person:'比较轮廓、重心、装备和接触关系。简化人物的面部与材质，仍需保留能读懂的身体。',function:'比较装置如何依附环境、被人使用，以及行动怎样改变空间。画面观察不等于已验证原作机制。'};
const container=document.getElementById('references'),dialog=document.getElementById('image-dialog');
function node(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;}
function render(lens){
 document.getElementById('lens-note').textContent=notes[lens];container.replaceChildren();
 for(const ref of refs){const data=ref.lenses[lens],article=node('article',null,'ref'),head=node('div',null,'ref-heading');head.append(node('h3',ref.name),node('span',ref.studio));article.append(head);
  const figure=node('figure'),button=node('button',null,'image-button'),img=node('img');img.src=media+data.image+'.webp';img.alt=data.alt;img.width=1200;img.height=675;img.decoding='async';button.type='button';button.setAttribute('aria-label','放大 '+ref.name+' 参考画面');button.append(img,node('span','放大 ↗'));button.addEventListener('click',()=>open(ref,data));figure.append(button,node('figcaption',data.caption));article.append(figure,node('h4',data.title));
  const dl=node('dl');for(const[label,key]of[['画面里可见','see'],['可借鉴的方法','learn'],['对本项目的启发 · 提案','apply']])dl.append(node('dt',label),node('dd',data[key]));article.append(dl);container.append(article);
 }
 document.querySelectorAll('[data-lens]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lens===lens)));document.body.dataset.lens=lens;
}
const sources=await fetch(media+'sources.json').then(r=>{if(!r.ok)throw Error('来源清单不可用');return r.json();});
function open(ref,data){const img=document.getElementById('dialog-image');img.src=media+data.image+'.webp';img.alt=data.alt;document.getElementById('dialog-caption').textContent=data.caption+' / '+ref.rights;document.getElementById('dialog-source').href=sources.images.find(s=>s.id===data.image).original;dialog.showModal();}
document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('[data-lens]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.lens)));
render('world');window.__referenceBoard={ready:true,lens:lens=>document.querySelector(`[data-lens="${lens}"]`)?.click(),state:()=>({lens:document.body.dataset.lens,images:[...container.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')})),dialog:dialog.open})};
