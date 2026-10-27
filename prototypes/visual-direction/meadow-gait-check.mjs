import{readFile}from'node:fs/promises';
import{createRequire}from'node:module';
import assert from'node:assert/strict';
import{fileURLToPath}from'node:url';
const sharp=createRequire(new URL('../../site/package.json',import.meta.url))('sharp');
const root=new URL('./meadow-media/',import.meta.url),meta=JSON.parse(await readFile(new URL('engineer-actions-v03.json',root)));
const j=meta.joints;
assert(j.every(p=>p.leftHandOffset*p.leftFootOffset<=0&&p.rightHandOffset*p.rightFootOffset<=0),'each arm must oppose its own leg; zero is the passing pose');
assert(j[0].leftFootOffset<0&&j[0].rightHandOffset<0&&j[6].rightFootOffset<0&&j[6].leftHandOffset<0,'opposite hand and foot must lead on alternating contacts');
const range=a=>Math.max(...a)-Math.min(...a);
assert(range(j.map(p=>p.torsoAngle))>.06&&range(j.map(p=>p.hipL[1]))>3&&range(j.map(p=>p.neck[0]))>3&&range(j.map(p=>p.headAngle))>.02,'pelvis, torso and head must participate in the gait');
assert(j.every(p=>Math.max(p.leftFoot[1],p.rightFoot[1])===179),'at least one stance foot must retain its baseline');
const{data,info}=await sharp(fileURLToPath(new URL('engineer-actions-v03.png',root))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const changes={};
for(const[name,[l,t,r,b]]of Object.entries({head:[66,12,102,55],torso:[62,52,102,110],leftArm:[44,55,66,120],rightArm:[104,57,134,121]})){
  let n=0;for(let y=t;y<b;y++)for(let x=l;x<r;x++){const a=(y*info.width+x)*4,z=(y*info.width+x+3*160)*4;if(!data.subarray(a,a+4).equals(data.subarray(z,z+4)))n++;}
  changes[name]=n;assert(n>30,`${name} must change in the actual raster frames`);
}
console.log(JSON.stringify({pass:true,checks:8,pixelChanges:changes,gait:meta.gait}));
