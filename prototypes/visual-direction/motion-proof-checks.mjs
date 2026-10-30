import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPEC,gaitPose,turnPose,sampleRun,DURATION} from './motion-proof-geometry.mjs';
const root=dirname(fileURLToPath(import.meta.url)),sharp=createRequire(resolve(root,'../../site/package.json'))('sharp');
const report={scope:'Authoring geometry and baked pixel integrity; does not certify visual approval or browser soak performance',checks:[]};
let maxSlip=0,maxReach=0,maxBoneError=0;
for(const direction of ['left','right'])for(const energy of [0,.5,1])for(let i=0;i<2400;i++){
 const q=i/2400,p=gaitPose(q,direction,energy);
 for(const [name,l] of Object.entries(p.legs)){
  maxReach=Math.max(maxReach,l.reachError);
  maxBoneError=Math.max(maxBoneError,Math.abs(Math.hypot(l.knee[0]-l.hip[0],l.knee[1]-l.hip[1])-SPEC.thigh),Math.abs(Math.hypot(l.knee[0]-l.ankle[0],l.knee[1]-l.ankle[1])-SPEC.shin));
  if(l.stance){
   const phase=q+(name==='left'?.5:0),cycles=Math.floor(phase),offset=name==='right'?1.25:-1.25;
   const worldX=l.ankle[0]+p.sign*q*SPEC.stride,expected=64+offset+p.sign*(15+(cycles-(name==='left'?.5:0))*SPEC.stride);
   maxSlip=Math.max(maxSlip,Math.abs(worldX-expected));assert(Math.abs(l.ankle[1]-178)<1e-8);
  }else assert(l.ankle[1]<178+1e-8);
 }
}
assert(maxSlip<1e-8);assert(maxBoneError<1e-8);assert(maxReach<.001);
report.checks.push({name:'world-stance-contact-and-bone-lengths',status:'passed',samples:14400,maxSlipPixels:maxSlip,maxBoneError,maxReachError:maxReach});
// Match the two-foot turn endpoints exactly to each anatomical gait leg.
for(const [progress,direction]of [[0,'left'],[1,'right']])for(const side of ['left','right']){
 const a=turnPose(progress).legs[side].ankle,b=gaitPose(0,direction,0).legs[side].ankle;assert(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7);
}
for(let i=0;i<500;i++){
 const t=i/500,a=turnPose(t),b=turnPose(t+1/500);const planted=t<.5?'left':'right';
 assert(Math.hypot(a.legs[planted].ankle[0]-b.legs[planted].ankle[0],a.legs[planted].ankle[1]-b.legs[planted].ankle[1])<1e-7);
 for(const leg of Object.values(a.legs))assert(leg.reachError<.001);
}
report.checks.push({name:'turn-plant-and-anatomical-endpoint-continuity',status:'passed',samples:500});
let previous=sampleRun(0),maxDelta=0,states=new Set();
for(let i=1;i<=17500;i++){
 const current=sampleRun(i/1000);maxDelta=Math.max(maxDelta,Math.abs(current.distance-previous.distance));
 assert(current.distance>=-1e-7&&current.distance<=SPEC.travel+1e-7);assert(current.frame>=0&&current.frame<24);
 if(current.turn===null&&previous.turn===null&&Math.abs(current.distance-previous.distance)>1e-7&&current.direction===previous.direction)assert((current.distance-previous.distance)*(current.direction==='left'?1:-1)>=0);
 states.add(current.state);previous=current;
}
assert(maxDelta<.04);assert(sampleRun(DURATION).complete);assert.equal(sampleRun(DURATION).distance,0);
assert.equal(sampleRun(DURATION).direction,'right');assert(states.has('换步转身'));assert(states.has('停步 · 两脚承重'));
report.checks.push({name:'run-distance-continuity-and-return',status:'passed',samples:17500,maxDeltaPerMillisecond:maxDelta,duration:DURATION});
const meta=JSON.parse(await readFile(resolve(root,'motion-proof-media/motion.json'),'utf8'));
const allowedColors=new Set(meta.palette.map(p=>p.join(',')));let opaquePixels=0;
for(const [name,atlas] of Object.entries(meta.atlases)){
 const {data,info}=await sharp(resolve(root,'motion-proof-media',atlas.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,128*6);assert(info.height>=196*Math.ceil(atlas.count/6));
 for(let i=0;i<data.length;i+=4){assert(data[i+3]===0||data[i+3]===255);if(data[i+3]){assert(allowedColors.has([...data.subarray(i,i+3)].join(',')));opaquePixels++;}}
 for(let frame=0;frame<atlas.count;frame++){
  // No limb or equipment touches a frame boundary; alpha margins survive packing.
  const ox=frame%6*128,oy=Math.floor(frame/6)*196;
  for(let x=0;x<128;x++)for(const y of [0,195])assert.equal(data[((oy+y)*info.width+ox+x)*4+3],0,`${name} vertical crop`);
  for(let y=0;y<196;y++)for(const x of [0,127])assert.equal(data[((oy+y)*info.width+ox+x)*4+3],0,`${name} horizontal crop`);
  const joints=atlas.joints[frame];assert.equal(joints.toolHand,'right');assert.equal(joints.recorderHand,'left');
 }
}
report.checks.push({name:'atlas-margins-binary-alpha-shared-palette-and-equipment-labels',status:'passed',opaquePixels,frames:69,paletteColors:meta.palette.length,note:'Equipment ownership labels are checked; source silhouette/visibility requires visual review.'});
// Regressions reported in walk01: a clipped right eye and per-column head
// resampling. Compare actual baked pixels after undoing integer translation.
let stableHeadFrames=0;
for(const direction of ['left','right']){
 const atlas=meta.atlases[direction+'-walk'];
 const {data,info}=await sharp(resolve(root,'motion-proof-media',atlas.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const layer=await sharp(resolve(root,'motion-proof-media/layers',direction,'head.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let baseline;
 for(let frame=0;frame<atlas.count;frame++){
  const origin=atlas.joints[frame].headOrigin;assert(origin.every(Number.isInteger));
  const ox=frame%6*128+origin[0],oy=Math.floor(frame/6)*196+origin[1],pixels=[];
  for(let y=0;y<24;y++)for(let x=0;x<layer.info.width;x++){
   const k=((oy+y)*info.width+ox+x)*4;pixels.push(...data.subarray(k,k+4));
  }
  if(!baseline)baseline=pixels;else assert.deepEqual(pixels,baseline,`${direction} head must remain rigid at frame ${frame}`);
  stableHeadFrames++;
 }
}
const face=await sharp(resolve(root,'motion-proof-media/layers/right/head.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let facePixels=0;for(let y=12;y<24;y++)for(let x=27;x<39;x++)if(face.data[(y*face.info.width+x)*4+3])facePixels++;
assert(facePixels>=20);
report.checks.push({name:'rigid-head-pixels-and-right-face-preservation',status:'passed',stableHeadFrames,rightFacePixelsPreserved:facePixels,headScale:meta.headRaster.scale,note:'Baked head pixels match after integer translation in all walking/idle poses; reduced face silhouette remains visible and requires human visual review.'});
await mkdir(resolve(root,'../../.lab/motion-proof'),{recursive:true});await writeFile(resolve(root,'../../.lab/motion-proof/geometry-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
