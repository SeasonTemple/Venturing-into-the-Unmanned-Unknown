// Deterministic concept composites; no generation or network requests.
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url)),sharp=createRequire(resolve(root,'../../site/package.json'))('sharp'),dir=resolve(root,'story-media');
await mkdir(dir,{recursive:true});
const width=1920,height=1080;
const notebookSource=resolve(dir,'notebook-keyframe-v02_001.jpg');
const {data:raw}=await sharp(notebookSource).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const mask=await sharp(Buffer.from(`<svg width="1920" height="1080"><path fill="white" d="M606 434L1210 380L1246 390L1250 539Q1284 540 1305 578L1390 665Q1422 703 1432 758L1450 786Q1710 878 1920 998V1080H0V1070Q180 962 390 892L451 843L498 749L544 657Q553 614 587 599L613 602Z"/></svg>`)).ensureAlpha().raw().toBuffer();
for(let i=0;i<width*height;i++){
 const p=i*4,r=raw[p],g=raw[p+1],b=raw[p+2];
 const background=(g>60&&g>r*1.07&&g>b*1.03)||(b>70&&g>r*1.12&&g>b*.58);
 raw[p+3]=background?0:mask[p+3];
 const x=i%width,y=Math.floor(i/width);
 // Local paper palette correction only; retain pen strokes and skin colors.
 if(x>900&&x<1250&&y>380&&y<978&&r>180&&r-g<36&&g/r>.855&&b<135){
  const shift=Math.max(0,Math.min(1,(r-180)/75));raw[p]=Math.round(210+30*shift);raw[p+1]=Math.round(208+28*shift);raw[p+2]=Math.round(181+28*shift);
 }
}
const foreground=await sharp(raw,{raw:{width,height,channels:4}}).png().toBuffer();
await writeFile(resolve(dir,'notebook-foreground-v01.png'),foreground);
await sharp(resolve(root,'meadow-media/hero-route-v01.webp')).composite([{input:foreground}]).webp({quality:92}).toFile(resolve(dir,'notebook-study-v01.webp'));
// Remove invented extra vehicles and spurious generated logos by local grass patches.
const boundarySource=resolve(dir,'boundary-keyframe-v02_001.jpg');
const patches=[
 {source:{left:550,top:478,width:130,height:60},left:385,top:478},
 {source:{left:1570,top:478,width:120,height:60},left:1450,top:478},
 {source:{left:1190,top:960,width:310,height:120},left:865,top:960},
 {source:{left:1520,top:945,width:190,height:135},left:1730,top:945}
];
const inputs=[];for(const p of patches)inputs.push({input:await sharp(boundarySource).extract(p.source).toBuffer(),left:p.left,top:p.top});
await sharp(boundarySource).composite(inputs).webp({quality:92}).toFile(resolve(dir,'boundary-study-v01.webp'));
for(const name of ['notebook-study-v01','boundary-study-v01']){
 await sharp(resolve(dir,name+'.webp')).resize(960,540).webp({quality:88}).toFile(resolve(dir,name+'-960.webp'));
}
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const generation=[
 ['notebook-keyframe-v01',281001,'rejected: smooth photoreal material, aerial islands and large album instead of ground-level pixel art',true],
 ['boundary-keyframe-v01',281002,'rejected for continuity: foreground portrait scale, large lake and distant tower; pixel treatment useful as research',true],
 ['notebook-keyframe-v02',281004,'foreground selected for material/compositing study only; background not retained',true],
 ['boundary-keyframe-v02',281005,'wide composition candidate; extra vehicles/logos removed locally; still needs art review',false]
];
const records=[];
for(const [name,seed,selection,reference]of generation){
 const prompt=resolve(root,'meadow-prompts',name+'.txt'),source=resolve(dir,name+'_001.jpg');
 records.push({name,model:'image-01',service:'MiniMax through mmx-cli 1.0.28',seed,prompt:'../meadow-prompts/'+name+'.txt',promptSha256:await hash(prompt),subjectReference:reference?'../meadow-media/hero-v04.webp':null,source:name+'_001.jpg',sourceSha256:await hash(source),width,height,selection});
}
await writeFile(resolve(dir,'sources.json'),JSON.stringify({created:'2026-10-28',generationCalls:4,videoCalls:0,status:'Concept studies, not approved production art or animation frames',records,derived:[
 {file:'notebook-foreground-v01.png',processing:'Polygon alpha with local green background rejection; local yellow-paper palette adjustment; no whole-image pixelation or photo filter.'},
 {file:'notebook-study-v01.webp',background:'../meadow-media/hero-route-v01.webp',processing:'Composite extracted generated hands/book over existing character-free scene; this is a fixed concept composite, not a true new viewpoint. Foreground not yet approved.'},
 {file:'boundary-study-v01.webp',processing:'Local grass patches remove two unrequested vehicle shapes and two generated fictitious logo regions. No original signature or third-party art involved; source generated for this task.'}
 ],rebuild:'node prototypes/visual-direction/build-story-keyframes.mjs'},null,2)+'\n');
console.log(JSON.stringify({generationCalls:4,videoCalls:0,derived:['notebook-study-v01.webp','boundary-study-v01.webp'],status:'review required'}));
