// Offline only: project the exact relief mesh, its surveyed routes and brass pins.
// Production receives SVG coordinates; it never imports Three.js or this script.
import * as T from 'three';
import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js';
import {writeFile} from 'node:fs/promises';
import {createReliefField,reliefView} from '../../prototypes/visual-direction/relief-field.mjs';
import {surveyRoutes} from '../src/scripts/journal/chapter-surveys.mjs';

const noise=new ImprovedNoise(),field=createReliefField((x,y,z)=>noise.noise(x,y,z));
const {width:W,height:H,nx,nz}=reliefView,positions=[],indices=[],heights=[];
for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
 const x=-10+20*i/nx,z=-6+12*j/nz,h=Math.fround(field.height(x,z));
 positions.push(x,h,z);heights.push(h);
}
for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
 const x=-10+20*i/nx,z=-6+12*j/nz;
 if(x>Math.max(field.boundary(z),field.boundary(z+12/nz))+.15)continue;
 const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);
}
const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
const material=new T.MeshBasicMaterial(),terrain=new T.Mesh(geometry,material);terrain.updateMatrixWorld();
const camera=new T.OrthographicCamera(-16,16,9,-9,.1,100);camera.position.fromArray(reliefView.position);camera.lookAt(...reliefView.target);camera.updateMatrixWorld();
const raycaster=new T.Raycaster(),hits=[];
const round=n=>Math.round(n*100)/100;
const project=p=>{const v=p.clone().project(camera);return[round((v.x*.5+.5)*W),round((.5-v.y*.5)*H),v.z];};
const path=(points,close=false)=>points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join('')+(close?'Z':'');
function height(x,z){
 const u=Math.max(0,Math.min(nx-.00001,(x+10)/20*nx)),v=Math.max(0,Math.min(nz-.00001,(z+6)/12*nz));
 const i=Math.floor(u),j=Math.floor(v),a=j*(nx+1)+i,fx=u-i,fz=v-j;
 const ha=heights[a],hb=heights[a+1],hc=heights[a+nx+1],hd=heights[a+nx+2];
 return fx+fz<=1?ha*(1-fx-fz)+hb*fx+hc*fz:hb*(1-fz)+hc*(1-fx)+hd*(fx+fz-1);
}
const surface=(x,z,lift=.025)=>new T.Vector3(x,height(x,z)+lift,z);
function hit([x,y]){
 raycaster.setFromCamera(new T.Vector2(x/W*2-1,1-y/H*2),camera);hits.length=0;
 raycaster.intersectObject(terrain,false,hits);return hits[0];
}
function visible(p){const screen=project(p),h=hit(screen);return !!h&&h.point.distanceTo(p)<.13;}
function station(seed){
 // Keep stations away from the thin base edge and on a visible relief face.
 for(const offset of [[12,-18],[20,-30],[0,-40],[30,-15],[24,-60],[40,-80],[0,0]]){
  const intersection=hit([seed[0]+offset[0],seed[1]+offset[1]]);
  if(intersection&&intersection.point.x<field.boundary(intersection.point.z)-.5)return intersection.point.clone();
 }
 throw Error('Station has no terrain beneath it: '+seed);
}
function clipped(points){let d='',pen=false,count=0;for(const p of points){
 if(visible(p)){const [x,y]=project(p);d+=`${pen?'L':'M'}${x} ${y}`;pen=true;count++;}else pen=false;
 }return {d,visible:count,total:points.length};}
