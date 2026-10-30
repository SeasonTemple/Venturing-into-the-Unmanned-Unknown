// Offline derivatives only. Does not invoke MMX or modify approved source art.
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile,stat,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=dirname(fileURLToPath(import.meta.url)),dir=resolve(root,'art-pack-media');
const sharp=createRequire(resolve(root,'../../site/package.json'))('sharp');
await mkdir(dir,{recursive:true});
// Remove only obsolete derivatives made by this builder in this batch. Keep
// all four raw generations, which remain part of the rejection history.
for(const file of ['boundary-approach.webp','boundary-threshold.webp','art-relay-v01.webp','art-relay-v01-small.webp','art-boundary-v03.webp','art-boundary-v03-small.webp','art-cast-v03.webp','art-cast-v03-small.webp']){
 try{await unlink(resolve(dir,file));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const w=1920,h=1080,source=resolve(root,'meadow-media/hero-v04.webp');
const original=await sharp(source).ensureAlpha().raw().toBuffer();
function inside(x,y,polygon){let found=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])found=!found;}return found;}
const roof=[[1272,524],[1412,450],[1490,339],[1920,340],[1920,545],[1280,545]];
const building=[[1272,520],[1410,446],[1490,340],[1920,340],[1920,1080],[1316,1080],[1316,542],[1272,542]];
const actor=[[1240,686],[1270,684],[1272,711],[1296,732],[1295,753],[1279,767],[1278,855],[1264,861],[1250,822],[1248,858],[1231,856],[1233,772],[1220,774],[1231,724]];
const groundLight=[[1180,832],[1310,826],[1505,966],[930,966]];
const wallLight=[[1319,569],[1400,595],[1452,861],[1320,862]];
const workLight=[[1434,737],[1617,737],[1645,818],[1452,818]];
const clamp=n=>Math.max(0,Math.min(255,Math.round(n)));
// Follow connected sky pixels, rather than cutting the entire scene at a
// horizontal line. The water shares sky hues but is not connected to it.
const skyMask=new Uint8Array(w*h),queue=new Int32Array(w*h);let tail=0;
function addSky(x,y){
 if(x<0||x>=w||y<0||y>=h)return;
 const p=y*w+x,i=p*4;if(skyMask[p]||inside(x,y,building))return;
 const r=original[i],g=original[i+1],b=original[i+2];
 if(!(b>r*.93&&g>r*1.01&&b>g*.82))return;
 skyMask[p]=1;queue[tail++]=p;
}
for(let x=0;x<w;x++)addSky(x,0);
for(let head=0;head<tail;head++){
 const p=queue[head],x=p%w,y=Math.floor(p/w);
 addSky(x-1,y);addSky(x+1,y);addSky(x,y-1);addSky(x,y+1);
}
async function output(name,buffer,dimensions={width:w,height:h,channels:4}){
 await sharp(buffer,{raw:dimensions}).webp({quality:93}).toFile(resolve(dir,name+'.webp'));
 await sharp(buffer,{raw:dimensions}).resize(Math.round(dimensions.width/2)).webp({quality:88}).toFile(resolve(dir,name+'-small.webp'));
}
for(const mode of ['overcast','evening','night']){
 const data=Buffer.from(original);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=original[i],g=original[i+1],b=original[i+2],l=(r*.22+g*.63+b*.15)/255;
  const isRoof=y<570&&x>1250&&inside(x,y,roof),sky=skyMask[y*w+x];
  let rgb;
  if(mode==='night'){
   rgb=sky?[13+l*23,30+l*27,47+l*33]:[r*.2+3,g*.27+6,b*.39+9];
   let light=0;
   if(inside(x,y,wallLight))light=Math.max(light,Math.max(0,1-Math.hypot((x-1320)/145,(y-635)/300))*.85);
   if(inside(x,y,groundLight))light=Math.max(light,Math.max(0,1-Math.hypot((x-1250)/350,(y-865)/160))*.9);
   if(inside(x,y,workLight))light=Math.max(light,Math.max(0,1-Math.hypot((x-1530)/150,(y-756)/90))*.8);
   if(inside(x,y,actor))light=Math.max(light,Math.max(0,1-(y-640)/310)*.7);
   light=Math.round(light*7)/7;
   if(light)rgb=rgb.map((c,k)=>c*(1-light*.6)+[r*.92+35,g*.75+26,b*.43+8][k]*light*.85);
  }else if(mode==='evening'){
   const edge=Math.round(Math.max(0,1-y/620)*5)/5;
   rgb=sky?[r*.57+70-edge*18,g*.55+55-edge*15,b*.68+38+edge*12]:[r*.82+g*.09+10,g*.7+12,b*.7+5];
   if(isRoof)rgb=[r*.96+12,g*.73+9,b*.56+2];
   if(x<1330&&y>820&&inside(x,y,groundLight))rgb=rgb.map((c,k)=>c+[12,5,0][k]);
  }else{
   rgb=sky?[r*.52+43,g*.53+56,b*.58+65]:[r*.61+13,g*.66+13,b*.74+15];
   if(isRoof)rgb=[r*.54+15,g*.59+17,b*.69+18];
  }
  for(let k=0;k<3;k++)data[i+k]=clamp(rgb[k]);
 }
 const pieces=[];
 if(mode!=='overcast'){
  // Pixel-painted actual light fixtures and wet-surface reflections. No bloom.
  const lamp=mode==='night'?'#ffe8a2':'#ecd09b';
  pieces.push({input:Buffer.from(`<svg width="1920" height="1080" shape-rendering="crispEdges"><path fill="#243c38" d="M1558 756h24v6h-24zm8-6h8v-40h-8zm-18-47h45v8h-45zm4-8h33v8h-33z"/><path fill="${lamp}" d="M1554 711h30v5h-30zM1254 610h26v18h-26z"/><path fill="#e9c282" d="M1175 909h40v3h-40zm53 8h56v3h-56zm45-23h25v3h-25zm-48 40h27v2h-27z"/><path fill="#bac983" d="M1696 798h13v7h-13z"/></svg>`)});
 }else{
  let rain='';for(let i=0;i<64;i++){const x=(i*173+59)%1920,y=(i*97+133)%1080;if(x>1320&&y>560)continue;rain+=`M${x} ${y}l-5 12`;}
  pieces.push({input:Buffer.from(`<svg width="1920" height="1080" shape-rendering="crispEdges"><path d="${rain}" stroke="#b9d2cd" opacity=".36" stroke-width="2"/><path fill="#c5d4c6" opacity=".5" d="M705 1026h35v2h-35zm66 9h48v2h-48zm-4 16h21v2h-21z"/></svg>`)});
 }
 const composite=await sharp(data,{raw:{width:w,height:h,channels:4}}).composite(pieces).ensureAlpha().raw().toBuffer();
 await output('station-'+mode,composite);
}
const lightingCells=[];
for(const [index,file]of ['../meadow-media/hero-v04.webp','station-overcast.webp','station-evening.webp','station-night.webp'].entries()){
 const input=await sharp(resolve(dir,file)).resize(960,540).webp({quality:94}).toBuffer();
 lightingCells.push({input,left:(index%2)*960,top:Math.floor(index/2)*540});
}
await sharp({create:{width:1920,height:1080,channels:3,background:'#182c26'}}).composite(lightingCells).webp({quality:93}).toFile(resolve(dir,'environment-comparison.webp'));

