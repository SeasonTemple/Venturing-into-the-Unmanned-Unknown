// Static pixel authoring. Contours are authored per view; cloth colour clusters
// are sampled from the original front painting, not an IK/animation segment.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,'standing-media');
const sharp=createRequire(resolve(root,'../../site/package.json'))('sharp');
const W=128,H=196,TOP=11;
const original=await sharp(resolve(out,'front-whole.png')).ensureAlpha().raw().toBuffer();
const fronts={far:{x:48,width:8},near:{x:25,width:10}};
const configs={
 left:{offset:38,sign:-1,far:[[115,15,26],[118,17,26],[126,18,26],[133,19,26],[143,19,26],[153,20,27],[162,21,28],[165,21,28]],near:[[115,25,35],[124,25,34],[132,26,34],[142,27,35],[154,27,35],[165,27,35]],ankles:{far:[24,164],near:[31,166]}},
 right:{offset:44,sign:1,far:[[115,15,22],[124,15,22],[132,16,23],[142,16,22],[154,16,22],[165,16,23]],near:[[115,21,27],[124,21,27],[133,20,27],[143,20,27],[154,21,27],[165,21,28]],ankles:{far:[19,164],near:[25,166]}}
};
const mix=(a,b,t)=>a+(b-a)*t;
function span(keys,y){for(let i=1;i<keys.length;i++)if(y<=keys[i][0]){const a=keys[i-1],b=keys[i],t=(y-a[0])/(b[0]-a[0]);return [Math.round(mix(a[1],b[1],t)),Math.round(mix(a[2],b[2],t))];}return keys.at(-1).slice(1);}
function pixel(dst,x,y,c){if(x<0||x>=W||y<0||y>=H)return;const k=(y*W+x)*4;for(let j=0;j<3;j++)dst[k+j]=c[j];dst[k+3]=255;}
function color(x,y){const k=(y*W+x)*4;return [...original.subarray(k,k+3)];}
function cloth(dst,cfg,side,prior){
 const keys=cfg[side],ref=fronts[side],dark=side==='far'?.82:1;
 for(let y=115;y<=165;y++){
  const [a,b]=span(keys,y);
  for(let x=a;x<=b;x++){
   const u=(x-a)/(b-a+1),sx=25+ref.x+Math.min(ref.width-1,Math.floor(u*ref.width));
   const sample=color(sx,y+TOP);
   // Source colours that belong to empty crotch space/boots do not become
   // transparent trousers. Fall back to the adjoining original cloth cluster.
   let c=sample[1]>=sample[0]*.85&&sample[1]>=sample[2]*1.02?sample:[35,52,39];
   // Restrained fold planes at the knee and cuff, rather than tiled noise.
   if((y===132&&u>.2&&u<.7)||(y===134&&u>.45))c=[28,44,35];
   if(y===155&&u<.45)c=[61,73,46];
   if(y===162&&u>.45)c=[24,38,32];
   c=c.map(v=>Math.round(v*dark));
   // Join the repainted fabric into the retained upper thigh over six rows.
   // This is a fixed static seam repair, not a moving torso/limb patch.
   const old=((y+TOP)*W+x+cfg.offset)*4;
   if(y<121&&prior[old+3]){const t=(y-114)/7;for(let j=0;j<3;j++)c[j]=Math.round(mix(prior[old+j],c[j],t));}
   pixel(dst,x+cfg.offset,y+TOP,c);
  }
 }
}
function boot(dst,cfg,side){
 const [ankle,base]=cfg.ankles[side],dark=side==='far'?.83:1;
 // Native-pixel contour: shaft -> instep -> toe -> heel. Far sole sits two
 // image pixels higher to reflect depth, with no gap between calf and boot.
 const rows=[[-4,-3,3],[-3,-3,3],[-2,-3,3],[-1,-3,4],[0,-3,6],[1,-3,9],[2,-3,12],[3,-3,13],[4,-3,13],[5,-3,12],[6,-3,11],[7,-3,11]];
 for(const [dy,a,b]of rows)for(let u=a;u<=b;u++){
  let c=dy>=6?[24,25,27]:dy<0?[43,43,46]:[34,35,38];
  if(dy>=0&&dy<=2&&u>2&&u<8)c=[62,61,59];
  if(dy===3&&u>3)c=[48,48,48];
  if(dy===5&&u>0)c=[43,44,44];
  if((dy===-2||dy===0)&&u===1)c=[77,74,67];
  pixel(dst,cfg.offset+ankle+u*cfg.sign,TOP+base+dy,c.map(v=>Math.round(v*dark)));
 }
}
const cells=[],report={revision:'standing02',approved:false,method:'Static per-row pixel contours for trousers and boots; original front cloth colour clusters reused in side-specific silhouettes. No new media service calls, head edits, IK or runtime animation.',outputs:{},limits:['Static lower-body candidates only; fabric transfer and new boot shapes need art review.','Face/shoulder identity, loaded arm pose, tool perspective and source lighting remain unresolved.','The two soles have a two-pixel image-depth offset; this is not a new walking or world-contact test.']};
for(const view of ['front','left','right']){
 const source=await readFile(resolve(out,view+'-whole.png'));
 const data=await sharp(source).ensureAlpha().raw().toBuffer();
 if(view!=='front'){
  const cfg=configs[view];
  for(let y=TOP+115;y<H;y++)data.fill(0,y*W*4,(y+1)*W*4);
  const prior=await sharp(source).ensureAlpha().raw().toBuffer();
  cloth(data,cfg,'far',prior);boot(data,cfg,'far');cloth(data,cfg,'near',prior);boot(data,cfg,'near');
 }
 const buf=await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toBuffer();
 await writeFile(resolve(out,view+'-lower-v02.png'),buf);
 report.outputs[view]={file:view+'-lower-v02.png',source:view+'-whole.png',sha256:createHash('sha256').update(buf).digest('hex'),changedRegion:view==='front'?null:[0,TOP+115,W,H-(TOP+115)]};
 cells.push({input:await sharp(buf).resize(256,392,{kernel:'nearest'}).png().toBuffer(),left:cells.length*256,top:0});
}
await sharp({create:{width:768,height:392,channels:3,background:'#c5cfb8'}}).composite(cells).png().toFile(resolve(out,'standing-lower-board-v02.png'));
const close=[];for(const [row,suffix]of ['whole','lower-v02'].entries())for(const [col,view]of ['left','right'].entries())close.push({input:await sharp(resolve(out,view+'-'+suffix+'.png')).extract({left:32,top:116,width:64,height:74}).resize(256,296,{kernel:'nearest'}).png().toBuffer(),left:col*256,top:row*296});
await sharp({create:{width:512,height:592,channels:3,background:'#c5cfb8'}}).composite(close).png().toFile(resolve(out,'lower-before-after-v02.png'));
await writeFile(resolve(out,'standing-lower-v02.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
