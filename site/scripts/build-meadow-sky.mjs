// Offline exemplar completion: copy painted patches, never stretch sky scanlines.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)('sharp');
const root=new URL('../public/meadow/',import.meta.url);
const {data,info}=await sharp(fileURLToPath(new URL('hero-v04.webp',root))).removeAlpha().raw().toBuffer({resolveWithObject:true});
const W=1920,H=576,S=4,w=W/S,h=H/S,R=12;
const roof=[[1248,536],[1390,411],[1384,365],[1456,325],[1920,325],[1920,1080],[1248,1080]];
function inside(x,y){let yes=false;for(let i=0,j=roof.length-1;i<roof.length;j=i++){const a=roof[i],b=roof[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const covered=(x,y)=>inside(x,y)||(x>1392&&x<1584&&y>212&&y<354)||(x>1742&&x<1804&&y>290&&y<368)||y>=548;
const sky=Buffer.from(data.subarray(0,W*H*3)),missing=new Uint8Array(w*h),originalMissing=new Uint8Array(w*h);
const small=new Float32Array(w*h*3);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=y*w+x;missing[i]=originalMissing[i]=Number(covered(x*S,y*S));
 for(let c=0;c<3;c++)small[i*3+c]=data[(y*S*W+x*S)*info.channels+c];
}
// Donors are intact rectangles from this painting, not progressively filled pixels.
const donors=[];
for(let y=R;y<h-R;y+=3)for(let x=R;x<w-R;x+=3){
 let valid=true;
 for(let dy=-R;dy<R&&valid;dy++)for(let dx=-R;dx<R;dx++){
  const i=(y+dy)*w+x+dx;
  if(originalMissing[i]||small[i*3]<155||small[i*3+1]<205){valid=false;break;}
 }
 if(valid)donors.push([x,y]);
}
let remaining=missing.reduce((a,b)=>a+b,0),patches=0;
while(remaining){
 let target,bestKnown=0;
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){
  if(!missing[y*w+x])continue;
  let known=0;
  for(let dy=-R;dy<R;dy+=3)for(let dx=-R;dx<R;dx+=3){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!missing[yy*w+xx])known++;}
  if(known>bestKnown){bestKnown=known;target=[x,y];}
 }
 if(!target){const i=missing.findIndex(Boolean);target=[i%w,Math.floor(i/w)];}
 const [tx,ty]=target,samples=[];
 for(let dy=-R;dy<R;dy+=2)for(let dx=-R;dx<R;dx+=2){const x=tx+dx,y=ty+dy;if(x>=0&&x<w&&y>=0&&y<h&&!missing[y*w+x])samples.push([dx,dy,(y*w+x)*3]);}
 let donor=donors[0],best=Infinity;
 for(const [sx,sy]of donors){
  let error=Math.abs(sy-ty)*samples.length*.6;
  for(const [dx,dy,i]of samples){const j=((sy+dy)*w+sx+dx)*3;for(let c=0;c<3;c++)error+=(small[i+c]-small[j+c])**2;if(error>=best)break;}
  if(error<best){best=error;donor=[sx,sy];}
 }
 const [sx,sy]=donor;
 for(let dy=-R;dy<R;dy++)for(let dx=-R;dx<R;dx++){
  const x=tx+dx,y=ty+dy;if(x<0||x>=w||y<0||y>=h||!missing[y*w+x])continue;
  missing[y*w+x]=0;remaining--;
  for(let c=0;c<3;c++)small[(y*w+x)*3+c]=small[((sy+dy)*w+sx+dx)*3+c];
  for(let py=0;py<S;py++)for(let px=0;px<S;px++)for(let c=0;c<3;c++)sky[((y*S+py)*W+x*S+px)*3+c]=data[(((sy+dy)*S+py)*W+(sx+dx)*S+px)*3+c];
 }
 if(++patches>500)throw Error('Sky completion did not converge');
}
// The shader mirrors the virtual tile. Store/upload each painted pixel once.
await writeFile(new URL('sky-loop-v01.webp',root),await sharp(sky,{raw:{width:W,height:H,channels:3}}).webp({nearLossless:true,quality:90,effort:6}).toBuffer());
// Follow the painted foreground silhouette. Bounding-box exclusions would leave
// stationary rectangular pieces of old sky around the antenna and chimney.
const {data:mask,info:mi}=await sharp(fileURLToPath(new URL('motion-mask-v01.png',root))).removeAlpha().raw().toBuffer({resolveWithObject:true});
const isSky=(x,y)=>{const i=(y*W+x)*info.channels,[r,g,b]=data.subarray(i,i+3);return (g>165&&g>r+3&&b>=r-2)||(r>225&&g>235&&b>225);};
for(let y=0;y<mi.height;y++)for(let x=0;x<mi.width;x++){
 const px=x*2,py=y*2;let alpha=py<505?1:Math.max(0,1-((py-505)/60)**2*(3-2*Math.min(1,(py-505)/60)));
 if(py>=565)alpha=0;
 if(alpha&&((px>1220&&py>=212)||py>505))for(let dy=-1;dy<=1&&alpha;dy++)for(let dx=-1;dx<=1;dx++)if(!isSky(Math.min(W-1,Math.max(0,px+dx)),Math.max(0,py+dy))){alpha=0;break;}
 mask[(y*mi.width+x)*mi.channels]=Math.round(alpha*255);
}
await writeFile(new URL('motion-mask-v02.png',root),await sharp(mask,{raw:{width:mi.width,height:mi.height,channels:mi.channels}}).png().toBuffer());
console.log(JSON.stringify({width:W,height:H,period:W*2,patches,method:'Approved painted patches, completed behind roof; virtual mirrored seamless extension. No generation.'}));
