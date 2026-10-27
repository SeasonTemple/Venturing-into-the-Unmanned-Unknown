import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(new URL('../../site/package.json',import.meta.url))('sharp');
const root=new URL('./meadow-media/',import.meta.url);
const source=await readFile(new URL('hero-v03.jpg',root));
const {data,info}=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
const {width:W,height:H,channels:C}=info;
const edits=[];
function rect(x,y,w,h,color){
  const rgb=color.match(/../g).map(n=>parseInt(n,16));
  for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)for(let c=0;c<3;c++)data[(py*W+px)*C+c]=rgb[c];
}
function line(points,color,width=1){
  for(let n=1;n<points.length;n++){
    const[a,b]=[points[n-1],points[n]],steps=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
    for(let i=0;i<=steps;i++)rect(Math.round(a[0]+(b[0]-a[0])*i/steps),Math.round(a[1]+(b[1]-a[1])*i/steps),width,width,color);
  }
}
// Small pixel retouches on the existing painting. No figure regeneration.
rect(1265,763,12,17,'263b38');rect(1267,765,8,8,'56847a');rect(1268,766,5,2,'b3d6bc');
rect(1268,770,4,1,'90b3a1');rect(1268,776,2,2,'d6a968');rect(1272,776,2,2,'8eaca1');
edits.push('A restrained field recorder at the existing right hand; original anatomy, feet and pose retained.');
rect(1735,789,12,9,'24383a');rect(1737,791,8,5,'56736b');rect(1739,792,4,3,'182d31');
line([[1740,796],[1735,806],[1704,806],[1687,796],[1687,769]],'79694e',2);
line([[1740,796],[1735,805],[1704,805],[1688,795],[1688,769]],'b39c6d');
rect(1685,765,6,7,'324b48');rect(1687,767,2,2,'9fb5a2');
edits.push('A recessed rover service port with a cable that terminates at a bench connector.');
const refined=await sharp(data,{raw:info}).webp({quality:94,effort:6}).toBuffer();
await writeFile(new URL('hero-v04.webp',root),refined);

// Opaque RGB avoids browser premultiplication destroying mask data.
// Characters remain static; this mask describes environmental movement only.
const w=960,h=540,mask=Buffer.alloc(w*h*3);
const inside=(x,y,pts)=>{let yes=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}return yes;};
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const protectedRoof=[[1258,530],[1401,411],[1393,370],[1462,332],[1920,331],[1920,1080],[1258,1080]];
const grasses=[
  {p:[[5,858],[180,856],[249,947],[318,1079],[0,1079]],top:852,bottom:1080},
  {p:[[305,910],[394,914],[456,1006],[377,1032]],top:910,bottom:1032},
  {p:[[770,1008],[808,956],[875,976],[916,1078],[782,1079]],top:952,bottom:1080},
  {p:[[960,944],[1028,911],[1091,943],[1134,1037],[1042,1061]],top:910,bottom:1060},
  {p:[[1342,944],[1436,918],[1523,947],[1576,1046],[1443,1078]],top:918,bottom:1080},
  {p:[[1665,965],[1760,916],[1858,966],[1919,1060],[1764,1079]],top:916,bottom:1080}
];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const px=x*2,py=y*2,i=(y*w+x)*3,s=(py*W+px)*C;
  const[r,g,b]=[data[s],data[s+1],data[s+2]];
  const onRoof=inside(px,py,protectedRoof)||(px>1400&&px<1575&&py>218&&py<350)||(px>1750&&px<1797&&py>298&&py<358);
  mask[i]=!onRoof&&py<565?Math.round(255*(1-smooth(505,565,py))):0;
  const aqua=g>r*1.12&&b>r*1.06&&g>120;
  const inWater=py>650&&((py<833&&px<1110)||(py>1018&&px>435&&px<805));
  mask[i+1]=aqua&&inWater?235:0;
  let grass=0;
  if(g>r*1.09&&g>b*1.08)for(const zone of grasses)if(inside(px,py,zone.p))grass=Math.max(grass,.85*(1-smooth(zone.top,zone.bottom,py)));
  mask[i+2]=Math.round(grass*255);
}
// Constrain motion away from boundaries. Sky erosion also protects roof edges.
const maskInfo={width:w,height:h,channels:3};
const softened=await sharp(mask,{raw:maskInfo}).blur(2).raw().toBuffer();
for(let i=0;i<mask.length;i++)mask[i]=Math.round(Math.max(0,(softened[i]/255-.15)/.85)*mask[i]);
await sharp(mask,{raw:maskInfo}).png().toFile(fileURLToPath(new URL('motion-mask-v01.png',root)));
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifest={source:'hero-v03.jpg',sourceSha256:digest(source),refined:'hero-v04.webp',refinedSha256:digest(refined),width:W,height:H,refinedBytes:refined.length,method:'Original approved artwork with local pixel retouches and independent motion data masks; no new AI generation.',edits,mask:{file:'motion-mask-v01.png',width:w,height:h,channels:{r:'sky, roof and mast excluded',g:'water colour within water regions',b:'selected grass clumps with fixed roots'},character:'Static; local torso displacement removed after visual feedback.'},runtime:'One WebGL draw, two textures, <=24fps; raster fallback; not a navigable scene.'};
await writeFile(new URL('motion-sources.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