const light=new T.Vector3(Math.sin(-48*Math.PI/180)*15,4.9,Math.cos(-48*Math.PI/180)*15).normalize();
function boxFaces(center,size){
 const g=new T.BoxGeometry(...size),p=g.attributes.position,n=g.attributes.normal,index=g.index,faces=[];
 for(let i=0;i<index.count;i+=6){
  const ids=[0,1,4,2].map(k=>index.getX(i+k));
  const points=ids.map(id=>new T.Vector3().fromBufferAttribute(p,id).add(center));
  const normal=new T.Vector3().fromBufferAttribute(n,ids[0]);
  if(normal.dot(camera.position.clone().sub(center))<=0)continue;
  const ink=new T.Color('#c3ac80').multiplyScalar(.48+.8*Math.max(0,normal.dot(light)));
  faces.push({d:path(points.map(project),true),fill:'#'+ink.getHexString(),depth:project(points[0])[2]});
 }g.dispose();return faces;
}
function marker(p){
 const root=surface(p.x,p.z,.012),tip=root.clone().add(new T.Vector3(0,.31,0));
 const ground=[];
 // Four shallow survey cuts follow the local surface, not a screen-space disc.
 for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){
  ground.push(path([.15,.27].map(r=>project(surface(p.x+x*r,p.z+z*r,.014)))));
 }
 const contact=Array.from({length:20},(_,i)=>{const a=i/20*Math.PI*2;return project(surface(p.x+Math.cos(a)*.095,p.z+Math.sin(a)*.095,.008));});
 const shadowSamples=[];
 for(let i=0;i<=10;i++){
  const origin=root.clone().add(new T.Vector3(0,.02+.29*i/10,0));
  raycaster.set(origin,light.clone().negate());hits.length=0;raycaster.intersectObject(terrain,false,hits);
  if(hits[0])shadowSamples.push(hits[0].point.clone().add(new T.Vector3(0,.012,0)));
 }
 const shadow=clipped(shadowSamples).d;
 const faces=[...boxFaces(root.clone().add(new T.Vector3(0,.14,0)),[.047,.28,.047]),...boxFaces(tip,[.15,.035,.13])].sort((a,b)=>b.depth-a.depth);
 return{point:project(root).slice(0,2),tip:project(tip).slice(0,2),ground:ground.join(''),contact:path(contact,true),shadow,faces:faces.map(({d,fill})=>({d,fill}))};
}
const labelPositions=[[350,730],[790,800],[1260,375]],chapters={};
for(const [slug,seeds] of Object.entries(surveyRoutes)){
 const world=seeds.map(station),curve=new T.CatmullRomCurve3(world.map(p=>new T.Vector3(p.x,0,p.z)),false,'centripetal');
 const sampled=Array.from({length:241},(_,i)=>{const p=curve.getPoint(i/240);return surface(p.x,p.z,.035);});
 const trace=clipped(sampled),last=world.at(-1),edge=field.boundary(last.z-.35)-.25;
 const unresolved=clipped(Array.from({length:40},(_,i)=>{const t=i/39;return surface(T.MathUtils.lerp(last.x,edge,t),last.z-.35*t,.04);}));
 const nodes=world.map((p,i)=>{
  const pin=marker(p),label=labelPositions[i];
  const elbow=i===2?[label[0]-32,label[1]-6]:[pin.tip[0],label[1]-20];
  return{...pin,label,leader:path([pin.tip,elbow,[label[0]-12,label[1]-6]]),world:p.toArray().map(round),visible:visible(p)};
 });
 if(nodes.some(n=>!n.visible))throw Error(slug+' has an occluded station');
 chapters[slug]={trace:trace.d,unresolved:unresolved.d,nodes,visibility:{visible:trace.visible,total:trace.total}};
 console.log(slug,JSON.stringify({nodes:nodes.map(n=>n.point),visible:trace.visible,total:trace.total}));
}
// Mobile gets a true plan view, with contours sampled from the same height field.
const flat=p=>[round(30+(p.x+10)*27),round(24+(p.z+6)*18)];
const contours=[];
for(let level=.35;level<3.9;level+=.38){let d='';
 for(let j=0;j<30;j++)for(let i=0;i<50;i++){
  const x=-10+i*.4,z=-6+j*.4;if(x+.4>field.boundary(z))continue;
  const c=[[x,z],[x+.4,z],[x+.4,z+.4],[x,z+.4]],v=c.map(([a,b])=>field.height(a,b)),cuts=[];
  for(let k=0;k<4;k++){const l=(k+1)%4;if((v[k]<level)===(v[l]<level))continue;const t=(level-v[k])/(v[l]-v[k]);cuts.push(flat({x:c[k][0]+t*(c[l][0]-c[k][0]),z:c[k][1]+t*(c[l][1]-c[k][1])}));}
  for(let k=0;k+1<cuts.length;k+=2)d+=path([cuts[k],cuts[k+1]]);
 }contours.push(d);
}
const frontier=Array.from({length:29},(_,i)=>{const z=-5.7+i*.4,x=field.boundary(z);return path([surface(x,z,.04),surface(x+.18,z+.2,.04)].map(project));});
for(const drawing of Object.values(chapters)){drawing.flatNodes=drawing.nodes.map(n=>flat({x:n.world[0],z:n.world[2]}));drawing.flatTrace=path(drawing.flatNodes);}
const flatBoundary=path(Array.from({length:61},(_,i)=>{const z=-6+i*.2;return flat({x:field.boundary(z),z});}));
const output={source:'relief-field.mjs / relief-base-v01.webp',projection:reliefView,contours,flatBoundary,frontier,mode:'Offline terrain depth and projected solid markers; semantic transects, not geographic measurements',chapters};
await writeFile(new URL('../src/scripts/journal/chapter-projections.json',import.meta.url),JSON.stringify(output)+'\n');
geometry.dispose();material.dispose();
