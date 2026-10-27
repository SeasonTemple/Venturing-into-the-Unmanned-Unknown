// Offline cutout animation. Every limb uses the approved painting's own pixels.
// No generated walk sheet is used: both candidates failed identity continuity.
import{createRequire}from'node:module';
import{readFile,writeFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';
const sharp=createRequire(new URL('../../site/package.json',import.meta.url))('sharp');
const root=new URL('./meadow-media/',import.meta.url),file=n=>fileURLToPath(new URL(n,root));
const raw=await sharp(file('hero-v04.webp')).extract({left:1210,top:676,width:100,height:195}).ensureAlpha().raw().toBuffer();
const pointIn=(x,y,p)=>{let v=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;};
const parts={
  head:[[39,7],[57,7],[64,15],[64,30],[60,39],[52,45],[39,39],[33,30],[33,17]],
  torso:[[34,38],[56,36],[66,44],[66,70],[62,87],[64,110],[46,115],[27,109],[25,94],[26,64]],
  armL:[[31,45],[39,50],[32,77],[20,80],[20,71],[25,55]],
  foreL:[[21,70],[32,74],[25,96],[20,104],[13,102],[14,90]],
  tool:[[12,87],[24,87],[25,95],[28,97],[28,114],[20,114],[4,108],[4,97]],
  armR:[[62,44],[72,48],[82,60],[88,71],[80,80],[71,75],[62,59]],
  foreR:[[79,67],[88,71],[83,84],[70,92],[58,94],[51,91],[52,85],[65,84],[72,77]],
  recorder:[[55,87],[68,87],[68,105],[55,105]],
  thighL:[[30,99],[49,99],[48,116],[43,133],[42,141],[34,143],[30,131]],
  shinL:[[34,133],[43,134],[43,156],[41,173],[32,174],[31,163],[33,151]],
  bootL:[[33,168],[43,168],[43,180],[23,180],[22,177],[29,173]],
  thighR:[[49,101],[68,103],[67,121],[64,139],[58,144],[51,138],[49,122]],
  shinR:[[56,136],[65,137],[67,155],[66,179],[58,183],[55,178],[56,160]],
  bootR:[[58,174],[67,174],[69,182],[65,185],[53,185],[52,181]]
};
const images={};
for(const[name,poly]of Object.entries(parts)){
  const pixels=Buffer.from(raw);
  for(let y=0;y<195;y++)for(let x=0;x<100;x++){
    const i=(y*100+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    const leg=/thigh|shin|boot/.test(name);
    pixels[i+3]=pointIn(x,y,poly)&&!(!leg&&g>r*1.025&&g>b*1.12&&g>98)?255:0;
    if(name==='torso'&&x>=51&&y>=79&&y<=106){
      const s=(y*100+43+(x%5))*4;
      for(let c=0;c<3;c++)pixels[i+c]=raw[s+c];
    }
  }
  const png=await sharp(pixels,{raw:{width:100,height:195,channels:4}}).png().toBuffer();
  images[name]='data:image/png;base64,'+png.toString('base64');
}
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const transform=(a,b,c,d)=>{
  const theta=angle(c,d)-angle(a,b),scale=Math.hypot(d[0]-c[0],d[1]-c[1])/Math.hypot(b[0]-a[0],b[1]-a[1]);
  const co=Math.cos(theta)*scale,si=Math.sin(theta)*scale;
  return[co,si,-si,co,c[0]-co*a[0]+si*a[1],c[1]-si*a[0]-co*a[1]];
};
const image=(name,m=[1,0,0,1,0,0])=>`<image width="100" height="195" href="${images[name]}" transform="matrix(${m.join(' ')})"/>`;
const bone=(name,a,b,c,d)=>image(name,transform(a,b,c,d));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
// Each step has a planted stance foot and a lifted recovery foot. Stride is
// measured by the route controller in source-image pixels, not wall-clock time.
function pose(phase,kind='walk'){
  const walking=kind==='walk',check=kind==='check';
  const bob=walking?-1.6*(1+Math.cos(phase*2)):0;
  const sway=walking?Math.sin(phase)*1.1:0;
  const torsoAngle=walking?-.045+Math.sin(phase)*.035:0;
  const co=Math.cos(torsoAngle),si=Math.sin(torsoAngle);
  const body=[co,si,-si,co,48+sway-co*48+si*103,103+bob-si*48-co*103];
  const bodyPoint=([x,y])=>[body[0]*x+body[2]*y+body[4],body[1]*x+body[3]*y+body[5]];
  const hipL=[38+sway,105+bob+(walking?Math.sin(phase)*.8:0)],hipR=[58+sway,106+bob-(walking?Math.sin(phase)*.8:0)];
  const shoulderL=bodyPoint([32,49]),shoulderR=bodyPoint([64,49]);
  const leg=(hip,sign)=>{
    const t=(phase/(2*Math.PI)+(sign<0?.5:0))%1;
    const lift=walking&&t>.5?Math.sin((t-.5)*Math.PI*2)*10:0;
    const footX=t<.5?-19+76*t:19*Math.cos((t-.5)*Math.PI*2);
    const ankle=walking?[hip[0]+footX,179-lift]:(sign>0?[37,174]:[62,179]);
    const knee=walking?[(hip[0]+ankle[0])/2-lift*1.1,(hip[1]+ankle[1])/2]:(sign>0?[38,138]:[61,140]);
    return{hip,knee,ankle,offset:walking?footX:0,lift};
  };
  const L=leg(hipL,1),R=leg(hipR,-1);
  // A forward foot (negative x) pairs with the opposite forward hand. The
  // toolbox restrains the left arm's amplitude without changing its phase.
  const swingL=-L.offset*.50,swingR=-R.offset*.64;
  const elbowL=add(shoulderL,[walking?(-5+swingL*.5):-7,26]),wristL=add(shoulderL,[walking?(-8+swingL):-14,49]);
  const elbowR=check?[80,70]:add(shoulderR,[walking?(6+swingR*.5):15,walking?25:20]);
  const wristR=check?[51,66]:walking?add(shoulderR,[2+swingR,47]):[62,88];
  let svg='';
  const legs=(n,p)=>bone('thigh'+n,n==='L'?[38,105]:[58,106],n==='L'?[38,138]:[61,140],p.hip,p.knee)+bone('shin'+n,n==='L'?[38,138]:[61,140],n==='L'?[37,174]:[62,179],p.knee,p.ankle)+image('boot'+n,[1,0,0,1,p.ankle[0]-(n==='L'?37:62),p.ankle[1]-(n==='L'?174:179)]);
  svg+=legs('R',R)+legs('L',L);
  svg+=bone('armL',[32,49],[25,74],shoulderL,elbowL)+bone('foreL',[25,74],[18,97],elbowL,wristL);
  svg+=image('tool',[1,0,0,1,wristL[0]-18,wristL[1]-90]);
  svg+=image('torso',body);
  svg+=bone('armR',[64,49],[79,69],shoulderR,elbowR)+bone('foreR',[79,69],[61,88],elbowR,wristR);
  svg+=image('recorder',[1,0,0,1,wristR[0]-61,wristR[1]-83]);
  const neck=bodyPoint([48,36]),headAngle=walking?torsoAngle*.28+Math.cos(phase)*.012:0;
  const hc=Math.cos(headAngle),hs=Math.sin(headAngle);
  const head=[hc,hs,-hs,hc,neck[0]-hc*48+hs*36,neck[1]-hs*48-hc*36];
  svg+=check?image('head',[.99,.10,-.10,.99,4,-4]):image('head',head);
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="210"><g transform="translate(36 8)">${svg}</g></svg>`,joints:{leftFoot:L.ankle,rightFoot:R.ankle,leftFootOffset:L.offset,rightFootOffset:R.offset,leftHandOffset:swingL,rightHandOffset:swingR,neck,torsoAngle,headAngle,hipL,hipR}};
}
const frames=[],joints=[];
for(let i=0;i<12;i++){const p=pose(i/12*Math.PI*2);joints.push(p.joints);frames.push(await sharp(Buffer.from(p.svg)).png().toBuffer());}
for(const kind of ['idle','check'])frames.push(await sharp(Buffer.from(pose(0,kind).svg)).png().toBuffer());
if(!joints.every(j=>j.leftFootOffset*j.leftHandOffset<=0&&j.rightFootOffset*j.rightHandOffset<=0))throw Error('Walk must use contralateral arms and legs');
await sharp({create:{width:160*frames.length,height:210,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:i*160,top:0}))).png().toFile(file('engineer-actions-v03.png'));
const meta={atlas:'engineer-actions-v03.png',frame:[160,210],anchor:[80,193],height:174,walkFrames:12,idle:12,check:13,stride:76,source:'hero-v04.webp',gait:'Contralateral arm/leg swing, loaded-tool arm restraint, pelvic weight shift, shoulder counter-rotation and stabilized head.',joints,method:'Offline articulated cutout: separate textured upper/lower limbs, head, jacket, boots, toolbox and recorder; 12 complete body frames plus standing and recorder check. Source art pixels retained, joint overlaps repaired. Fixed three-quarter view; no back-facing frames.',rejected:[{file:'walk-sheet-v01.jpg',reason:'Child proportions, missing toolbox, incorrect layout'},{file:'walk-sheet-v02.jpg',reason:'Photographic style, mixed headings, inconsistent toolbox, not a walk cycle'}]};
await writeFile(file('engineer-actions-v03.json'),JSON.stringify(meta,null,2)+'\n');
// Art QA contact sheet is an asset render, not a browser screenshot.
await sharp({create:{width:160*7,height:210*2,channels:3,background:'#cbd5ba'}}).composite(frames.map((input,i)=>({input,left:(i%7)*160,top:Math.floor(i/7)*210}))).png().toFile(file('../../../.lab/meadow-study/rig-contact.png'));
console.log(JSON.stringify({atlas:meta.atlas,gait:meta.gait,frames:frames.length}));
