import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTerritory } from './territory-architecture.mjs';
import { stations, links } from './territory-map.mjs';
export { stations } from './territory-map.mjs';

const vec=a=>new T.Vector3(...a);
export function createWorld(host,{onFrame,still=false}={}){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;host.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#172b32');scene.fog=new T.FogExp2('#172b32',.0068);
  const camera=new T.PerspectiveCamera(48,1,.4,900),architecture=buildTerritory(scene);
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.06);
  scene.environment=environment.texture;scene.environmentIntensity=.16;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight('#bdd2d4','#1a2f37',.72));
  const sun=new T.DirectionalLight('#f2e4ca',2.9);sun.castShadow=true;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-46,right:46,top:46,bottom:-46,near:2,far:190});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.06;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const local=new T.SpotLight('#ffd09a',1100,35,.85,.5,2);local.castShadow=true;local.shadow.autoUpdate=false;local.shadow.mapSize.set(1024,1024);local.shadow.normalBias=.035;scene.add(local,local.target);
  let width=1,height=1,frames=0,raf=0,disposed=false,suspended=false,visible=true,view='home',mode='agent',selected=0,arrived=0,job=null,travelled=0;
  const eye=new T.Vector3(),aim=new T.Vector3(),abort=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function home(){return width<760?{eye:vec([27,18,77]),aim:vec([-7,-3,-9])}:{eye:vec([36,17,59]),aim:vec([-3,-5,-23])};}
  function location(index){const s=stations[index];return{eye:vec(width<760?s.mobileEye:s.eye),aim:vec(s.aim)};}
  function lights(index){
    const s=stations[index],p=vec(s.position);sun.position.copy(p).add(vec([-32,62,28]));sun.target.position.copy(p);
    if(index===3){local.position.set(28,15,-79);local.target.position.set(28,2.3,-59);local.intensity=2200;local.angle=.45;local.distance=40;}
    else{local.position.copy(p).add(vec([-5,7,-1]));local.target.position.copy(p).add(vec([-3,1,0]));local.intensity=1100;local.angle=.85;local.distance=35;}
    sun.shadow.needsUpdate=local.shadow.needsUpdate=true;
  }
  function allowed(){return !disposed&&!suspended&&!document.hidden&&visible;}
  function draw(now=performance.now()){
    if(disposed||suspended)return;
    if(job){
      job.start??=now;const t=Math.min(1,(now-job.start)/job.duration),k=t*t*(3-2*t);
      if(job.path)eye.copy(job.path.getPoint(k));else eye.lerpVectors(job.eye,job.to.eye,k);
      aim.lerpVectors(job.aim,job.to.aim,k);
      if(t===1){const done=job;job=null;eye.copy(done.to.eye);aim.copy(done.to.aim);arrived=selected;lights(view==='home'?0:arrived);done.resolve();}
    }
    camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();renderer.render(scene,camera);frames++;onFrame?.([]);
  }
  function schedule(){if(!allowed()){cancelAnimationFrame(raf);raf=0;return;}if(!raf)raf=requestAnimationFrame(now=>{raf=0;if(!allowed())return;draw(now);if(job)schedule();});}
  function stop(){if(job){const old=job;job=null;old.resolve();}}
  function travel(to,animate=true,entry=false,routePoints=[]){
    stop();const distance=eye.distanceTo(to.eye);travelled+=distance;
    if(still||reduced.matches||!animate||distance<.01){eye.copy(to.eye);aim.copy(to.aim);arrived=selected;lights(view==='home'?0:arrived);draw();return Promise.resolve();}
    return new Promise(resolve=>{
      let path;
      if(!entry&&routePoints.length)path=new T.CatmullRomCurve3([eye.clone(),...routePoints,to.eye.clone()],false,'centripetal');
      job={start:null,duration:entry?2600:Math.min(6500,2000+(path?path.getLength():distance)*22),eye:eye.clone(),aim:aim.clone(),to,path,resolve};schedule();
    });
  }
  function resize(){width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,1920/width));renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=width<760?56:48;camera.updateProjectionMatrix();
    if(!job){const p=view==='home'?home():location(selected);eye.copy(p.eye);aim.copy(p.aim);}if(allowed())draw();if(job)schedule();}
  function show(next,animate=true){view=next;architecture.actors.visible=next==='space';architecture.placeActors(selected,mode);lights(next==='home'?0:selected);return travel(next==='home'?home():location(selected),animate,true);}
  function select(index){if(!stations[index])return Promise.resolve();const same=selected===index,from=arrived;
    if(same&&job)return new Promise(resolve=>{const done=job.resolve;job.resolve=()=>{done();resolve();};});
    selected=index;architecture.placeActors(index,mode);if(view!=='space'||same&&!job){if(allowed())draw();return Promise.resolve();}
    const route=[];
    if(index>from)for(let i=from;i<index;i++)route.push(...links[i]);
    else for(let i=from-1;i>=index;i--)route.push(...[...links[i]].reverse());
    const points=route.map(p=>vec(p).add(vec([0,4.2,0])));
    return travel(location(index),true,false,points);
  }
  const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.01;if(job)schedule();else if(allowed())draw();},{threshold:.01});io.observe(host);
  document.addEventListener('visibilitychange',()=>{if(job)schedule();else if(allowed())draw();},{signal:abort.signal});
  reduced.addEventListener('change',()=>{if(reduced.matches&&job){const old=job;job=null;eye.copy(old.to.eye);aim.copy(old.to.aim);arrived=selected;lights(view==='home'?0:arrived);old.resolve();}if(allowed())draw();schedule();},{signal:abort.signal});
  lights(0);resize();
  function visibility(){const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const ray=new T.Raycaster(),direction=new T.Vector3();return stations.map(s=>{
    const p=vec(s.position).add(vec([0,3,0])),inFrame=frustum.containsPoint(p);direction.copy(p).sub(camera.position);const distance=direction.length();ray.set(camera.position,direction.normalize());ray.far=distance-.7;
    const hit=inFrame?ray.intersectObjects(architecture.chunks,true)[0]:null;return{index:s.index,place:s.place,distance:Math.round(distance),inFrame,occluded:!!hit};});}
  return{show,select,resize,setMode(value){mode=value;architecture.placeActors(selected,mode);sun.shadow.needsUpdate=local.shadow.needsUpdate=true;if(allowed())draw();},pause(value){suspended=value;if(value)schedule();else resize();},
    stats:()=>({art:'continuous-territory',view,mode,selected,arrived,moving:!!job,frames,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),canvasCount:host.querySelectorAll('canvas').length,loopScheduled:!!raf,eye:eye.toArray(),aim:aim.toArray(),travelled:Math.round(travelled),visibility:visibility()}),
    destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);raf=0;stop();abort.abort();ro.disconnect();io.disconnect();sun.shadow.dispose();local.shadow.dispose();architecture.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
  };
}
