// Whole-frame raster retouch for static review only. No limb/head transforms.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(root,'standing-media');
const sharp=createRequire(resolve(root,'../../site/package.json'))('sharp');
await mkdir(out,{recursive:true});
const sources={front:'art-pack-media/actor-front.png',left:'motion-proof-media/left-reference.png',right:'motion-proof-media/right-reference.png'};
const report={revision:'standing01',approved:false,method:'Whole-frame static raster colour and collar-edge retouch. Uniform full-body resizing only; no head/limb scaling, rotation, IK, mirroring or sprite recomposition.',sources:{},edits:{},limitations:['The two existing video views still differ in face, silhouette and baked light. These are conservative retouch candidates, not newly drawn approved character views.','Elbow posture and side-view tool silhouettes still follow the old source.','No walking, rig or production integration.'],generation:{provider:'MMX image-01',successfulImages:4,validationFailures:1,selected:[],rejected:['standing-pair-v01_001.jpg','standing-left-v02_001.jpg','standing-pair-v03_001.jpg','standing-right-v04_001.jpg']}};
const hash=b=>createHash('sha256').update(b).digest('hex');
const cell={width:128,height:196,channels:4},panels=[];
for(const [view,file]of Object.entries(sources)){
 const source=await readFile(resolve(root,file));
 const {data,info}=await sharp(source).resize({height:174,kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const before=Buffer.from(data);let alphaEdits=0,hairEdits=0,skinEdits=0,coatEdits=0,pantsEdits=0;
 // Retouch the source silhouette, preserving every remaining pixel's position.
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const k=(y*info.width+x)*4;if(!data[k+3])continue;
  let [r,g,b]=data.subarray(k,k+3);
  if(view==='left'&&y>=24&&y<=34){
   const edge=[36,36,35,35,35,35,36,36,36,37,38][y-24];
   if(x>edge){data[k+3]=0;alphaEdits++;continue;}
  }
  if(view!=='front'&&y<24&&g>r*1.12&&g>b*1.08){data[k+3]=0;alphaEdits++;continue;}
  if(view==='right'){
   const skin=y>=10&&y<27&&x>=24&&r>115&&g>75&&g>b*1.3;
   if(y<13&&!skin){
    const lum=(r*2+g*3+b)/6;
    const c=lum>112?[65,62,58]:lum>67?[48,47,49]:[34,35,39];
    for(let j=0;j<3;j++)data[k+j]=c[j];hairEdits++;
   }else if(skin){
    const lum=(r*2+g*3+b)/6;
    const c=lum>195?[234,196,132]:lum>165?[221,172,112]:lum>135?[197,141,88]:lum>105?[161,105,65]:[114,74,46];
    for(let j=0;j<3;j++)data[k+j]=c[j];skinEdits++;
   }else if(y>=118&&y<163&&g>r*.9&&g>b*1.07){
    const lum=(r*2+g*3+b)/6;
    const c=lum>100?[79,89,54]:lum>74?[63,75,47]:lum>48?[49,64,43]:[27,45,35];
    for(let j=0;j<3;j++)data[k+j]=c[j];pantsEdits++;
   }else if(y>=28&&y<91&&r>g*1.18&&g>b*1.1){
    // Bring oversaturated yellow-orange source cloth closer to the ochre coat.
    data[k]=Math.round(r*.87);data[k+1]=Math.round(g*.83);data[k+2]=Math.round(b*.94);coatEdits++;
   }
  }
 }
 // One original identity palette for all views; quantize colour only, never shape.
 const original=await sharp(resolve(root,sources.front)).ensureAlpha().raw().toBuffer();
 const palette=new Map();for(let i=0;i<original.length;i+=4)if(original[i+3]>128){const c=[...original.subarray(i,i+3)].map(v=>Math.round(v/16)*16);palette.set(c.join(','),c.map(v=>Math.min(255,v)));}
 const colors=[...palette.values()],cache=new Map();
 if(view!=='front')for(let k=0;k<data.length;k+=4)if(data[k+3]){
  const key=data.subarray(k,k+3).join(',');let c=cache.get(key);
  if(!c){let dist=Infinity;for(const p of colors){const d=2*(data[k]-p[0])**2+3*(data[k+1]-p[1])**2+(data[k+2]-p[2])**2;if(d<dist){dist=d;c=p;}}cache.set(key,c);}
  for(let j=0;j<3;j++)data[k+j]=c[j];data[k+3]=255;
 }
 const left=Math.floor((128-info.width)/2),top=11;
 async function panel(pixels){return sharp({create:{...cell,background:'#00000000'}}).composite([{input:await sharp(pixels,{raw:info}).png().toBuffer(),left,top}]).png().toBuffer();}
 const native=await panel(data),prior=await panel(before);
 await writeFile(resolve(out,view+'-whole.png'),native);await writeFile(resolve(out,view+'-before.png'),prior);
 report.sources[view]={file:'../'+file,sha256:hash(source),nativeSourceWidth:info.width,nativeSourceHeight:info.height,outputSha256:hash(native)};
 report.edits[view]={alphaEdits,hairEdits,skinEdits,coatEdits,pantsEdits};
 panels.push({input:await sharp(native).resize(256,392,{kernel:'nearest'}).png().toBuffer(),left:panels.length*256,top:0});
}
await sharp({create:{width:768,height:392,channels:3,background:'#c5cfb8'}}).composite(panels).png().toFile(resolve(out,'standing-whole-board.png'));
report.generation.attempts=[
 {file:'standing-pair-v01_001.jpg',seed:281201,prompt:'../meadow-prompts/standing-pair-v01.txt',characterRef:'../meadow-media/directional-input-v02.png',size:[1536,1024],reason:'Both face right; hoodie/rolled cuffs/full beard and smooth detail depart from identity.'},
 {file:'standing-left-v02_001.jpg',seed:281202,prompt:'../meadow-prompts/standing-left-v02.txt',characterRef:'../meadow-media/directional-input-v02.png',size:[768,1024],reason:'Three-quarter view, bulky coat, full beard and high boots differ from the original.'},
 {file:'standing-pair-v03_001.jpg',seed:281203,prompt:'../meadow-prompts/standing-pair-v03.txt',characterRef:null,size:[1024,768],reason:'Both show the same front/three-quarter direction, altered equipment ownership and added backpack straps.'},
 {file:'standing-right-v04_001.jpg',seed:281204,prompt:'../meadow-prompts/standing-right-v04.txt',characterRef:'../meadow-media/directional-input-v02.png',size:[768,1024],reason:'Front/three-quarter, stylized oversized head, open coat and incorrect recorder.'}
];
await writeFile(resolve(out,'standing-study.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
