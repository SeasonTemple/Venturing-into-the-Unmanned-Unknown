// Offline authoring only: local reference frames + pixel repairs + two-bone IK.
// No network, paid service, foreign repository code, or production-page changes.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SPEC,gaitPose,turnPose,mix} from './motion-proof-geometry.mjs';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,'motion-proof-media'),lab=resolve(root,'../../.lab/motion-proof');
const sharp=createRequire(resolve(root,'../../site/package.json'))('sharp');
await mkdir(out,{recursive:true});await mkdir(resolve(lab,'turn-inputs'),{recursive:true});
const video=resolve(root,'meadow-media/directional-v02.mp4');
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',video,'-vf','trim=start_frame=96:end_frame=115,setpts=PTS-STARTPTS','-fps_mode','passthrough',resolve(lab,'turn-inputs/%03d.png')],{windowsHide:true,maxBuffer:1e6});
const W=SPEC.width,H=SPEC.height,rgba={width:W,height:H,channels:4};
const inside=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const polygon=(dst,p,color)=>{const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);for(let y=Math.max(0,Math.floor(Math.min(...ys)));y<=Math.min(H-1,Math.ceil(Math.max(...ys)));y++)for(let x=Math.max(0,Math.floor(Math.min(...xs)));x<=Math.min(W-1,Math.ceil(Math.max(...xs)));x++)if(inside(x+.5,y+.5,p)){const c=typeof color==='function'?color(x,y):color;const k=(y*W+x)*4;for(let j=0;j<3;j++)dst[k+j]=c[j];dst[k+3]=255;}};
const disk=(dst,x,y,r,c)=>polygon(dst,Array.from({length:10},(_,i)=>[x+Math.cos(i*Math.PI/5)*r,y+Math.sin(i*Math.PI/5)*r]),c);
async function reference(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=info.width,y0=info.height,x1=0,y1=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,[r,g,b]=data.subarray(i,i+3);if(g>r*1.5&&g>b*1.5&&g>80)data[i+3]=0;else if(data[i+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
 const image=await sharp(data,{raw:info}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize({height:174,kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Pants at the middle of the lower legs locate the body's horizontal origin,
 // independently of how far the toolbox extends in each camera view.
 const columns=[];for(let y=126;y<143;y++)for(let x=0;x<image.info.width;x++){const k=(y*image.info.width+x)*4;if(image.data[k+3]&&image.data[k+1]>image.data[k]*.95)columns.push(x);}
 columns.sort((a,b)=>a-b);return {...image,hipX:columns[Math.floor(columns.length/2)]};
}
const refs=[];for(let i=0;i<19;i++)refs.push(await reference(resolve(lab,`turn-inputs/${String(i+1).padStart(3,'0')}.png`)));
// Semantic masks are authored for these two references, not a universal auto-rig.
const configs={
 left:{ref:0,hipX:27,neck:[26,29],shoulder:[32,44],elbow:[44,59],wrist:[29,77],toolPivot:[8,85],
  // Keep the actual side-face silhouette. The previous wide polygon admitted
  // shoulder/coat pixels and made the head read larger than the source.
  head:[[8,0],[40,0],[41,24],[36,32],[11,32],[7,24]],
  torso:[[11,31],[27,29],[36,36],[34,48],[31,64],[32,77],[35,85],[34,91],[13,91],[12,66],[10,45]],
  upper:[[28,39],[35,40],[44,48],[51,57],[49,64],[39,66],[32,55],[28,48]],
  lower:[[40,57],[50,60],[48,69],[40,77],[33,80],[26,81],[26,74],[34,70],[37,64]],
  tool:[[4,83],[10,81],[14,86],[15,95],[12,108],[1,106],[0,100],[1,91]],
  near:'left',far:'right',pants:[20,94,15,60]},
 right:{ref:18,hipX:22,neck:[23,29],shoulder:[14,41],elbow:[12,62],wrist:[16,85],toolPivot:[16,85],
  // Include the right-facing eye/nose at the front edge without widening the
  // hair mass into the jacket.
  head:[[8,0],[38,0],[40,22],[36,31],[16,30],[8,23]],
  torso:[[14,28],[27,29],[34,36],[34,64],[35,83],[31,91],[17,90],[15,70],[16,49],[11,41]],
  upper:[[9,36],[18,39],[20,54],[19,64],[6,65],[3,53],[5,44]],
  lower:[[7,59],[19,58],[21,73],[20,83],[10,84],[7,73]],
  tool:[[9,81],[25,81],[27,86],[36,87],[40,92],[39,109],[30,114],[4,115],[0,108],[0,95],[4,90],[9,88]],
  near:'right',far:'left',pants:[14,113,11,45]}
};
function layer(ref,p,extend=true){
 const d=Buffer.from(ref.data),w=ref.info.width,h=ref.info.height;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(!inside(x+.5,y+.5,p)){d[k+3]=0;continue;}
  // Extend hidden edges inside a semantic mask only; do not pull grass into joints.
  if(extend&&!d[k+3]){let best=null;for(let r=1;r<8&&!best;r++)for(let dy=-r;dy<=r&&!best;dy++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy<0||yy>=h||!inside(xx+.5,yy+.5,p))continue;const q=(yy*w+xx)*4;if(ref.data[q+3]){best=ref.data.subarray(q,q+3);break;}}if(best){for(let c=0;c<3;c++)d[k+c]=best[c];d[k+3]=255;}}
 }return {data:d,width:w,height:h};
}
// Reduce the oversized side-profile head around its neck pivot. Sampling is
// nearest-neighbour so the pixel clusters stay hard-edged and deterministic.
function scaleLayerAround(img,pivot,scale=.92){
 const d=Buffer.alloc(img.data.length);
 for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
  const sx=Math.round(pivot[0]+(x-pivot[0])/scale),sy=Math.round(pivot[1]+(y-pivot[1])/scale);
  if(sx<0||sy<0||sx>=img.width||sy>=img.height)continue;
  const a=(sy*img.width+sx)*4,b=(y*img.width+x)*4;
  if(!img.data[a+3])continue;img.data.copy(d,b,a,a+4);
 }
 return {data:d,width:img.width,height:img.height};
}
function aff(dst,img,m){
 const [a,b,c,d,tx,ty]=m,det=a*d-b*c;if(Math.abs(det)<.0001)return;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const px=x+.5-tx,py=y+.5-ty,sx=Math.floor((d*px-c*py)/det),sy=Math.floor((-b*px+a*py)/det);if(sx<0||sy<0||sx>=img.width||sy>=img.height)continue;const s=(sy*img.width+sx)*4;if(!img.data[s+3])continue;const k=(y*W+x)*4;img.data.copy(dst,k,s,s+4);}
}
function anchored(from,to,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return [c,s,-s,c,to[0]-c*from[0]+s*from[1],to[1]-s*from[0]-c*from[1]];}
function bone(fromA,fromB,toA,toB){const a=Math.atan2(toB[1]-toA[1],toB[0]-toA[0])-Math.atan2(fromB[1]-fromA[1],fromB[0]-fromA[0]);const scale=Math.hypot(toB[0]-toA[0],toB[1]-toA[1])/Math.hypot(fromB[0]-fromA[0],fromB[1]-fromA[1]);const c=Math.cos(a)*scale,s=Math.sin(a)*scale;return [c,s,-s,c,toA[0]-c*fromA[0]+s*fromA[1],toA[1]-s*fromA[0]-c*fromA[1]];}
const apply=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
function segment(dst,a,b,wa,wb,ref,texture,dark=1){
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=dy/len,ny=-dx/len;
 const p=[[a[0]-nx*wa,a[1]-ny*wa],[a[0]+nx*wa,a[1]+ny*wa],[b[0]+nx*wb,b[1]+ny*wb],[b[0]-nx*wb,b[1]-ny*wb]];
 polygon(dst,p,(x,y)=>{const u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(len*len))),v=Math.max(0,Math.min(.999,(((x-a[0])*nx+(y-a[1])*ny)/(2*mix(wa,wb,u)))+.5));const sx=Math.floor(texture[0]+v*texture[2]),sy=Math.floor(texture[1]+u*texture[3]);const k=(Math.min(ref.info.height-1,sy)*ref.info.width+Math.min(ref.info.width-1,sx))*4;let c=[...ref.data.subarray(k,k+3)];
  // Newly visible trouser surfaces are painted from the trouser palette,
  // never stretched from a single row or filled with the silver toolbox.
  // Keep broad fabric clusters. Raw video trouser patches contain baked
  // highlights and compression specks; don't tile those into moving calves.
  c=v<.18?[69,79,45]:v<.4?[52,66,41]:v<.8?[37,55,39]:[25,43,35];
  if(u>.25&&u<.46&&v>.22+u*.5&&v<.46+u*.5)c=[43,59,38];
  if(u>.77&&v<.55-u*.3)c=[62,74,44];
  return c.map(n=>Math.round(n*dark));});
 disk(dst,a[0],a[1],Math.min(wa,3),[Math.round(40*dark),Math.round(57*dark),Math.round(37*dark)]);
}
function boot(dst,ankle,sign,frontness=0,dark=1,pitch=0){
 const [x,y]=ankle,sw=4+frontness*1.4,reach=14*Math.abs(sign)+frontness*4;
 const p=[[-sw,-2],[sw,-2],[sw+Math.abs(sign)*3,1],[reach,3],[reach+1,6],[reach-2,7],[-sw,7]].map(([u,v])=>[x+Math.cos(pitch)*u*(sign<0?-1:1)-Math.sin(pitch)*v,y+Math.sin(pitch)*u+Math.cos(pitch)*v]);
 polygon(dst,p,(px,py)=>{const top=py<y+3;const band=py>=y+6;return (band?[31,36,35]:top?[61,65,57]:[43,48,44]).map(n=>Math.round(n*dark));});
}
function drawLeg(dst,l,cfg,ref,near=true,sign=1,frontness=0){
 const dark=near?1:.8;
 segment(dst,l.hip,l.knee,6.15,4.8,ref,cfg.pants,dark);
 segment(dst,l.knee,l.ankle,4.85,3.6,ref,[cfg.pants[0],cfg.pants[1]+18,cfg.pants[2],Math.min(34,cfg.pants[3]-18)],dark);
 boot(dst,l.ankle,sign,frontness,dark,l.pitch);
}
function recorder(dst,wrist,front=true){
 const x=Math.round(wrist[0]-2),y=Math.round(wrist[1]+2),wide=front?6:4;
 polygon(dst,[[x-1,y],[x+wide,y],[x+wide,y+13],[x-1,y+13]],[27,48,40]);
 polygon(dst,[[x,y+1],[x+wide-1,y+1],[x+wide-1,y+12],[x,y+12]],[67,91,75]);
 polygon(dst,[[x+1,y+3],[x+wide-2,y+3],[x+wide-2,y+6],[x+1,y+6]],[150,177,152]);
 polygon(dst,[[x+1,y+9],[x+3,y+9],[x+3,y+10],[x+1,y+10]],[169,186,155]);
 disk(dst,wrist[0],wrist[1],2.8,[30,44,37]);
}
function paintedSleeve(dst,a,b,width,color){
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=dy/len*width,ny=-dx/len*width;
 polygon(dst,[[a[0]-nx,a[1]-ny],[a[0]+nx,a[1]+ny],[b[0]+nx*.7,b[1]+ny*.7],[b[0]-nx*.7,b[1]-ny*.7]],(x)=>color.map((n,i)=>Math.max(0,n+(x<a[0]?-6:i===0?6:2))));
}
const allLayers={};
for(const [name,cfg]of Object.entries(configs)){
 const ref=refs[cfg.ref],layers={};await mkdir(resolve(out,'layers',name),{recursive:true});
 for(const key of ['head','torso','upper','lower','tool']){layers[key]=layer(ref,cfg[key],key!=='head');if(key==='head')layers[key]=scaleLayerAround(layers[key],cfg.neck,.92);await sharp(layers[key].data,{raw:{width:ref.info.width,height:ref.info.height,channels:4}}).png().toFile(resolve(out,'layers',name,key+'.png'));}
 await sharp(ref.data,{raw:ref.info}).png().toFile(resolve(out,name+'-reference.png'));
 allLayers[name]=layers;
}
function renderGait(direction,phase,energy=1){
 const p=gaitPose(phase,direction,energy),cfg=configs[direction],ref=refs[cfg.ref],layers=allLayers[direction],dst=Buffer.alloc(W*H*4);
 // Bake one lean per heading. Varying fractional rotation resamples painted
 // columns independently, making a rigid head/jacket appear to crawl or tear.
 const m=anchored([cfg.hipX,91],[64,104],p.sign*.025*energy);
 m[4]+=Math.round(p.hip[0]-64);m[5]+=Math.round(p.hip[1]-104);
 const bodyPoint=q=>apply(m,q);
 drawLeg(dst,p.legs[cfg.far],cfg,ref,false,p.sign);drawLeg(dst,p.legs[cfg.near],cfg,ref,true,p.sign);
 // Far arm is fully reconstructed under the jacket, rather than borrowed
 // from the visible arm and mirrored. Its equipment retains anatomical identity.
 const shoulder=bodyPoint(direction==='left'?[17,44]:[29,43]);
 const swing=-Math.sin(phase*Math.PI*2)*.7*energy;
 const farWrist=bodyPoint(direction==='left'?[8+swing,85]:[33+swing,76]);
 paintedSleeve(dst,shoulder,farWrist,3.9,direction==='left'?[143,76,34]:[144,82,37]);
 disk(dst,farWrist[0],farWrist[1],2.7,[31,43,36]);
 if(cfg.far==='right')aff(dst,layers.tool,anchored(cfg.toolPivot,farWrist,Math.sin(phase*Math.PI*2-.25)*.018*energy));
 else recorder(dst,farWrist,false);
 aff(dst,layers.torso,m);
 const nearShoulder=bodyPoint(cfg.shoulder),nearElbow=bodyPoint([cfg.elbow[0]+swing*.5,cfg.elbow[1]+Math.sin(phase*Math.PI*4)*.4*energy]);
 const nearWrist=bodyPoint([cfg.wrist[0]+swing,cfg.wrist[1]+Math.sin(phase*Math.PI*2)*.35*energy]);
 aff(dst,layers.upper,bone(cfg.shoulder,cfg.elbow,nearShoulder,nearElbow));
 aff(dst,layers.lower,bone(cfg.elbow,cfg.wrist,nearElbow,nearWrist));
 disk(dst,nearElbow[0],nearElbow[1],1.5,direction==='left'?[150,78,36]:[203,112,42]);
 if(cfg.near==='right')aff(dst,layers.tool,anchored(cfg.toolPivot,nearWrist,Math.sin(phase*Math.PI*2-.25)*.018*energy));
 else recorder(dst,nearWrist,true);
 // Preserve the complete side face as a rigid pixel cluster. The gaze follows
 // travel; the stabilized head translates only on the integer authoring grid.
 const headOrigin=[Math.round(p.hip[0])-cfg.hipX,Math.round(p.hip[1])-91];
 const neck=[headOrigin[0]+cfg.neck[0],headOrigin[1]+cfg.neck[1]];
 aff(dst,layers.head,[1,0,0,1,...headOrigin]);
 return {pixels:dst,joints:{...p,shoulders:[shoulder,nearShoulder],hands:{[cfg.far]:farWrist,[cfg.near]:nearWrist},neck,headOrigin,headRaster:'integer-translation',toolHand:'right',recorderHand:'left'}};
}
function renderTurn(i){
 const t=i/18,p=turnPose(t),ref=refs[i],cfg={...configs[t<.5?'left':'right'],pants:[Math.max(0,ref.hipX-4),114,8,39]},dst=Buffer.alloc(W*H*4);
 const near=t<.5?'left':'right',far=near==='left'?'right':'left';
 drawLeg(dst,p.legs[far],cfg,ref,false,p.sign,Math.cos(p.yaw));drawLeg(dst,p.legs[near],cfg,ref,true,p.sign,Math.cos(p.yaw));
 const upper=Buffer.from(ref.data),w=ref.info.width;
 for(let y=0;y<174;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4;
  if(y>91){upper[k+3]=0;continue;}
  // Both carried objects are drawn independently. Remove their old video
  // silhouettes completely instead of retaining isolated thresholded pixels.
  if(y>77){const [r,g,b]=upper.subarray(k,k+3);const jacket=r>g*1.05&&r>b*1.2&&Math.abs(x-ref.hipX)<19;if(!jacket)upper[k+3]=0;}
 }
 const bodyMatrix=anchored([ref.hipX,91],p.hip);
 function wristFromSource(side,fallback){
  const candidates=[];for(let y=side==='right'?80:73;y<(side==='right'?89:83);y++)for(let x=0;x<w;x++){
   if(side==='right'?x>=ref.hipX-2:x<=ref.hipX+2)continue;
   const k=(y*w+x)*4,[r,g,b]=ref.data.subarray(k,k+3);if(ref.data[k+3]&&r<85&&g<85&&b<85&&r<g*1.3)candidates.push([x,y]);
  }
  if(candidates.length<5)return fallback;const xs=candidates.map(p=>p[0]).sort((a,b)=>a-b),ys=candidates.map(p=>p[1]).sort((a,b)=>a-b);return apply(bodyMatrix,[xs[Math.floor(xs.length/2)],ys[Math.floor(ys.length/2)]]);
 }
 const hand=wristFromSource('left',[p.hip[0]+mix(2,11,t)+21*Math.sin(Math.PI*t),p.hip[1]+mix(-14,-15,t)]);
 const toolHand=wristFromSource('right',[p.hip[0]+mix(-19,-6,t)-11*Math.sin(Math.PI*t),p.hip[1]-6]);
 const toolElbow=[toolHand[0]+mix(1,-2,t),toolHand[1]-8];
 const recorderElbow=[hand[0]+2,hand[1]-7];
 const boxScaleX=mix(.4,1,t)+.18*Math.sin(Math.PI*t),boxScaleY=mix(.78,1,t);
 const toolMatrix=[boxScaleX,0,0,boxScaleY,toolHand[0]-boxScaleX*configs.right.toolPivot[0],toolHand[1]-boxScaleY*configs.right.toolPivot[1]];
 const toolSleeve=()=>paintedSleeve(dst,toolElbow,toolHand,4.3,[Math.round(184+40*t),Math.round(94+20*t),Math.round(35+5*t)]);
 const deviceSleeve=()=>paintedSleeve(dst,recorderElbow,hand,3.5,[151,81,36]);
 if(t>.7){deviceSleeve();recorder(dst,hand,false);}if(t<.4){toolSleeve();aff(dst,allLayers.right.tool,toolMatrix);}
 aff(dst,{data:upper,width:w,height:174},anchored([ref.hipX,91],p.hip));
 if(t>=.4){toolSleeve();aff(dst,allLayers.right.tool,toolMatrix);}
 if(t<=.7){deviceSleeve();recorder(dst,hand,true);}
 return {pixels:dst,joints:{...p,sourceFrame:96+i,hands:{right:toolHand,left:hand},toolHand:'right',recorderHand:'left'}};
}
// One shared palette derived from the original approved identity, not a fresh
// palette per frame. Keep nearest-neighbour pixel edges and binary alpha.
const approved=resolve(root,'art-pack-media/actor-front.png');
const quantized=await sharp(await sharp(approved).png({palette:true,colours:96,dither:0}).toBuffer()).ensureAlpha().raw().toBuffer();
const colors=new Map();for(let i=0;i<quantized.length;i+=4)if(quantized[i+3]>128){const c=[...quantized.subarray(i,i+3)];colors.set(c.join(','),c);}const palette=[...colors.values()],cache=new Map();
function lockPalette(data){for(let k=0;k<data.length;k+=4){if(!data[k+3])continue;const key=(data[k]<<16)+(data[k+1]<<8)+data[k+2];let c=cache.get(key);if(!c){let min=Infinity;for(const p of palette){const dist=2*(data[k]-p[0])**2+3*(data[k+1]-p[1])**2+(data[k+2]-p[2])**2;if(dist<min){min=dist;c=p;}}cache.set(key,c);}for(let j=0;j<3;j++)data[k+j]=c[j];data[k+3]=255;}return data;}
const records={};
async function atlas(name,frames,columns=6){
 const cells=[];for(let i=0;i<frames.length;i++){lockPalette(frames[i].pixels);const b=await sharp(frames[i].pixels,{raw:rgba}).png().toBuffer();cells.push({input:b,left:i%columns*W,top:Math.floor(i/columns)*H});}
 const path=resolve(out,name+'.png');await sharp({create:{width:W*columns,height:H*Math.ceil(frames.length/columns),channels:4,background:'#00000000'}}).composite(cells).png().toFile(path);
 records[name]={file:name+'.png',columns,count:frames.length,joints:frames.map(f=>f.joints)};
 return cells;
}
const frames={};for(const direction of ['left','right']){frames[direction]=Array.from({length:24},(_,i)=>renderGait(direction,i/24));frames[direction].push(renderGait(direction,0,0));await atlas(direction+'-walk',frames[direction]);}
const turns=Array.from({length:19},(_,i)=>renderTurn(i));await atlas('turn',turns);
await sharp(resolve(root,'meadow-media/walk-plate-v01.webp')).extract({left:700,top:590,width:960,height:380}).webp({quality:94}).toFile(resolve(out,'route-plate.webp'));
// Contact sheet: same six meaningful phases on both sides, plus real turn views.
const picks=[0,3,6,12,15,18],contact=[];
for(let row=0;row<3;row++)for(let col=0;col<6;col++){
 const f=row===2?turns[Math.round(col*18/5)]:frames[row===0?'left':'right'][picks[col]];
 const image=await sharp(f.pixels,{raw:rgba}).resize(W*2,H*2,{kernel:'nearest'}).png().toBuffer();contact.push({input:image,left:col*W*2,top:row*(H*2+32)+32});
 const label=row===2?`TURN ${Math.round(col*18/5)+1}/19`:`${row===0?'LEFT':'RIGHT'} ${picks[col]+1}/24`;
 contact.push({input:Buffer.from(`<svg width="256" height="32"><text x="14" y="23" fill="#344b3d" font-size="15" font-family="monospace">${label}</text></svg>`),left:col*W*2,top:row*(H*2+32)});
}
await sharp({create:{width:1536,height:(H*2+32)*3,channels:3,background:'#c8d2ba'}}).composite(contact).webp({quality:96}).toFile(resolve(out,'contact.webp'));
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const meta={version:1,checkedOn:'2026-10-28',status:'offline motion candidate; visual approval pending',spec:SPEC,palette,atlases:records,identitySource:{file:'../art-pack-media/actor-front.png',sha256:await sha(approved)},videoSource:{file:'../meadow-media/directional-v02.mp4',sha256:await sha(video),leftFrame:96,rightFrame:114,turnFrames:[96,114],newVideoRequests:0},method:'Original offline authoring: semantic masks, hidden-edge extension, repainted continuous trouser segments, two-bone IK, restrained loaded arms, independent original left/right views, 19-frame two-step turn; shared approved-reference palette. No mirrored equipment or runtime rig.',equipment:{right:'silver toolbox',left:'green recorder'},outputs:{},limitations:['Generated source orientations still require identity/art approval.','Turn uses source-video upper-body views; their silhouette/lighting continuity is a review item.','Legs and far sleeves are newly reconstructed pixel surfaces; contact math does not certify aesthetic quality.','No held-book or port-operation animation.','No production integration or ten-minute browser soak test in this asset build.']};
meta.version=4;meta.revision='walk04';
meta.headRaster={mode:'integer-translation',scale:.92,rotation:0,sourceMaskExtension:false,notes:'Side-face silhouette is reduced modestly around the neck pivot. Head texture is invariant across gait phases; jacket lean is baked once per heading. Turn frames remain from the original video.'};
for(const file of ['left-walk.png','right-walk.png','turn.png','route-plate.webp','contact.webp','left-reference.png','right-reference.png'])meta.outputs[file]={sha256:await sha(resolve(out,file)),bytes:(await readFile(resolve(out,file))).length};
await writeFile(resolve(out,'rig-config.json'),JSON.stringify(configs,null,2)+'\n');
await writeFile(resolve(out,'motion.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({out,walkFramesPerDirection:24,turnFrames:19,paletteColors:palette.length,images:meta.outputs,newMediaRequests:0}));
