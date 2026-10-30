import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { reliefHeight,reliefBoundary,mineralTexture } from './relief-material.mjs';

const lift=(x,z)=>reliefHeight(x,z)*1.18;
export const stations=[
  ['意图','ch1',-7.2,2.8],['设计','ch2',-6,-2.3],['验证','ch3',-2.8,-.1],
  ['实现','ch4',-1.2,3.9],['交付','ch6',.5,-3],['演进','ch7',1.7,1.6],
].map(([title,chapter,x,z],index)=>({title,chapter,index,position:[x,lift(x,z)+.14,z]}));
const bankGLSL=`float bank(float z){return 2.5+.7*sin(z*.68)+.25*sin(z*1.7);}
float resolved(vec3 p){return (1.-smoothstep(bank(p.z)-.9,bank(p.z)+.05,p.x))*(1.-smoothstep(8.5,10.,abs(p.x)))*(1.-smoothstep(4.7,6.,abs(p.z)));}`;
function boundary(shader){
  shader.vertexShader='varying vec3 vField;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvField=position;');
  shader.fragmentShader='varying vec3 vField;\n'+bankGLSL+'\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=resolved(vField);\n#include <alphatest_fragment>');
}

export function createWorld(host,{onFrame,onActorStatus,actorPreview=false,still=false}={}){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;host.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#101d21');scene.fog=new T.Fog('#101d21',42,90);
  const camera=new T.OrthographicCamera(-16,16,10,-10,.1,110),field=new T.Group();field.position.x=3;scene.add(field);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const ownGeo=g=>(geometries.add(g),g),ownMat=m=>(materials.add(m),m);
  function mesh(g,m,position=[0,0,0],rotation=[0,0,0],parent=field){const o=new T.Mesh(ownGeo(g),m);o.position.fromArray(position);o.rotation.set(...rotation);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.06);scene.environment=environment.texture;scene.environmentIntensity=.1;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight('#a9c8d4','#172824',.36));
  const key=new T.DirectionalLight('#f3e4c7',4.4);key.position.set(-13,6.5,7);key.castShadow=true;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;
  key.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);Object.assign(key.shadow.camera,{left:-18,right:18,top:16,bottom:-14,near:.5,far:65});key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=.04;key.shadow.bias=-.0002;key.shadow.radius=2;scene.add(key);
  const rim=new T.DirectionalLight('#6eacb8',.65);rim.position.set(5,5,-10);scene.add(rim);
  const mineral=mineralTexture();textures.add(mineral);
  const surface=ownMat(new T.MeshStandardMaterial({color:'#3c5551',roughness:.73,metalness:0,bumpMap:mineral,bumpScale:.06,transparent:true,depthWrite:true}));
  surface.onBeforeCompile=shader=>{boundary(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 cell=vField.xz/.8;vec2 d=abs(fract(cell-.5)-.5)/max(fwidth(cell),vec2(.0001));float grid=1.-smoothstep(.25,1.05,min(d.x,d.y));
    float iso=abs(fract(vField.y/.52-.5)-.5)/max(fwidth(vField.y/.52),.0001);float contour=1.-smoothstep(.3,1.,iso);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.5,.42),grid*.11);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.23,.20),contour*.12);`);};
  const depth=ownMat(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}));depth.onBeforeCompile=shader=>{boundary(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','if(diffuseColor.a<.5)discard;\n#include <alphatest_fragment>');};
  const nx=innerWidth<760?160:224,nz=innerWidth<760?96:134,positions=[],uv=[],indices=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-10+20*i/nx,z=-6+12*j/nz;positions.push(x,lift(x,z),z);uv.push(i/nx,j/nz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=-10+20*i/nx,z=-6+12*j/nz;if(x>Math.max(reliefBoundary(z),reliefBoundary(z+12/nz))+.12)continue;const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const terrainGeo=new T.BufferGeometry();terrainGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));terrainGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));terrainGeo.setIndex(indices);terrainGeo.computeVertexNormals();
  const terrain=mesh(terrainGeo,surface);terrain.customDepthMaterial=depth;
  const bronze=ownMat(new T.MeshStandardMaterial({color:'#b79661',metalness:.55,roughness:.46}));
  const basalt=ownMat(new T.MeshStandardMaterial({color:'#34453f',metalness:.12,roughness:.8}));
  const pale=ownMat(new T.MeshStandardMaterial({color:'#b1b8a1',roughness:.79,bumpMap:mineral,bumpScale:.012}));
  const signal=ownMat(new T.MeshStandardMaterial({color:'#ffda9d',emissive:'#eab365',emissiveIntensity:.7,roughness:.5}));
  const stationRoots=[];
  function rod(a,b,r,material,parent){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),o=mesh(new T.CylinderGeometry(r,r,delta.length(),8),material,av.clone().add(bv).multiplyScalar(.5).toArray(),[0,0,0],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
  for(const s of stations){
    const group=new T.Group();group.position.fromArray(s.position);group.visible=false;field.add(group);stationRoots.push(group);
    mesh(new T.CylinderGeometry(.32,.39,.1,24),basalt,[0,.02,0],[0,0,0],group);
    mesh(new T.TorusGeometry(.29,.012,8,40),bronze,[0,.08,0],[-Math.PI/2,0,0],group);
    if(s.index===0){rod([-.24,.1,0],[-.24,.9,0],.022,bronze,group);rod([.24,.1,0],[.24,.9,0],.022,bronze,group);mesh(new T.BoxGeometry(.7,.38,.045),pale,[0,.64,0],[-.18,0,0],group);}
    if(s.index===1)for(let i=0;i<3;i++)mesh(new T.BoxGeometry(.11,.45+i*.17,.46),i===1?bronze:pale,[-.28+i*.28,.29+i*.085,0],[0,.25,0],group);
    if(s.index===2){rod([-.38,.1,0],[-.38,1.02,0],.035,pale,group);rod([.38,.1,0],[.38,1.02,0],.035,pale,group);rod([-.38,1.02,0],[.38,1.02,0],.045,bronze,group);mesh(new T.BoxGeometry(.59,.025,.07),signal,[0,.95,0],[0,0,0],group);}
    if(s.index===3)for(let i=0;i<4;i++)mesh(new T.BoxGeometry(.57,.13,.21),i===3?bronze:pale,[0,.12+i*.16,-.3+i*.2],[0,0,0],group);
    if(s.index===4){rod([-.4,.2,-.2],[.4,.65,.2],.045,bronze,group);for(let i=0;i<3;i++)rod([-.3+i*.3,.08,0],[-.3+i*.3,.28+i*.17,0],.035,pale,group);}
    if(s.index===5){rod([0,.1,0],[0,1.2,0],.026,bronze,group);mesh(new T.TorusGeometry(.27,.018,8,32),pale,[0,.88,0],[.25,.4,0],group);rod([-.32,.65,0],[.32,.65,0],.018,bronze,group);}
    const batches=new Map();for(const child of [...group.children]){child.updateMatrix();child.geometry.applyMatrix4(child.matrix);if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(child.geometry);group.remove(child);}
    for(const [material,parts] of batches){const merged=mergeGeometries(parts);parts.forEach(g=>{g.dispose();geometries.delete(g);});mesh(merged,material,[0,0,0],[0,0,0],group);}
  }
  const marks=ownGeo(new T.BufferGeometry().setFromPoints(stations.map(s=>new T.Vector3(...s.position).add(new T.Vector3(0,.04,0)))));
  field.add(new T.Points(marks,ownMat(new T.PointsMaterial({color:'#e0b976',size:2.6,sizeAttenuation:false,transparent:true,opacity:.9}))));
  const trail=[];const curve=new T.CatmullRomCurve3(stations.map(s=>new T.Vector3(s.position[0],0,s.position[2])),false,'centripetal');
  for(let i=0;i<=320;i++){const p=curve.getPoint(i/320);p.y=lift(p.x,p.z)+.06;trail.push(p);}
  const trailGeo=ownGeo(new T.BufferGeometry().setFromPoints(trail));field.add(new T.Line(trailGeo,ownMat(new T.LineBasicMaterial({color:'#e2bc7e',transparent:true,opacity:.75}))));
  // A small, real pool of light gives the evidence station a physical focus.
  const apertureData=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const a=Math.abs(x/63-.5)*2,b=Math.abs(y/63-.5)*2,v=Math.round(255*(1-T.MathUtils.smoothstep(a,.2,.55))*(1-T.MathUtils.smoothstep(b,.7,1))),i=(y*64+x)*4;apertureData[i]=apertureData[i+1]=apertureData[i+2]=v;apertureData[i+3]=255;}
  const aperture=new T.DataTexture(apertureData,64,64);aperture.minFilter=aperture.magFilter=T.LinearFilter;aperture.needsUpdate=true;textures.add(aperture);
  const pool=new T.SpotLight('#ffd097',380,20,.64,.7,2);pool.map=aperture;pool.position.set(-2,7,5);pool.target.position.set(.2,lift(-2.8,-.1),-.1);pool.castShadow=true;pool.shadow.autoUpdate=false;pool.shadow.needsUpdate=true;pool.shadow.mapSize.set(1024,1024);pool.shadow.normalBias=.025;scene.add(pool,pool.target);
  // A surveying traverse continues as disconnected samples, not a completed dark mountain.
  const pointPositions=[],pointColors=[],linePositions=[];const random=(a,b)=>(Math.sin(a*127.1+b*311.7)*43758.5453)%1;
  for(let j=0;j<27;j++)for(let i=0;i<24;i++){
    const z=-6+j*.46,x=reliefBoundary(z)+.25+i*.35,q=Math.abs(random(i,j));if(x>11||q<.32+i*.015)continue;
    const y=.25+q*2.3;pointPositions.push(x,y,z);const c=new T.Color(i<4?'#93bcb5':'#628e9e');pointColors.push(c.r,c.g,c.b);
    if(i<4&&j%2===0)linePositions.push(x,y,z,x+.2,y+.02,z);
  }
  const uTime={value:0},uPixelRatio={value:1};
  const pointsGeo=ownGeo(new T.BufferGeometry());pointsGeo.setAttribute('position',new T.Float32BufferAttribute(pointPositions,3));pointsGeo.setAttribute('color',new T.Float32BufferAttribute(pointColors,3));pointsGeo.computeBoundingSphere();pointsGeo.boundingSphere.radius+=.5;
  const pointMat=ownMat(new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,uniforms:{uTime,uPixelRatio},vertexShader:`uniform float uTime,uPixelRatio;varying vec3 vColor;varying float vAlpha;void main(){vec3 p=position;p.x+=.22*sin(uTime*.28+p.z*.5);p.y+=.13*sin(uTime*.35+p.x);vAlpha=.42+.17*sin(position.x+position.z+uTime*.4);vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=uPixelRatio*(1.6+.5*sin(position.z));}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,vAlpha*(1.-smoothstep(.15,.5,d)));
    #include <colorspace_fragment>
  }`}));field.add(new T.Points(pointsGeo,pointMat));
  field.add(new T.LineSegments(ownGeo(new T.BufferGeometry().setFromPoints(Array.from({length:linePositions.length/3},(_,i)=>new T.Vector3(...linePositions.slice(i*3,i*3+3))))),ownMat(new T.LineBasicMaterial({color:'#638d8d',transparent:true,opacity:.23}))));
  const actors=new T.Group();actors.visible=false;field.add(actors);
  function actor(human,x,z){
    const parts=human?[new T.CapsuleGeometry(.09,.28,3,8).translate(0,.37,0),new T.SphereGeometry(.085,10,6).translate(0,.67,0)]:[new T.BoxGeometry(.32,.18,.26).translate(0,.2,0),new T.BoxGeometry(.17,.1,.15).translate(0,.35,0)];
    const geo=mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g));parts.forEach(g=>g.dispose());const o=mesh(geo,human?pale:bronze,[x,lift(x,z)+.08,z],[0,0,0],actors);return o;
  }
  const person=actor(true,-3.8,1.2),bots=[actor(false,-5,-1.5),actor(false,-1,2.8),actor(false,.5,-2)]; person.visible=false;
  const pixelMaterial=ownMat(new T.SpriteMaterial({transparent:true,alphaTest:.02,depthTest:true,depthWrite:true,fog:true,toneMapped:false}));
  const pixelActor=new T.Sprite(pixelMaterial);pixelActor.scale.set(1.5,2.3,1);pixelActor.visible=false;pixelActor.renderOrder=2;field.add(pixelActor);
  const walkTextures=[],turnTextures=[],textureLoader=new T.TextureLoader();let pixelReady=false;
  const frameUrl=(folder,index)=>new URL(`${folder}/frames/frame-${String(index).padStart(2,'0')}.png`,import.meta.url).href;
  function loadPixelTexture(url,bucket,index){textureLoader.load(url,texture=>{texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.NearestFilter;texture.magFilter=T.NearestFilter;textures.add(texture);bucket[index]=texture;if(index===0){pixelReady=true;pixelMaterial.map=texture;pixelMaterial.needsUpdate=true;onActorStatus?.('停稳 · 左侧朝向');draw();}},undefined,()=>onActorStatus?.('人物像素源加载失败，保留地形探索。'));}
  if(actorPreview){for(let i=0;i<8;i++)loadPixelTexture(frameUrl('pixel-walk-v01',i),walkTextures,i);for(let i=0;i<5;i++)loadPixelTexture(frameUrl('pixel-turn-keyframes-v01',i),turnTextures,i);}
  let width=1,height=1,frames=0,raf=0,disposed=false,suspended=false,visible=true,view='home',mode='agent',job=null,actorJob=null,actorTurnJob=null,time=0,last=0,lastPaint=0,selected=2,actorIndex=2,actorT=2/(stations.length-1),actorFacing='left',actorFrame=0,actorStatus='停稳 · 左侧朝向';
  const eye=new T.Vector3(),target=new T.Vector3(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController();let span=32;
  const preset=name=>width<760?
    (name==='home'?{eye:new T.Vector3(14,16,22),target:new T.Vector3(2,4,0),span:16}:{eye:new T.Vector3(2,27,21),target:new T.Vector3(1,1.3,0),span:16}):
    (name==='home'?{eye:new T.Vector3(15,15,23),target:new T.Vector3(-3,1.4,0),span:24.5}:{eye:new T.Vector3(2,26,20),target:new T.Vector3(1,0,0),span:21.5});
  function projection(){camera.left=-span/2;camera.right=span/2;camera.top=span/2*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();}
  function projectLabels(){onFrame?.(stations.map((s,i)=>{const p=new T.Vector3(...s.position);p.x+=field.position.x;p.y+=1.1;p.project(camera);const actorOffset=pixelActor.visible&&i===actorIndex&&width>=760?72:0;return {x:(p.x+1)*width*.5+actorOffset,y:(1-p.y)*height*.5,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<.97&&Math.abs(p.y)<.95};}));}
  function actorMessage(text){actorStatus=text;onActorStatus?.(text);}
  function placePixelActor(){
    if(!pixelReady)return;
    const p=curve.getPoint(actorT);pixelActor.position.set(p.x,lift(p.x,p.z)+1.15,p.z);pixelActor.visible=actorPreview&&view==='space';
    const texture=actorTurnJob?turnTextures[actorTurnJob.frames[actorTurnJob.cursor]]:(actorFacing==='front'?turnTextures[0]:walkTextures[reduced.matches||!actorJob?0:actorFrame]);
    if(texture&&pixelMaterial.map!==texture){pixelMaterial.map=texture;pixelMaterial.needsUpdate=true;}
  }
  function moveActorTo(index){
    if(index<0||index>=stations.length||!pixelReady)return Promise.resolve(false);
    if(actorFacing!=='left'){actorMessage('已转向正面；右向步态资产未制作。');return Promise.resolve(false);}
    if(index>=actorIndex){actorMessage('当前样片只向左沿测线行进，返回方向等右向帧另行绘制。');return Promise.resolve(false);}
    if(actorJob)return actorJob.promise;
    if(index===actorIndex)return Promise.resolve(true);
    const from=actorT,to=index/(stations.length-1);
    actorMessage('沿测线行进中 · 可随时点击转身');
    return new Promise(resolve=>{actorJob={from,to,index,start:null,duration:1600,resolve,promise:null};actorJob.promise=new Promise(done=>{actorJob.resolve=()=>{resolve(true);done(true);};});schedule();});
  }
  function turnActor(){
    if(!pixelReady||actorJob||actorTurnJob)return Promise.resolve(false);
    const to=actorFacing==='left'?'front':'left',framesTo=to==='front'?[4,3,2,1,0]:[0,1,2,3,4];
    actorMessage(to==='front'?'转身回望中 · 右向步态仍未绘制':'已转回左侧 · 可继续沿测线行进');
    return new Promise(resolve=>{actorTurnJob={to,frames:framesTo,cursor:0,start:null,last:null,clock:0,resolve};schedule();});
  }
  function updatePixelActor(now){
    if(actorJob){actorJob.start??=now;const k=Math.min(1,(now-actorJob.start)/actorJob.duration),e=k*k*(3-2*k);actorT=T.MathUtils.lerp(actorJob.from,actorJob.to,e);if(k===1){actorIndex=actorJob.index;const resolve=actorJob.resolve;actorJob=null;actorFrame=0;actorMessage('已抵达测点 · 停稳');resolve?.();}}
    if(actorTurnJob){actorTurnJob.start??=now;actorTurnJob.last??=now;actorTurnJob.clock+=Math.min(.1,(now-actorTurnJob.last)/1000);actorTurnJob.last=now;if(actorTurnJob.clock>=1/6){actorTurnJob.clock=0;actorTurnJob.cursor+=1;if(actorTurnJob.cursor>=actorTurnJob.frames.length){const to=actorTurnJob.to,resolve=actorTurnJob.resolve;actorTurnJob=null;actorFacing=to;actorMessage(to==='front'?'已转向正面 · 右向步态未制作':'已转回左侧 · 停稳');resolve?.();}}}
    if(actorJob&&!reduced.matches)actorFrame=Math.floor(time*8)%8;
    placePixelActor();
  }
  function draw(now=performance.now()){
    if(disposed||suspended)return;
    if(job){job.start??=now;const k=Math.min(1,(now-job.start)/job.duration),e=k*k*(3-2*k);eye.lerpVectors(job.eye,job.to.eye,e);target.lerpVectors(job.target,job.to.target,e);span=T.MathUtils.lerp(job.span,job.to.span,e);if(k===1){const resolve=job.resolve;job=null;resolve();}}
    updatePixelActor(now);projection();camera.position.copy(eye);camera.lookAt(target);camera.updateMatrixWorld();uTime.value=time;renderer.render(scene,camera);frames++;projectLabels();
  }
  function shouldAnimate(){return !disposed&&!suspended&&!document.hidden&&visible&&(!still&&!reduced.matches||!!job||!!actorJob||!!actorTurnJob);}
  function frame(now){raf=0;if(!shouldAnimate()){last=0;return;}if(last)time+=Math.min(.1,(now-last)/1000);last=now;if(job||actorJob||actorTurnJob||now-lastPaint>=100){lastPaint=now;draw(now);}raf=requestAnimationFrame(frame);}
  function schedule(){if(!shouldAnimate()){cancelAnimationFrame(raf);raf=0;last=0;return;}if(!raf)raf=requestAnimationFrame(frame);}
  function resize(){width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<760?1.5:1.5,1920/width));uPixelRatio.value=renderer.getPixelRatio();renderer.setSize(width,height,false);if(!job){const p=preset(view);eye.copy(p.eye);target.copy(p.target);span=p.span;}draw();schedule();}
  function show(next,animate=true){view=next;actors.visible=view==='space';pixelActor.visible=actorPreview&&pixelReady&&view==='space';stationRoots.forEach(g=>g.visible=view==='space');bots.forEach(b=>b.visible=mode==='agent');key.shadow.needsUpdate=pool.shadow.needsUpdate=true;const to=preset(next);job?.resolve();job=null;if(still||reduced.matches||!animate){eye.copy(to.eye);target.copy(to.target);span=to.span;draw();schedule();return Promise.resolve();}return new Promise(resolve=>{job={start:null,duration:1800,eye:eye.clone(),target:target.clone(),span,to,resolve};schedule();});}
  const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.01;schedule();},{threshold:.01});io.observe(host);
  document.addEventListener('visibilitychange',schedule,{signal:abort.signal});reduced.addEventListener('change',()=>{if(reduced.matches&&job){const done=job;eye.copy(done.to.eye);target.copy(done.to.target);span=done.to.span;job=null;done.resolve();}if(reduced.matches&&actorJob){actorT=actorJob.to;actorIndex=actorJob.index;const done=actorJob.resolve;actorJob=null;actorFrame=0;done?.();actorMessage('减少动态 · 已抵达测点');}if(reduced.matches&&actorTurnJob){const done=actorTurnJob.resolve;actorFacing=actorTurnJob.to;actorTurnJob=null;done?.();actorMessage(actorFacing==='front'?'减少动态 · 正面停稳':'减少动态 · 左侧停稳');}draw();schedule();},{signal:abort.signal});
  resize();
  return {show,resize,moveActorTo,turnActor,setMode(value){mode=value;bots.forEach(b=>b.visible=value==='agent');person.position.set(value==='agent'?-3.8:-5,lift(value==='agent'?-3.8:-5,1.2)+.08,1.2);key.shadow.needsUpdate=pool.shadow.needsUpdate=true;draw();},select(index){selected=index;stationRoots.forEach((g,i)=>g.scale.setScalar(i===index?1.13:1));key.shadow.needsUpdate=pool.shadow.needsUpdate=true;draw();return index<actorIndex?moveActorTo(index):Promise.resolve(false);},pause(value){suspended=value;if(!value)resize();schedule();},stats:()=>({frames,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),view,mode,selected,moving:!!job||!!actorJob||!!actorTurnJob,actorIndex,actorFacing,actorMoving:!!actorJob||!!actorTurnJob,actorReady:pixelReady,actorStatus,pixelActorVisible:pixelActor.visible,pixelActorTexture:pixelMaterial.map?.image?.src?.split('/').pop()||null,canvasCount:host.querySelectorAll('canvas').length,art:'survey-frontier',surfaceTriangles:indices.length/3,unknownSamples:pointPositions.length/3,visibleStations:stationRoots.filter(g=>g.visible).length,actorsVisible:actors.visible,loopScheduled:!!raf}),destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);raf=0;job?.resolve();actorJob?.resolve?.();actorTurnJob?.resolve?.();abort.abort();ro.disconnect();io.disconnect();key.shadow.dispose();pool.shadow.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
