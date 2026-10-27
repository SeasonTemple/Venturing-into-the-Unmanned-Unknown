import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js';
import {createActors} from './rift-actors.mjs';

export const shots=[
 {id:'threshold',label:'门外',title:'工程只占世界的一小段。',copy:'沿切壁看向前方。近处的前哨有明确体量，通路在转角后消失；对岸仍然没有被我们安排好。',eye:[63,29,58],aim:[14,3,-48],phone:[51,26,51],fov:49,chapter:'ch0'},
 {id:'shelter',label:'进入',title:'从檐下，认出外面的尺度。',copy:'先靠近人的尺度。石壁、顶棚和工作面围住一小块可使用的地方，裂隙通过侧面的开口出现。',eye:[11,3.5,25],aim:[-2,2,7],phone:[14,4.5,30],fov:55,chapter:'ch1'},
 {id:'passage',label:'沿壁',title:'转过这一面墙，才看见下一处。',copy:'跟随人物沿壁前行。栏杆和层理掠过近处，脚下有检修道，下面有沟槽与支撑。',eye:[16,5,-14],aim:[5,2,-43],phone:[18,6,-9],fov:56,chapter:'ch2'},
 {id:'work',label:'工作现场',title:'证据，需要有具体的来处。',copy:'检查面位于侧壁后。这里比较人的顺序操作与 Agent 的分布工作；看见产物不等于已经通过门禁。',eye:[16,6,-65],aim:[-1,3,-79],phone:[18,7,-61],fov:54,chapter:'ch3'},
 {id:'edge',label:'直面未知',title:'路走到了这里，世界还没有结束。',copy:'人物停在近处，视线越过肩膀投向裂隙。对岸有轮廓，却没有被补成一座等待参观的完整城市。',eye:[21,8.7,-116],aim:[49,11,-240],phone:[21,9,-113],fov:55,chapter:'ch7'},
 {id:'return',label:'回望',title:'回头看，只有一段路被接通。',copy:'已使用的前哨、光和通路留在身后。它们帮助我们继续工作，却没有替我们消除前方的判断。',eye:[29,12,-124],aim:[-1,2,-24],phone:[33,14,-129],fov:49,chapter:'ch6'},
];
const V=a=>new T.Vector3(...a),ease=t=>t*t*(3-2*t);
export function createRift(host,{still=false,onUpdate}={}){
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});host.append(renderer.domElement);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color('#aab6b1');scene.fog=new T.Fog('#aab6b1',115,460);
 const camera=new T.PerspectiveCamera(47,1,.15,1800),geometries=new Set(),materials=new Set(),textures=new Set();
 const noise=new ImprovedNoise(),N=(x,y)=>noise.noise(x,y,7.1);
 const own=g=>(geometries.add(g),g),mat=o=>{const m=new T.MeshStandardMaterial(o);materials.add(m);return m;};
 const grainData=new Uint8Array(128*128*4);let seed=91;
 for(let i=0;i<grainData.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=seed/4294967296;grainData[i]=grainData[i+1]=grainData[i+2]=100+n*100;grainData[i+3]=255;}
 const grain=new T.DataTexture(grainData,128,128);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);grain.magFilter=T.LinearFilter;grain.minFilter=T.LinearMipmapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;textures.add(grain);
 const rock=mat({color:'#a3a291',roughness:.95,flatShading:true,bumpMap:grain,bumpScale:.035,vertexColors:true});
 rock.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vStone;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStone=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader='varying vec3 vStone;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float layer=sin(vStone.y*.7+sin(vStone.z*.04)*1.2+sin(vStone.x*.09)*.7);
    float seam=smoothstep(.93,.99,sin(vStone.y*1.3+sin(vStone.z*.12)*.3));
    diffuseColor.rgb*=.95+layer*.045-seam*.075;`);
 };
 const concrete=mat({color:'#b0b6a3',roughness:.83,bumpMap:grain,bumpScale:.045});
 const steel=mat({color:'#344d51',roughness:.57,metalness:.48});
 const brass=mat({color:'#bd9860',roughness:.5,metalness:.55});
 const porcelain=mat({color:'#d1c9a7',roughness:.7});
 const warm=mat({color:'#f2c485',emissive:'#e8a44e',emissiveIntensity:.6,roughness:.5});
 const blue=mat({color:'#91c3c7',emissive:'#51868c',emissiveIntensity:.17,metalness:.2,roughness:.4});
 function mesh(g,m,name){const o=new T.Mesh(own(g),m);o.castShadow=o.receiveShadow=true;o.name=name||'';scene.add(o);return o;}
 const batches=new Map();
 function add(g,m,p=[0,0,0],q=new T.Quaternion()){
  if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
  g.applyMatrix4(new T.Matrix4().compose(V(p),q,V([1,1,1])));if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);
 }
 function box(w,h,d,p,m=concrete){add(new T.BoxGeometry(w,h,d),m,p);}
 function rod(a,b,r=.05,m=steel){const start=V(a),end=V(b),dir=end.clone().sub(start);add(new T.CylinderGeometry(r,r,dir.length(),7),m,start.add(end).multiplyScalar(.5).toArray(),new T.Quaternion().setFromUnitVectors(V([0,1,0]),dir.normalize()));}
 function line(a,b,w=4){const av=V(a),bv=V(b),dir=bv.clone().sub(av);add(new T.BoxGeometry(w,.25,dir.length()+.1),concrete,av.add(bv).multiplyScalar(.5).add(V([0,-.13,0])).toArray(),new T.Quaternion().setFromUnitVectors(V([0,0,1]),dir.normalize()));
  const side=V([dir.z,0,-dir.x]).normalize().multiplyScalar(w*.47),steps=Math.ceil(dir.length()/3);
  for(const sign of [-1,1]){const aa=V(a).addScaledVector(side,sign),bb=V(b).addScaledVector(side,sign);rod(aa.clone().add(V([0,1,0])).toArray(),bb.clone().add(V([0,1,0])).toArray(),.035,brass);for(let i=0;i<=steps;i++){const p=aa.clone().lerp(bb,i/steps);rod(p.toArray(),p.clone().add(V([0,1,0])).toArray(),.035);}}
 }
 function cliff({z0,z1,x,y,side=1,depth=80}){
  const positions=[],colors=[],uv=[],rows=44,cols=Math.ceil((z1-z0)/2.6);
  function vertex(i,j){const z=z0+(z1-z0)*i/cols,t=j/rows;const top=y+Math.sin(z*.035)*7+N(z*.07,11)*4-8*Math.exp(-Math.pow((z+110)/8,2));
   const vertical=-38+(top+38)*t;
   const joint=Math.pow(Math.max(0,Math.sin(z*.24+N(z*.02,3))),12)*2.6;
   const xx=x+Math.sin(z*.037)*4+N(z*.14,vertical*.08)*1.2+N(z*.48,vertical*.37)*.3-side*(joint+Math.floor(vertical/3.2)*.12+(t>.65?(t-.65)*15:0));
   return[xx,-38+(top+38)*t,z];}
  function tri(a,b,c){for(const p of [a,b,c]){positions.push(...p);uv.push(p[2]*.1,p[1]*.1);const shade=.83+N(p[2]*.075,p[1]*.09)*.15;colors.push(shade,shade,shade*.98);}}
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i+1,j+1),d=vertex(i,j+1);if(side===1){tri(a,d,b);tri(b,d,c);}else{tri(a,b,d);tri(b,c,d);}}
  for(let i=0;i<cols;i++){const a=vertex(i,rows),b=vertex(i+1,rows),c=[b[0]-side*depth,b[1]-2,b[2]],d=[a[0]-side*depth,a[1]-2,a[2]];if(side===1){tri(a,d,b);tri(b,d,c);}else{tri(a,b,d);tri(b,c,d);}}
  // Close both cut ends so the wall reads as solid rock, including the near bank.
  for(const i of [0,cols])for(let j=0;j<rows;j++){const a=vertex(i,j),b=vertex(i,j+1),c=[b[0]-side*depth,b[1]-2,b[2]],d=[a[0]-side*depth,a[1]-2,a[2]];if((i===0)===(side===1)){tri(a,b,d);tri(b,c,d);}else{tri(a,d,b);tri(b,d,c);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return mesh(geo,rock,'layered-cut');
 }
 cliff({z0:-152,z1:65,x:-14,y:24});
 cliff({z0:-300,z1:-72,x:89,y:40,side:-1,depth:110});
 cliff({z0:-425,z1:-260,x:154,y:69,side:-1,depth:160});
 // An entrance carved against the wall, with a folded canopy rather than a display plinth.
 box(29,.8,29,[1,-.45,17]);box(1.1,7,28,[-11,3.5,17]);
 const roof=new T.BufferGeometry().setFromPoints([V([-12,8,2]),V([10,5.8,2]),V([15,7.4,2]),V([-12,8,32]),V([10,5.8,32]),V([15,7.4,32])]);
 roof.setIndex([0,3,1,1,3,4,1,4,2,2,4,5]);roof.computeVertexNormals();roof.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1,1,1,0,0],2));const roofMat=mat({color:'#bec1ab',roughness:.82,side:T.DoubleSide});mesh(roof,roofMat,'folded-canopy');
 for(const z of [3,12,22,31]){rod([-11,7.7,z],[10,5.6,z],.15);rod([10,5.6,z],[15,7.2,z],.15);rod([10,0,z],[10,5.6,z],.1);}
 box(9,.18,2.3,[-3,1.05,12],porcelain);for(const x of [-6,0])box(.15,1,2,[x,.5,12],steel);
 for(let i=0;i<4;i++)box(1.5,.025,1.5,[-6+i*2,.0+1.16,12],brass);
 for(let i=0;i<9;i++){box(.06,5,1.35,[-10.4,3.1,5+i*2.7],steel);box(.08,.16,1.6,[-10.3,3.1,5+i*2.7],warm);}
 // Physical path follows one wall and then projects into the opening.
 const route=[[6,0,3],[5,0,-12],[2,-1,-29],[3,-1,-42],[5,1,-58],[5,1,-78],[5,2,-97],[9,5,-113],[25,6,-121]];
 for(let i=1;i<route.length;i++)line(route[i-1],route[i],4);
 for(let z=0;z>-122;z-=9){const h=z<-97?4:z<-50?1:0;rod([5,h-.3,z],[-13,h-8,z],.18);rod([-12,h-8,z],[-12,h,z],.12);rod([-9,h+.25,z],[3,h+.25,z],.045,brass);}
 for(let z=4;z>-110;z-=6){box(.08,.08,2,[-8,-.25,z],steel);box(.18,.3,.18,[6,z<-50?1.6:.6,z],warm);}
 // Lower service track and drainage sit in the actual cut, rather than on an empty plane.
 box(9,.35,147,[-4,-19,-39],steel);for(let z=28;z>-115;z-=8)box(8,.045,.1,[-4,-18.79,z],brass);
 box(1.2,.15,150,[-10,-18.7,-42],steel);box(.25,12,.25,[-9,-13,-42],brass);
 // The middle work chamber is hidden behind a wall when approaching.
 box(20,.7,23,[-1,.6,-78]);box(.7,8,22,[-10.7,4.8,-78]);box(17,7,.65,[-2.5,4.5,-88.8]);box(7,7,.7,[5,4.5,-66.8]);
 for(let z=-68;z>-89;z-=4){box(15,.2,.3,[-3,8,z],steel);}
 box(6,.2,6,[.5,1.15,-79],porcelain);box(.18,7,.18,[-2,4.8,-86.9],warm);
 for(let i=0;i<3;i++){box(2.4,1.2,3,[-6+i*5,1.8,-81],steel);box(2.25,.07,2.8,[-6+i*5,2.45,-81],i===2?brass:blue);}
 for(let i=0;i<7;i++){rod([-9.8,2+i*.7,-86],[-9.8,2+i*.7,-70],.035,brass);}
 // Observation platform is small against the other side. Its walking surface really ends.
 box(11,.48,13,[25,5.73,-122]);for(const z of [-117,-127])rod([29,5.5,z],[-10,-9,z],.23);
 for(const z of [-116,-128]){rod([20,7,z],[30,7,z],.04,brass);for(const x of [20,25,30])rod([x,6,z],[x,7,z],.04);}
 box(.12,2,.12,[28,7,-122],brass);box(.7,.12,.6,[28,8,-122],porcelain);
 // No construction markers float unsupported beyond the platform.
 for(const [m,parts]of batches){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());mesh(geometry,m,'occupied-infrastructure');}
 batches.clear();
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{horizon:{value:new T.Color('#aab6b1')},zenith:{value:new T.Color('#29454e')}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform vec3 horizon,zenith;void main(){float t=smoothstep(-.05,.7,normalize(vP).y);gl_FragColor=vec4(mix(horizon,zenith,t),1.);#include <colorspace_fragment>}'.replace('#include','\n#include')});materials.add(skyMat);const sky=new T.Mesh(own(new T.SphereGeometry(1100,24,16)),skyMat);sky.castShadow=sky.receiveShadow=false;scene.add(sky);
 scene.add(new T.HemisphereLight('#d5e3df','#263b42',.9));
 const sun=new T.DirectionalLight('#ffe5b6',3.2);sun.position.set(-48,85,42);sun.target.position.set(0,0,-45);sun.castShadow=true;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:100,top:105,bottom:-90,near:1,far:320});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.1;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
 const lamp=new T.SpotLight('#ffcc81',1500,28,.55,.6,2);lamp.position.set(3,7,-86);lamp.target.position.set(-1,1,-78);lamp.castShadow=true;lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;lamp.shadow.mapSize.set(1024,1024);scene.add(lamp,lamp.target);
 const actors=createActors(scene,{own,mat,textures});actors.root.visible=true;actors.place(V([1,0,18]));
 let selected=0,mode='agent',width=1,height=1,frames=0,raf=0,job=null,disposed=false,visible=true,paused=false,hidden=document.hidden;
 const eye=V(shots[0].eye),aim=V(shots[0].aim),abort=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),{signal}=abort;
 const personPlaces=[[1,0,18],[1,0,18],[3,-1,-33],[2,1,-76],[25,6,-122],[25,6,-122]];
 function place(index){actors.place(V(personPlaces[index]));actors.person.rotation.y=index>=4?Math.atan2(24,-118):Math.PI;actors.root.visible=index!==0;actors.setMode(mode);if(index!==3)actors.setMode('human');}
 function frameState(){return{selected,mode,moving:!!job,paused,progress:job?job.elapsed/job.duration:1,eye:eye.toArray(),aim:aim.toArray(),actor:actors.stats(),frames,disposed,loopScheduled:!!raf,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,canvasCount:host.querySelectorAll('canvas').length};}
 function canDraw(){return !disposed&&visible&&!hidden;}
 function render(now=performance.now()){
  if(!canDraw())return;
  if(job&&!paused){const delta=job.last?Math.min(60,now-job.last):0;job.last=now;job.elapsed=Math.min(job.duration,job.elapsed+delta);const t=ease(job.elapsed/job.duration);
   if(job.path){const p=job.path.getPointAt(t),direction=job.path.getTangentAt(t),follow=p.clone().addScaledVector(direction,-7).add(V([4,3.2,1]));actors.move(p,direction,t*job.path.getLength());eye.lerpVectors(job.from.eye,follow,Math.min(1,t*6));aim.copy(p).addScaledVector(direction,5).add(V([0,1.5,0]));
    const settle=ease(Math.max(0,(t-.72)/.28));eye.lerp(job.to.eye,settle);aim.lerp(job.to.aim,settle);
   }else{eye.lerpVectors(job.from.eye,job.to.eye,t);aim.lerpVectors(job.from.aim,job.to.aim,t);}
   if(t>=1){const finished=job;job=null;eye.copy(finished.to.eye);aim.copy(finished.to.aim);place(selected);finished.resolve(true);}
  }
  camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();renderer.render(scene,camera);frames++;onUpdate?.(frameState());
 }
 function schedule(){if(!canDraw()||paused||!job)return;if(!raf)raf=requestAnimationFrame(now=>{raf=0;render(now);schedule();});}
 function cancel(){if(job){job.resolve(false);job=null;}cancelAnimationFrame(raf);raf=0;}
 function target(index){const s=shots[index];return{eye:V(width<760?s.phone:s.eye),aim:V(s.aim)};}
 function travelPath(from,to){
  if(from===1&&to===2)return new T.CatmullRomCurve3([V(personPlaces[from]),V([6,0,4]),V([5,0,-12]),V([2,-1,-29]),V(personPlaces[to])],false,'centripetal');
  if(from===2&&to===3)return new T.CatmullRomCurve3([V(personPlaces[from]),V([3,-1,-42]),V([5,1,-58]),V([5,1,-71]),V(personPlaces[to])],false,'centripetal');
  if(from===3&&to===4)return new T.CatmullRomCurve3([V(personPlaces[from]),V([5,1,-87]),V([5,2,-97]),V([9,5,-113]),V(personPlaces[to])],false,'centripetal');
 }
 function select(index,animate=true){if(!shots[index]||disposed)return Promise.resolve(false);const from=selected;cancel();selected=index;paused=false;const to=target(index);camera.fov=shots[index].fov;camera.updateProjectionMatrix();
  if(!animate||still||reduced.matches||from===index){eye.copy(to.eye);aim.copy(to.aim);place(index);render();return Promise.resolve(true);}
  const path=travelPath(from,index);if(!path)place(index);const duration=path?Math.min(11500,4500+path.getLength()*90):index===4?4400:2400;
  return new Promise(resolve=>{job={from:{eye:eye.clone(),aim:aim.clone()},to,elapsed:0,duration,last:0,path,resolve};schedule();});
 }
 function resize(){width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,1920/width));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(!job){const p=target(selected);eye.copy(p.eye);aim.copy(p.aim);}render();}
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(job)job.last=0;if(visible){render();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01});io.observe(host);
 document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(job)job.last=0;if(!hidden){render();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{signal});
 reduced.addEventListener('change',()=>{if(reduced.matches)select(selected,false);},{signal});
 place(0);resize();
 return{select,shots,setMode(value){mode=value;place(selected);sun.shadow.needsUpdate=lamp.shadow.needsUpdate=true;render();},togglePause(){if(!job)return false;paused=!paused;job.last=0;actors.settle();if(paused){cancelAnimationFrame(raf);raf=0;render();}else schedule();onUpdate?.(frameState());return paused;},stats:frameState,resize,
  destroy(){if(disposed)return;disposed=true;cancel();abort.abort();ro.disconnect();io.disconnect();actors.dispose();sun.shadow.dispose();lamp.shadow.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
 };
}
