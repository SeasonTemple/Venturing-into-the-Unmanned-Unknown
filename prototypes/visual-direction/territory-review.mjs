import {stations,links} from './territory-map.mjs';
const ns='http://www.w3.org/2000/svg',svg=document.getElementById('territory-map');
const point=p=>[230+p[0]*3,105+(24-p[2])*3];
function el(name,attrs,parent=svg){const e=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
for(let x=45;x<690;x+=30)el('path',{d:`M${x} 30V750`,stroke:'#bccbbc','stroke-width':'.5'});
for(let y=45;y<750;y+=30)el('path',{d:`M30 ${y}H690`,stroke:'#bccbbc','stroke-width':'.5'});
for(const line of links)el('polyline',{points:line.map(point).map(p=>p.join(',')).join(' '),fill:'none',stroke:'#997148','stroke-width':'4','stroke-linejoin':'round'});
stations.forEach(s=>{
 const[x,y]=point(s.position),a=el('a',{href:`./territory.html?view=space&region=${s.index}`});
 const w=s.size[0]*3,h=s.size[1]*3;
 el('rect',{x:x-w/2,y:y-h/2,width:w,height:h,fill:s.index===0?'#a2b6a4':'#bccbb9',stroke:'#536f68','stroke-width':'1.5'},a);
 el('circle',{cx:x,cy:y,r:'3',fill:'#83542e'},a);
 const label=el('text',{x:x+w/2+10,y:y-5,'font-size':'14',fill:'#24393d'},a);label.textContent=`0${s.index+1} ${s.place}`;
 const size=el('text',{x:x+w/2+10,y:y+14,'font-size':'10',fill:'#50675f'},a);size.textContent=`${s.size[0]} × ${s.size[1]} m / 地面 ${s.position[1]} m`;
});
const [ex,ey]=point([24,8,-188]);el('path',{d:`M${ex} ${ey-28}V${ey+16}`,stroke:'#69867c','stroke-width':'2','stroke-dasharray':'4 7'});const end=el('text',{x:ex+15,y:ey+8,'font-size':'12',fill:'#50675f'});end.textContent='已建路径的边界';
el('path',{d:'M42 767H102M42 762V772M102 762V772',stroke:'#24393d','stroke-width':'2'});const scale=el('text',{x:'42',y:'790','font-size':'11',fill:'#50675f'});scale.textContent='20 m';
for(const s of stations){const a=document.createElement("a");a.href=`./territory.html?view=space&region=${s.index}`;a.textContent=`0${s.index+1} / ${s.place}`;document.querySelector(".map-key").append(a);}
const proof=new URLSearchParams(location.search).has('proof');document.body.classList.toggle('proof',proof);
if(proof)document.querySelectorAll('[data-proof-src]').forEach(e=>e.src=e.dataset.proofSrc);
const fit=()=>document.querySelectorAll('.window').forEach(e=>e.firstElementChild.style.transform=`scale(${e.clientWidth/(Number(e.dataset.width)||1440)})`);new ResizeObserver(fit).observe(document.body);fit();
