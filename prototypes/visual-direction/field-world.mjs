import * as T from 'three';
import {ImprovedNoise} from 'three/addons/math/ImprovedNoise.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createKit,fieldPerson,fieldRover,V} from './field-kit.mjs';

export const views={
 hero:{eye:[24,10.2,28],aim:[0,3,-17],phone:[28,13,35],fov:43},
 work:{eye:[9.4,3.2,9.7],aim:[5.1,1.45,1.9],phone:[9.8,3.6,11.6],fov:38},
 edge:{eye:[-13.8,2.2,-17.4],aim:[-20,1.8,-70],phone:[-17.8,1.8,-17.8],fov:48},
 cast:{eye:[5,3.1,8.5],aim:[.25,.9,0],phone:[7.5,4.2,13.8],fov:37}
};
export function createFieldWorld(host,{still=false,onRender}={}){
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});host.append(renderer.domElement);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.08,1500),kit=createKit(scene),world=new T.Group(),cast=new T.Group();scene.add(world,cast);
 const {own,material,mesh,box,ellipsoid,rod,tube,label,consolidate}=kit;
 const noise=new ImprovedNoise(),n=(x,z)=>noise.noise(x,z,3.81),U={time:{value:6},snow:{value:0},wet:{value:0},cloud:{value:0}};let seed=2670;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 function surface(o,snow=1){const m=material(o);m.onBeforeCompile=s=>{Object.assign(s.uniforms,{uFieldTime:U.time,uFieldSnow:U.snow,uFieldWet:U.wet,uFieldCloud:U.cloud});s.vertexShader='varying vec3 vFieldP;varying vec3 vFieldN;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 fieldLocal=vec4(transformed,1.);vec3 fieldNorm=objectNormal;
 #ifdef USE_INSTANCING
 fieldLocal=instanceMatrix*fieldLocal;fieldNorm=mat3(instanceMatrix)*fieldNorm;
 #endif
 vFieldP=(modelMatrix*fieldLocal).xyz;vFieldN=normalize(mat3(modelMatrix)*fieldNorm);`);
  s.fragmentShader='varying vec3 vFieldP;varying vec3 vFieldN;uniform float uFieldTime,uFieldSnow,uFieldWet,uFieldCloud;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float smallGrain=sin(vFieldP.x*32.+sin(vFieldP.z*19.))*sin(vFieldP.y*30.+vFieldP.z*27.);
 diffuseColor.rgb*=.985+smallGrain*.015;
 float clouds=sin(vFieldP.x*.022+vFieldP.z*.018+uFieldTime*.035)+sin(vFieldP.z*.043-vFieldP.x*.031+uFieldTime*.018)*.55;
 diffuseColor.rgb*=mix(1.,.85+.1*smoothstep(-.8,.8,clouds),uFieldCloud);
 float settle=smoothstep(.36,.82,normalize(vFieldN).y)*${snow.toFixed(2)};
 float snowPatch=smoothstep(-.8,.65,sin(vFieldP.x*.8+sin(vFieldP.z*.6))*sin(vFieldP.z*.51));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.89,.90),uFieldSnow*settle*(.75+.25*snowPatch));
 diffuseColor.rgb*=1.-uFieldWet*.11*settle;`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(roughnessFactor,max(.26,roughnessFactor*.55),uFieldWet*smoothstep(.6,.95,vFieldN.y));`);
 };m.customProgramCacheKey=()=>`field-surface-${snow}`;return m;}
 const stone=surface({color:'#7d8888',roughness:.96,flatShading:true}),rockLight=surface({color:'#b3b39b',roughness:.94,flatShading:true}),concrete=surface({color:'#b8b5a0',roughness:.89}),cladding=surface({color:'#87958c',roughness:.7,metalness:.13}),roofmat=surface({color:'#3e555b',roughness:.55,metalness:.45}),metal=surface({color:'#36494c',roughness:.5,metalness:.55}),wood=surface({color:'#9d8060',roughness:.85}),ochre=surface({color:'#d5a35f',roughness:.69}),dark=surface({color:'#202f35',roughness:.72}),warm=surface({color:'#e6d7af',emissive:'#a56b32',emissiveIntensity:.42,roughness:.7},0),blue=surface({color:'#91b1ab',emissive:'#477375',emissiveIntensity:.16,roughness:.45},0),glass=surface({color:'#739294',metalness:.35,roughness:.2},0);
 const humanPalette={coat:surface({color:'#a9633f',roughness:.88},.22),trousers:surface({color:'#3c4c4e',roughness:.89},.12),boot:surface({color:'#303d3c',roughness:.83},.08),skin:surface({color:'#b9866a',roughness:.92},0),hair:surface({color:'#393d39',roughness:.92},0),strap:dark,trim:surface({color:'#b6b099',roughness:.8},.18),metal,screen:blue};
 const roverPalette={...humanPalette,coat:ochre,trim:cladding};
 const gauss=(x,z,a,b,sx,sz,h)=>Math.exp(-Math.pow((x-a)/sx,2)-Math.pow((z-b)/sz,2))*h;
 function height(x,z){let h=.25+Math.sin(x*.09)*.4+Math.sin(z*.13)*.3+n(x*.16,z*.16)*.36;
  h-=Math.max(0,-z-12)*.065;h+=gauss(x,z,-47,-83,30,22,11)+gauss(x,z,30,-126,38,32,27)+gauss(x,z,-70,-162,42,32,31)+gauss(x,z,90,-197,44,30,42);const distant=T.MathUtils.smoothstep(-z,25,100);h+=distant*(n(x*.1,z*.1)*5+n(x*.24,z*.21)*2.7+Math.abs(n(x*.06,z*.08))*7);
  const flatten=1-T.MathUtils.smoothstep(Math.max(Math.abs((x-4)/11),Math.abs((z+2)/10)),.6,1.6);return T.MathUtils.lerp(h,.22,flatten);}
 function groundLevel(x,z){const dx=340/110,dz=350/112,gx=T.MathUtils.clamp((x+170)/dx,0,109.999),gz=T.MathUtils.clamp((z+278)/dz,0,111.999),i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,xx=-170+i*dx,zz=-278+j*dz,a=height(xx,zz),b=height(xx,zz+dz),c=height(xx+dx,zz+dz),d=height(xx+dx,zz);return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);}
 const groundGeo=own(new T.PlaneGeometry(340,350,110,112));groundGeo.rotateX(-Math.PI/2);groundGeo.translate(0,0,-103);const gp=groundGeo.attributes.position,colors=[];
 for(let i=0;i<gp.count;i++){const x=gp.getX(i),z=gp.getZ(i);gp.setY(i,height(x,z));const c=new T.Color().lerpColors(new T.Color('#637b69'),new T.Color('#a4a28a'),T.MathUtils.clamp(.45+n(x*.065,z*.065)*1.1,0,1));c.lerp(new T.Color('#80898b'),T.MathUtils.smoothstep(height(x,z),6,24)*.72);c.multiplyScalar(.92+n(x*.3,z*.3)*.15);colors.push(c.r,c.g,c.b);}groundGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));groundGeo.computeVertexNormals();const groundMat=surface({vertexColors:true,roughness:.98,flatShading:false});mesh(groundGeo,groundMat,[0,0,0],[1,1,1],world);
 const pathPoints=[[8,24],[5,15],[1,7],[0,2],[-5,-8],[-11,-20],[-20,-35],[-21,-51],[-20,-73]],pathCurve=new T.CatmullRomCurve3(pathPoints.map(([x,z])=>V([x,groundLevel(x,z)+.035,z]))),pos=[],ix=[];
 for(let i=0;i<=180;i++){const t=i/180,p=pathCurve.getPointAt(t),d=pathCurve.getTangentAt(t),side=V([d.z,0,-d.x]).normalize().multiplyScalar(1.0-i/250);for(const s of [-1,1]){const q=p.clone().addScaledVector(side,s);pos.push(q.x,groundLevel(q.x,q.z)+.035,q.z);}if(i<180){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}}
 const road=own(new T.BufferGeometry());road.setAttribute('position',new T.Float32BufferAttribute(pos,3));road.setIndex(ix);road.computeVertexNormals();mesh(road,surface({color:'#b4a78c',roughness:.98},.55),[0,0,0],[1,1,1],world);
 const buildings=new T.Group();world.add(buildings);
 // Plinth, continuous skirt and anchored main volume. Rooms are built around real openings.
 box([12,.38,8],[4.5,.43,-2.3],concrete,buildings,true);box([12.4,.16,8.4],[4.5,.69,-2.3],stone,buildings);
 box([11,.9,.2],[5,1.2,1.2],cladding,buildings);box([11,.55,.22],[5,3.65,1.2],cladding,buildings);box([11,3.6,.2],[5,2.45,-5.8],cladding,buildings);
 for(const x of [-.5,10.5]){box([.22,3.6,7],[x,2.45,-2.3],cladding,buildings);for(let z=-5.6;z<1;z+=.55)box([.235,2.9,.018],[x,2.5,z],roofmat,buildings);}
 // Door sits in a recessed weather vestibule, separate from the long working window.
 box([1.2,2.65,.2],[.1,2,1.2],cladding,buildings);box([1.25,2.65,.2],[2.8,2,1.2],cladding,buildings);
 box([1.2,2.55,.12],[1.43,1.99,1.10],dark,buildings);box([1.05,2.4,.10],[1.43,1.99,1.20],roofmat,buildings,true);box([.75,1.15,.035],[1.43,2.42,1.27],glass,buildings,true);rod([1.78,1.66,1.32],[1.78,1.92,1.32],.023,ochre,buildings);
 for(const x of [3.6,5.3,7.0,8.7,10.4])box([.09,1.7,.26],[x,2.55,1.2],metal,buildings);
 for(let x=3.65;x<10.3;x+=1.7){box([1.57,1.57,.04],[x+.79,2.55,1.14],glass,buildings);box([1.5,.03,.045],[x+.79,2.55,1.19],metal,buildings);box([1.57,.06,.35],[x+.79,1.73,1.29],ochre,buildings);}
 // A shallow sloped standing-seam roof has thickness, fascia, gutter and drainage.
 const roofShape=new T.Shape();roofShape.moveTo(-1.2,3.99);roofShape.lineTo(11.25,3.99);roofShape.lineTo(11.25,4.22);roofShape.lineTo(-1.2,5.16);roofShape.closePath();const roofGeo=own(new T.ExtrudeGeometry(roofShape,{depth:8.4,bevelEnabled:false}));mesh(roofGeo,roofmat,[0,0,-6.5],[1,1,1],buildings);
 for(let x=-.9;x<11;x+=.7){const y=5.16-(x+1.2)*.0755;rod([x,y,-6.5],[x,y,1.9],.025,metal,buildings);}
 rod([-1.22,4.94,-6.4],[-1.22,4.94,1.9],.055,metal,buildings);tube([[-1.2,4.9,1.7],[-1.5,4.65,1.7],[-1.5,.9,1.7],[-1.8,.65,2]],.045,metal,buildings);
 // Overhanging work canopy and sheltered bench, with an accessible test connector.
 box([7.8,.15,3.1],[6.1,.705,2.65],concrete,buildings);box([7,.12,2.4],[6.2,3.45,2.3],roofmat,buildings);for(const x of [3.1,9.4])rod([x,.72,3.35],[x,3.42,3.35],.045,metal,buildings);
 box([4.3,.13,1.05],[6.25,1.43,2.1],wood,buildings,true);for(const x of [4.3,8.1]){box([.08,.7,.8],[x,1.04,2.1],metal,buildings);rod([x,.79,1.7],[x,1.37,2.5],.025,metal,buildings);}
 box([1.18,.45,.59],[6.9,1.71,2.05],cladding,buildings,true);box([.77,.22,.035],[6.9,1.76,2.36],dark,buildings,true);for(const x of [6.68,6.93,7.18]){const plug=mesh(own(new T.CylinderGeometry(.043,.043,.04,12)),ochre,[x,1.73,2.4],[1,1,1],buildings);plug.rotation.x=Math.PI/2;}
 tube([[6.95,1.73,2.43],[7.3,1.47,2.6],[7.5,.85,2.8],[6,.76,3],[5.4,.76,2.7]],.026,dark,buildings);box([.42,.035,.3],[5.25,1.52,2.1],ochre,buildings,true);
 // Punched metal mounting rails and weathered panels, rather than floating ornaments.
 for(let x=3.9;x<10.2;x+=.31){box([.018,.45,.04],[x,1.24,1.33],metal,buildings);}
 box([2.2,1.7,1.2],[9.3,1.6,-6.45],metal,buildings,true);for(let y=1;y<2.3;y+=.16)box([1.9,.045,.05],[9.3,y,-7.08],cladding,buildings);
 for(const x of [0,2,4,6,8,10])box([.1,.16,.14],[x,.78,1.55],metal,buildings);
 for(let i=0;i<3;i++)box([2.2,.15,.52],[1.4,.15+i*.18,2.6-i*.48],concrete,buildings,true);
 for(const x of [.1,2.7]){rod([x,.75,1.9],[x,.35,3.35],.035,metal,buildings);rod([x,.75,1.9],[x,1.55,1.9],.025,metal,buildings);}
 box([.98,.75,.68],[9,1.12,3.5],ochre,buildings,true);box([.91,.07,.61],[9,1.54,3.5],metal,buildings,true);for(const x of [8.65,9.35])box([.045,.2,.035],[x,1.4,3.85],dark,buildings);
 box([1.45,.32,.8],[2.4,.93,-7.2],wood,buildings,true);box([1.2,.32,.7],[2.5,1.28,-7.2],cladding,buildings,true);
 for(const x of [1,6.1,8]){const plank=box([.5,.045,.25],[x,.82,4.3],wood,buildings,true);plank.rotation.y=x*.4;}
 // Sensors and stays share real mounting locations.
 rod([10.2,.7,-4.8],[10.2,9,-4.8],.075,metal,buildings,.035);for(const a of [0,2.1,4.2]){const x=10.2+Math.sin(a)*3,z=-4.8+Math.cos(a)*3;rod([10.2,7,-4.8],[x,.5,z],.012,metal,buildings);box([.22,.16,.22],[x,.45,z],concrete,buildings);}
 rod([9.5,8.6,-4.8],[10.9,8.6,-4.8],.023,metal,buildings);for(let a=0;a<3;a++){const x=10.2+Math.cos(a*2.094)*.4,z=-4.8+Math.sin(a*2.094)*.4;rod([10.2,9,-4.8],[x,9,z],.016,metal,buildings);ellipsoid([.1,.04,.1],[x,9,z],dark,buildings);}
 box([.3,.18,.34],[10.2,7.9,-4.8],warm,buildings,true);box([.16,.02,.95],[10.2,7.7,-4.8],ochre,buildings);
 const sign=label('FIELD STATION / 07',[1.5,3.47,1.36],2.45,'#ded8bc','#34494a',buildings);sign.castShadow=false;
 const wallLamp=box([.28,.12,.16],[1.4,3.06,1.41],warm,buildings,true);
 // Skip maps during material batching so the physical sign keeps its UVs.
 const signParent=sign.parent;sign.removeFromParent();consolidate(buildings);signParent.add(sign);
 const roughGeo=own(new T.IcosahedronGeometry(1,1));const rp=roughGeo.attributes.position;for(let i=0;i<rp.count;i++){const v=V([rp.getX(i),rp.getY(i),rp.getZ(i)]).multiplyScalar(.93+n(rp.getX(i)*2+3,rp.getY(i)*2+rp.getZ(i)*2)*.15);rp.setXYZ(i,v.x,v.y,v.z);}roughGeo.computeVertexNormals();
 const rocks=new T.InstancedMesh(roughGeo,stone,95);rocks.castShadow=rocks.receiveShadow=true;const dummy=new T.Object3D();for(let i=0;i<95;i++){let x=(rand()-.5)*105,z=rand()*105-78;if(x>-3&&x<13&&z>-9&&z<8)x-=22;const size=.25+Math.pow(rand(),3)*3.2;dummy.position.set(x,groundLevel(x,z)-size*.16,z);dummy.scale.set(size*1.7,size*.7,size);dummy.rotation.set(rand()*.3,rand()*6.28,rand()*.2);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}world.add(rocks);
 // A few larger strata are embedded in the ground near the field path.
 for(const[x,z,s]of[[-10,-9,2.7],[-17,-18,3.1],[20,-9,4.1],[-25,-30,4.5]]){const r=mesh(roughGeo,rockLight,[x,groundLevel(x,z)-s*.12,z],[s*1.6,s*.65,s],world);r.rotation.y=x*.3;}
 const grassMat=surface({color:'#6e7955',roughness:1,side:T.DoubleSide},.75);const blade=own(new T.PlaneGeometry(.055,.7,1,3));blade.translate(0,.35,0);grassMat.onBeforeCompile=((original)=>s=>{original(s);s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 transformed.x+=pow(max(0.,position.y),2.)*(.22+sin(uFieldTime*1.6+instanceMatrix[3].x*.7+instanceMatrix[3].z*.4)*.12);`);s.vertexShader='uniform float uFieldTime;\n'+s.vertexShader;})(grassMat.onBeforeCompile);
 const grasses=new T.InstancedMesh(blade,grassMat,3600);grasses.receiveShadow=true;for(let i=0;i<3600;i++){let x=(rand()-.5)*95,z=rand()*92-50;if(x>-3&&x<13&&z>-9&&z<7)x-=18;const scale=.3+rand()*.9;dummy.position.set(x,groundLevel(x,z),z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grasses.setMatrixAt(i,dummy.matrix);}world.add(grasses);
 // One remote recorder supplies a legible destination beyond the first rise.
 const recorder=new T.Group();recorder.position.set(-20,groundLevel(-20,-73),-73);world.add(recorder);for(const x of [-.7,.7])rod([x,0,0],[x,1.6,0],.055,metal,recorder);box([1.6,.9,.7],[0,1.6,0],ochre,recorder,true);box([1.3,.5,.025],[0,1.6,.37],dark,recorder);rod([0,2,0],[0,4,0],.04,metal,recorder);rod([-1.2,3.6,0],[1.2,3.6,0],.025,metal,recorder);consolidate(recorder);
 const actors=new T.Group();world.add(actors);const worker=fieldPerson(kit,humanPalette,{pose:'check',rotation:.15});worker.position.set(5.6,.79,3.03);worker.rotation.y=Math.PI;actors.add(worker);const rover=fieldRover(kit,roverPalette);rover.position.set(7.9,.79,2.9);rover.rotation.y=-.25;actors.add(rover);
 const observer=fieldPerson(kit,humanPalette,{pose:'observe'});observer.position.set(-17.1,groundLevel(-17.1,-26),-26);observer.rotation.y=Math.PI;actors.add(observer);
 const castFloor=mesh(own(new T.CircleGeometry(8,64)),surface({color:'#b8b5a7',roughness:.92}),[0,-.012,0],[1,1,1],cast);castFloor.rotation.x=-Math.PI/2;for(const[pose,x]of[['stand',-2],['check',-.55],['observe',.95]]){const p=fieldPerson(kit,humanPalette,{pose});p.position.x=x;p.rotation.y=.25;cast.add(p);}const castRover=fieldRover(kit,roverPalette);castRover.position.set(2.55,0,0);castRover.rotation.y=.38;cast.add(castRover);consolidate(cast);cast.visible=false;
 // Analytic sky and cloud fields establish weather without a fixed dark backdrop.
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:U.time,uWet:U.wet,uSnow:U.snow},vertexShader:'varying vec3 vSky;void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vSky;uniform float uTime,uWet,uSnow;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(vSky);float h=clamp(d.y,0.,1.);vec3 sky=mix(vec3(.70,.77,.76),vec3(.24,.43,.53),smoothstep(0.,.8,h));vec2 p=d.xz/max(.16,d.y+.21)*2.2+uTime*.007;float cloud=.5+sin(p.x*1.1+sin(p.y*.8))*.18+sin(p.y*1.8-p.x*.5)*.12+sin(p.x*3.+p.y*2.4)*.055;float cover=smoothstep(.43-.14*max(uWet,uSnow),.7,cloud)*smoothstep(-.02,.2,d.y);sky=mix(sky,vec3(.86,.86,.79),cover*.82);sky=mix(sky,vec3(.47,.56,.59)+h*.09,max(uWet,uSnow)*.65);gl_FragColor=vec4(sky,1.);
 #include <colorspace_fragment>
 }`});kit.materials.add(skyMat);const sky=new T.Mesh(own(new T.SphereGeometry(1100,72,48)),skyMat);scene.add(sky);
 const hemi=new T.HemisphereLight('#d5e3df','#5b6251',1.25);scene.add(hemi);const sun=new T.DirectionalLight('#ffe3ad',3.15);sun.position.set(-30,48,26);sun.target.position.set(0,0,-5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;Object.assign(sun.shadow.camera,{left:-32,right:32,top:28,bottom:-28,near:1,far:160});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
 const practical=new T.PointLight('#ffc780',22,8,2);practical.position.set(5.5,2.4,2.2);scene.add(practical);
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.22;room.dispose();pmrem.dispose();
 const weatherGeo=own(new T.BufferGeometry()),weatherPos=[];for(let i=0;i<1100;i++)weatherPos.push((rand()-.5)*65,rand()*28,(rand()-.5)*85-10);weatherGeo.setAttribute('position',new T.Float32BufferAttribute(weatherPos,3));
 const weatherMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:U.time,uSnow:U.snow},vertexShader:`uniform float uTime,uSnow;void main(){vec3 p=position;p.y=mod(p.y-uTime*mix(11.,1.1,uSnow),28.);p.x+=sin(p.y*.2+uTime)*uSnow*.4-p.y*.14;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=mix(14.,5.,uSnow)*clamp(18./-mv.z,.4,2.);}`,fragmentShader:`uniform float uSnow;void main(){vec2 p=gl_PointCoord-.5;float a=mix(smoothstep(.11,.025,abs(p.x-p.y*.3))*smoothstep(.5,.1,abs(p.y))*.5,smoothstep(.5,.18,length(p)),uSnow);gl_FragColor=vec4(mix(vec3(.69,.80,.84),vec3(.95,.97,.96),uSnow),a*.65);}`});kit.materials.add(weatherMat);const particles=new T.Points(weatherGeo,weatherMat);world.add(particles);particles.visible=false;particles.frustumCulled=false;
 let view='hero',weather='sun',frames=0,disposed=false,raf=0,playing=false,visible=true,hidden=document.hidden,last=0,width=1,heightPx=1;const abort=new AbortController(),{signal}=abort,reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function render(){if(disposed||hidden||!visible)return;camera.updateMatrixWorld();renderer.render(scene,camera);frames++;onRender?.(stats());}
 function configure(){const sheet=view==='cast';world.visible=!sheet;cast.visible=sheet;sky.visible=!sheet;scene.background=sheet?new T.Color('#c4c5bc'):null;scene.fog=sheet?null:new T.Fog(weather==='sun'?'#b6c4bd':weather==='rain'?'#a3b4b5':'#b8c6cb',weather==='sun'?95:65,weather==='sun'?340:weather==='rain'?220:195);U.snow.value=sheet?0:Number(weather==='snow');U.wet.value=sheet?0:Number(weather==='rain');U.cloud.value=sheet?0:weather==='sun'?.22:.8;particles.visible=!sheet&&weather!=='sun';sun.intensity=sheet?2.5:weather==='sun'?3.15:weather==='rain'?.9:1.35;sun.color.set(sheet||weather==='sun'?'#ffe3ad':'#dce7e9');hemi.intensity=sheet?1.4:weather==='sun'?1.25:1.65;practical.intensity=sheet?0:weather==='sun'?22:48;observer.visible=view==='edge';worker.visible=view!=='edge';rover.visible=view!=='edge';const s=views[view];camera.fov=s.fov;camera.position.set(...(width<760?s.phone:s.eye));camera.lookAt(...s.aim);camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;render();}
 function resize(){width=host.clientWidth;heightPx=host.clientHeight;if(!width||!heightPx)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,1920/width));renderer.setSize(width,heightPx,false);camera.aspect=width/heightPx;configure();}
 function stats(){return{view,weather,frames,playing,disposed,loop:!!raf,time:U.time.value,canvas:host.querySelectorAll('canvas').length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,eye:camera.position.toArray()};}
 function schedule(){if(disposed||!playing||still||reduced.matches||hidden||!visible||raf)return;raf=requestAnimationFrame(now=>{raf=0;const delta=last?Math.min((now-last)/1000,.06):0;last=now;U.time.value+=delta;render();schedule();});}
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;if(visible){render();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01});io.observe(host);
 document.addEventListener('visibilitychange',()=>{hidden=document.hidden;last=0;if(!hidden){render();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{signal});reduced.addEventListener('change',()=>{cancelAnimationFrame(raf);raf=0;last=0;schedule();},{signal});
 // Drop construction-only geometry after all four figure poses and scenery are built.
 const used=new Set();scene.traverse(o=>{if(o.geometry)used.add(o.geometry);});for(const g of kit.geometries)if(!used.has(g)){g.dispose();kit.geometries.delete(g);}
 resize();return{setView(value){if(!views[value]||disposed)return;view=value;configure();},setWeather(value){if(!['sun','rain','snow'].includes(value)||disposed)return;weather=value;configure();},setPlaying(value){playing=!!value;last=0;cancelAnimationFrame(raf);raf=0;if(playing)schedule();onRender?.(stats());},stats,resize,destroy(){if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(raf);raf=0;abort.abort();ro.disconnect();io.disconnect();sun.shadow.dispose();env.dispose();kit.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
