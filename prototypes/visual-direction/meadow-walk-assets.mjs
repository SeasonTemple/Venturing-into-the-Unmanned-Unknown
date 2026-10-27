import{createRequire}from'node:module';
import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{fileURLToPath}from'node:url';
import{route,target}from'./meadow-route.mjs';
const sharp=createRequire(new URL('../../site/package.json',import.meta.url))('sharp');
const root=new URL('./meadow-media/',import.meta.url),file=name=>fileURLToPath(new URL(name,root));
const src=await readFile(file('hero-v04.webp'));
const{data:original,info}=await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,C=info.channels,data=Buffer.from(original);
const inside=(x,y,p)=>{let v=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))v=!v;}return v;};
const person=[[37,7],[59,7],[65,14],[65,32],[71,39],[80,49],[89,60],[90,72],[83,81],[74,86],[73,111],[68,139],[69,184],[53,186],[52,180],[54,150],[47,124],[44,145],[44,180],[23,183],[22,177],[31,167],[31,144],[29,130],[29,115],[20,117],[4,110],[4,96],[12,91],[12,82],[17,70],[21,53],[28,39],[36,33],[33,23]].map(([x,y])=>[x+1210,y+676]);
const alpha=Buffer.alloc(W*H);
for(let y=677;y<865;y++)for(let x=1211;x<1304;x++)if(inside(x,y,person)){
  const i=(y*W+x)*C,r=original[i],g=original[i+1],b=original[i+2];
  const gap=inside(x-1210,y-676,[[46,119],[51,144],[54,178],[44,179],[44,151]]);
  alpha[y*W+x]=gap?0:255;
}
// Subtle trampled connection joins the existing porch to the painted road.
for(let y=840;y<954;y++)for(let x=650;x<1250;x++){
  let d=Infinity;
  for(let j=1;j<6;j++){const a=route[j-1],b=route[j],vx=b[0]-a[0],vy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*vx+(y-a[1])*vy)/(vx*vx+vy*vy)));d=Math.min(d,Math.hypot(x-a[0]-t*vx,y-a[1]-t*vy));}
  if(d>18||alpha[y*W+x])continue;
  const blend=.27*(1-d/18)*(.65+.35*Math.sin(Math.floor(x/4)*3.1+Math.floor(y/3)*1.7));
  const i=(y*W+x)*C,s=((904+(y%17))*W+620+(x%27))*C;
  for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*(1-blend)+original[s+c]*blend);
}
await sharp(data,{raw:info}).webp({quality:94,effort:6}).toFile(file('hero-route-v01.webp'));
const plate=Buffer.from(data);
for(let y=670;y<875;y++)for(let x=1203;x<1314;x++){
  // Replace the whole exposed patch, including highlights outside the cutout.
  // Preserve the neighboring equipment chest as a separate solid boundary.
  if(y>=809&&x>=1278)continue;
  const edge=Math.max(1211-x,x-1305,679-y,y-866,0),blend=Math.max(0,1-edge/8);
  if(!blend)continue;
  const i=(y*W+x)*C,s=((y+(y>=851?9:0))*W+x-110)*C;
  // The feather lives outside the fully replaced patch, never through anatomy.
  for(let c=0;c<3;c++)plate[i+c]=Math.round(data[i+c]*(1-blend)+data[s+c]*blend);
}
await sharp(plate,{raw:info}).webp({quality:94,effort:6}).toFile(file('walk-plate-v01.webp'));
const idle=Buffer.alloc(100*195*4);
for(let y=0;y<195;y++)for(let x=0;x<100;x++){
  const i=(y*100+x)*4,s=((y+676)*W+x+1210)*C;
  for(let c=0;c<3;c++)idle[i+c]=original[s+c];idle[i+3]=alpha[(y+676)*W+x+1210];
}
await sharp(idle,{raw:{width:100,height:195,channels:4}}).png().toFile(file('engineer-idle-v01.png'));
const occluder=Buffer.alloc(W*H*4);
const cart=[[832,898],[957,898],[968,916],[964,941],[953,965],[947,988],[922,999],[901,989],[883,1004],[849,991],[835,971],[810,973],[801,948],[816,925]];
for(let y=801;y<1010;y++)for(let x=800;x<981;x++){
  const isCart=inside(x,y,cart),isMast=x>=930&&x<=943&&y>=802&&y<=902;
  if(!isCart&&!isMast)continue;
  const i=(y*W+x)*4,s=(y*W+x)*C;for(let c=0;c<3;c++)occluder[i+c]=data[s+c];occluder[i+3]=255;
}
await sharp(occluder,{raw:{width:W,height:H,channels:4}}).png().toFile(file('walk-foreground-v01.png'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const manifest={source:'hero-v04.webp',sourceSha256:digest(src),route,station:{x:1254,y:858},target:{x:target[0],y:target[1]},idle:{file:'engineer-idle-v01.png',width:100,height:195,anchor:[44,182],bodyHeight:174},plate:'walk-plate-v01.webp',poster:'hero-route-v01.webp',foreground:'walk-foreground-v01.png',method:'Source-pixel cutout with a manual silhouette; local grass clone with exterior feather and porch reconstruction; restrained worn route; original cart foreground cutout. No scene regeneration.',scope:'Bounded 2D layered exploration in the original painting; no free 3D camera.'};
await writeFile(file('walk-sources.json'),JSON.stringify(manifest,null,2)+'\n');
await sharp(file('walk-plate-v01.webp')).extract({left:1170,top:660,width:190,height:230}).resize(570,690,{kernel:'nearest'}).png().toFile(file('../../../.lab/meadow-study/plate-inspection.png'));
console.log(JSON.stringify(manifest,null,2));