// Repaint BOTH paper leaves of the previous pixel foreground. Reuse actual
// pixel-drawn hands; never pixelate the rejected photographic generation.
const old=resolve(root,'story-media/notebook-foreground-v01.png'),book=await sharp(old).ensureAlpha().raw().toBuffer();
const left=[[643,454],[893,430],[916,923],[662,950]],right=[[958,422],[1215,408],[1216,915],[954,919]];
const rightThumb=[[1148,574],[1171,577],[1200,599],[1250,619],[1280,640],[1280,850],[1234,850],[1217,790],[1214,751],[1249,740],[1217,729],[1188,726],[1167,712],[1143,693],[1121,670],[1107,642],[1105,609],[1113,590],[1129,580]];
const leftThumb=[[598,598],[635,593],[670,631],[668,679],[645,702],[610,680]];
for(let y=390;y<965;y++)for(let x=620;x<1235;x++){
 const side=inside(x,y,left)?'left':inside(x,y,right)?'right':null;if(!side)continue;
 const i=(y*w+x)*4;
 // Preserve thumbs and their contact shadows over the paper.
 if(inside(x,y,leftThumb)||inside(x,y,rightThumb))continue;
 const crease=side==='left'?Math.max(0,(x-858)/64):Math.max(0,(997-x)/48);
 const shade=Math.min(4,Math.round(crease*4)),base=[226,226,205];
 for(let k=0;k<3;k++)book[i+k]=base[k]-shade*[10,10,9][k];book[i+3]=255;
}
for(let i=0;i<w*h;i++){
 const p=i*4,r=book[p],g=book[p+1],b=book[p+2];
 if(r>g*1.55&&g<150&&r>95){book[p]=clamp(r*.78+g*.13);book[p+1]=clamp(g*.91+12);book[p+2]=clamp(b*.88+8);}
}
const foreground=await sharp(book,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
await writeFile(resolve(dir,'notebook-pixel-foreground.png'),foreground);
const notebookComposite=await sharp(resolve(root,'meadow-media/hero-route-v01.webp')).composite([{input:foreground}]).png().toBuffer();
const notebook=await sharp(notebookComposite).extract({left:440,top:345,width:1060,height:720}).ensureAlpha().raw().toBuffer();
await output('notebook-readable',notebook,{width:1060,height:720,channels:4});
const workbench=await sharp(source).extract({left:1280,top:540,width:640,height:420}).resize(1280,840,{kernel:'nearest'}).toBuffer();
await sharp(workbench).webp({quality:93}).toFile(resolve(dir,'station-workbench.webp'));

// Decode from frame zero with exact indices. Previous seek-based stills and
// contact-sheet timestamps did not reliably describe the displayed direction.
const execFileAsync=promisify(execFile),videoSource=resolve(root,'meadow-media/directional-v02.mp4');
const orientations=[
 {out:'actor-front',input:'directional-input-v02.png',view:'original standing identity reference'},
 {out:'actor-side',frame:96,view:'left-facing side profile'},
 {out:'actor-back-side',frame:48,view:'left-facing rear three-quarter'},
 {out:'actor-back',frame:84,view:'rear view'}
];
for(const pose of orientations){
 const {out,input,frame}=pose;
 const sourceImage=input?await readFile(resolve(root,'meadow-media',input)):(await execFileAsync('ffmpeg',['-hide_banner','-loglevel','error','-i',videoSource,'-vf',`select=eq(n\\,${frame})`,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{encoding:'buffer',windowsHide:true,maxBuffer:8*1024*1024})).stdout;
 if(frame===96)await writeFile(resolve(dir,'walk-left-input-v03.png'),sourceImage);
 const img=sharp(sourceImage),meta=await img.metadata(),pixels=await img.ensureAlpha().raw().toBuffer();
 let minX=meta.width,minY=meta.height,maxX=0,maxY=0;
 for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){
  const p=(y*meta.width+x)*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];
  if(g>r*1.5&&g>b*1.5&&g>80){pixels[p+3]=0;continue;}
  if(pixels[p+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 await sharp(pixels,{raw:{width:meta.width,height:meta.height,channels:4}}).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).resize({height:348,kernel:'nearest'}).png().toFile(resolve(dir,out+'.png'));
}
const poseCells=[];
for(const [index,pose]of orientations.entries()){
 const file=resolve(dir,pose.out+'.png'),meta=await sharp(file).metadata();
 poseCells.push({input:await readFile(file),left:index*320+Math.floor((320-meta.width)/2),top:36});
 const label=pose.frame===undefined?'Original standing pose':`Frame ${pose.frame} / ${(pose.frame/24).toFixed(2)}s`;
 const captions=['Original identity','Left side','Left rear','Rear'];
 poseCells.push({input:Buffer.from(`<svg width="320" height="48"><text x="16" y="18" fill="#edf0df" font-size="14">${captions[index]}</text><text x="16" y="39" fill="#b9c9b4" font-size="12">${label}</text></svg>`),left:index*320,top:394});
}
await sharp({create:{width:1280,height:448,channels:4,background:'#21382e'}}).composite(poseCells).webp({quality:96}).toFile(resolve(dir,'orientation-audit.webp'));
const roverPolygon=[[935,805],[944,805],[945,828],[970,833],[971,848],[947,848],[947,898],[968,911],[975,942],[987,957],[987,991],[978,1009],[954,1015],[934,1007],[926,994],[871,995],[853,1013],[828,1013],[812,995],[810,969],[824,952],[832,930],[831,903],[934,896]];
const rover=Buffer.from(original);
for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!inside(x,y,roverPolygon))rover[(y*w+x)*4+3]=0;
const roverPng=await sharp(rover,{raw:{width:w,height:h,channels:4}}).extract({left:798,top:800,width:200,height:220}).png().toBuffer();
await writeFile(resolve(dir,'rover-approved.png'),roverPng);
// R1 spatial study: authored pixel hardware placed in the same original world.
// Geometry/palette editing is explicit; this is not a new completed viewpoint.
const device=Buffer.from(`<svg width="1920" height="1080" shape-rendering="crispEdges">
 <path fill="#42554b" d="M427 801h78v11h-78l-6-4z"/><path fill="#293d37" d="M432 804h8v25h-8zm59-2h8v25h-8z"/>
 <path fill="#6e7b63" d="M429 683l65-5 20 14-65 6z"/><path fill="#3e554a" d="M449 697l65-5v108l-65 8z"/><path fill="#71806c" d="M429 683l20 14v111l-20-8z"/>
 <path fill="#263e36" d="M454 704l53-5v56l-53 6z"/><path fill="#405950" d="M458 708l45-4v46l-45 5z"/>
 <path fill="#142f2a" d="M461 713l39-3v27l-39 5z"/><path fill="#83a88c" d="M465 718l30-2v2l-30 2zm0 8 19-2v2l-19 2z"/>
 <path fill="#9ea88a" d="M459 748l6-1v4l-6 1zm12-2 6-1v4l-6 1zm12-1 6-1v4l-6 1z"/>
 <path fill="#6f8068" d="M454 766l53-5v34l-53 6z"/><path fill="#3b5548" d="M459 773l43-4v20l-43 5z"/>
 <path fill="#233b33" d="M488 752h10v12h-10z"/><path fill="#a9b19a" d="M491 755h4v6h-4z"/>
 <path fill="#a3ad8d" d="M429 684l-22-32 73-6 34 43-20-11z"/><path fill="#364b40" d="M414 655l62-5 24 29-65 5z"/><path fill="#c0c4a0" d="M407 652l73-6v4l-69 6z"/>
 <path fill="#293f36" d="M501 681h5v-45h-5z"/><path fill="#bcc7ad" d="M501 632h5v6h-5z"/>
 <path d="M494 759v22l16 12h37v-25" fill="none" stroke="#24382f" stroke-width="3"/><path fill="#20392f" d="M506 790h3v8h-3zM433 694h2v3h-2zM499 781h2v3h-2z"/>
 </svg>`);
const localPlate=await sharp(resolve(root,'meadow-media/hero-route-v01.webp')).composite([{input:device}]).png().toBuffer();
const smallRover=await sharp(roverPng).resize(120,132,{kernel:'nearest'}).toBuffer();
const relayComposite=await sharp(localPlate).composite([{input:smallRover,left:533,top:690}]).png().toBuffer();
// This close view stops before the original parked vehicle in the foreground;
// the vehicle by the port is the same identity placed for this blocking study.
await sharp(relayComposite).extract({left:210,top:590,width:650,height:240}).resize(1300,480,{kernel:'nearest'}).webp({quality:94}).toFile(resolve(dir,'relay-continuity-study.webp'));
await sharp(relayComposite).extract({left:410,top:640,width:140,height:200}).resize(560,800,{kernel:'nearest'}).webp({quality:94}).toFile(resolve(dir,'relay-device-detail.webp'));

// Existing pixel boundary candidate, locally corrected toward the approved
// green palette. The approach/threshold composites were rejected: their pasted
// foreground did not establish a credible new viewpoint. Do not rebuild them.
const boundary=await sharp(resolve(root,'story-media/boundary-study-v01.webp')).ensureAlpha().raw().toBuffer();
for(let y=415;y<h;y++)for(let x=0;x<w;x++){
 const p=(y*w+x)*4,r=boundary[p],g=boundary[p+1],b=boundary[p+2];
 if(g>120&&r>125&&b<150&&g>=r*.88){boundary[p]=clamp(r*.72);boundary[p+1]=clamp(g*.85);boundary[p+2]=clamp(b*.9+23);}
}
await output('boundary-palette-study',boundary);

// Provenance covers the rejected attempts as well as the useful derivatives.
// This records existing local outputs; rebuilding never submits a generation.
const sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const rejected=[
 ['art-notebook-v03',281101,'hero-v04.webp','Photographic hands and book; rejected for pixel style.'],
 ['art-relay-v01',281102,'hero-v04.webp','Heavy rover, smooth rendering and invented towers; rejected for identity and spatial continuity.'],
 ['art-boundary-v03',281103,'hero-v04.webp','Smooth 3D style and wrong path/device scale; rejected.'],
 ['art-cast-v03',281104,'directional-input-v02.png','Costume/equipment drift, wrong pose count and smooth style; rejected as character/animation source.']
];
const records=[];
for(const [name,seed,reference,selection]of rejected){
 const prompt='../meadow-prompts/'+name+'.txt',subjectReference='../meadow-media/'+reference,file=name+'_001.jpg';
 records.push({name,model:'image-01',service:'MiniMax through mmx-cli',seed,prompt,promptSha256:await sha(resolve(dir,prompt)),subjectReference,referenceSha256:await sha(resolve(dir,subjectReference)),source:file,sourceSha256:await sha(resolve(dir,file)),width:1920,height:1080,selection,productionUse:false});
}
const derived=[];
async function derivedRecord(file,sources,processing,status='review study; not approved final art'){
 const full=resolve(dir,file),meta=await sharp(full).metadata();
 derived.push({file,sha256:await sha(full),bytes:(await stat(full)).size,width:meta.width,height:meta.height,sources,processing,status});
}
for(const mode of ['overcast','evening','night'])for(const suffix of ['','-small'])await derivedRecord('station-'+mode+suffix+'.webp',['../meadow-media/hero-v04.webp'],'Connected sky mask, separate roof/ground palette, localized night light masks and pixel light fixtures; no new weather geometry or dynamic shadows.');
await derivedRecord('environment-comparison.webp',['../meadow-media/hero-v04.webp','station-overcast.webp','station-evening.webp','station-night.webp'],'Same-coordinate 2x2 contact sheet; reading order day, overcast, evening, night.');
await derivedRecord('notebook-pixel-foreground.png',['../story-media/notebook-foreground-v01.png'],'Repainted paper leaves; original hand positions preserved by contour masks; muted cuffs. No photographic source used.');
for(const suffix of ['','-small'])await derivedRecord('notebook-readable'+suffix+'.webp',['notebook-pixel-foreground.png','../meadow-media/hero-route-v01.webp'],'Foreground composite, cropped x440 y345 w1060 h720. Real text is rendered by art-pack.mjs, not baked into image.');
await derivedRecord('station-workbench.webp',['../meadow-media/hero-v04.webp'],'Original x1280 y540 w640 h420 crop, 2x nearest-neighbor. Crop reference, not a new viewpoint.');
for(const pose of orientations)await derivedRecord(pose.out+'.png',['../meadow-media/'+(pose.input||'directional-v02.mp4')],`${pose.input?'Original still':`Decode original video from frame zero; select exact frame ${pose.frame} at ${pose.frame/24}s / 24fps`}. Green-key removal, trim, 348px height. ${pose.view}. Reference only; not an approved gait or new stance.`, 'existing pose reference / direction label corrected');
await derivedRecord('orientation-audit.webp',orientations.map(pose=>pose.out+'.png'),'Four reference views on a common foot baseline, no mirroring or generated in-between frames. Labels use decoded frame numbers.');
await derivedRecord('walk-left-input-v03.png',['../meadow-media/directional-v02.mp4'],'Exact decoded frame 96 / 4.00s at 24fps, original green background and 768px canvas retained. Correct left-facing reference for a future walk test; not a newly generated or approved gait.');
await derivedRecord('rover-approved.png',['../meadow-media/hero-v04.webp'],'Polygon alpha cutout at original coordinates; original mast and wheel silhouette.','existing identity reference');
for(const file of ['relay-continuity-study.webp','relay-device-detail.webp'])await derivedRecord(file,['../meadow-media/hero-route-v01.webp','rover-approved.png'],'Authored pixel cabinet, hood, port and cable at original scene coordinates. Vehicle moved near cabinet for blocking; crop excludes original parked foreground vehicle.');
for(const suffix of ['','-small'])await derivedRecord('boundary-palette-study'+suffix+'.webp',['../story-media/boundary-study-v01.webp'],'Local yellow grass shifted toward approved green palette. Near-slope collage rejected, not displayed.');
await writeFile(resolve(dir,'sources.json'),JSON.stringify({created:'2026-10-28',stage:'key art / first review; art gate not passed',imageGenerationCalls:4,videoCreationAttempts:1,videoTasksCreated:0,records,videoAttempt:{model:'MiniMax-Hailuo-2.3',input:'../meadow-media/directional-left-v02.png',inputSha256:await sha(resolve(root,'meadow-media/directional-left-v02.png')),prompt:'../meadow-prompts/art-walk-proof-v01.txt',promptSha256:await sha(resolve(root,'meadow-prompts/art-walk-proof-v01.txt')),result:'Token Plan quota limit; creation failed; no task ID or video; no retry. Later exact-frame audit found this legacy input is a rear view, not the intended side view; do not reuse it for a side-walk request.',taskId:null},orientationAudit:{source:'../meadow-media/directional-v02.mp4',sourceSha256:await sha(videoSource),sourceFps:24,poses:orientations.map(pose=>({file:pose.out+'.png',view:pose.view,frame:pose.frame??null,seconds:pose.frame===undefined?null:pose.frame/24})),walkingApproved:false,newGenerationCalls:0},derived,rebuild:'node prototypes/visual-direction/build-art-pack.mjs (requires local ffmpeg and sharp)',builderSha256:await sha(fileURLToPath(import.meta.url))},null,2)+'\n');
console.log('Built readable notebook foreground, 3 lighting studies, source identities and R1 blocking. No API calls.');
