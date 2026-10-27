import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createKit,V} from './field-kit.mjs';

// A local art study. Coordinates are metres; the connector is the pose anchor.
export function createBenchWorld(host,{still=false}={}){
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#869b9c');scene.fog=new T.Fog('#869b9c',9,65);
 const camera=new T.PerspectiveCamera(38,1,.05,130),kit=createKit(scene);
 const {own,material,mesh,box,ellipsoid,rod,tube,label}=kit;
 let seed=42873;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const tex=(size,draw)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());kit.textures.add(t);return t;};
 const weave=tex(256,(c,s)=>{c.fillStyle='#b5b5b5';c.fillRect(0,0,s,s);for(let i=0;i<s;i+=2){c.fillStyle=i%4?'#9d9d9d':'#c4c4c4';c.fillRect(i,0,1,s);c.fillStyle='#a5a5a5';c.fillRect(0,i,s,1);}for(let i=0;i<3000;i++){const v=150+random()*70;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(random()*s,random()*s,1,1);}});weave.repeat.set(7,9);
 const brushed=tex(256,(c,s)=>{c.fillStyle='#b6b6b6';c.fillRect(0,0,s,s);for(let i=0;i<600;i++){const v=140+random()*70;c.strokeStyle=`rgba(${v},${v},${v},.15)`;c.beginPath();const x=random()*s,y=random()*s;c.moveTo(x,y);c.lineTo(x+random()*35,y);c.stroke();}});brushed.repeat.set(3,2);
 const woodgrain=tex(512,(c,s)=>{c.fillStyle='#a2a2a2';c.fillRect(0,0,s,s);for(let i=0;i<1200;i++){const y=random()*s,v=80+random()*90;c.strokeStyle=`rgba(${v},${v},${v},.22)`;c.beginPath();c.moveTo(0,y);for(let x=0;x<=s;x+=16)c.lineTo(x,y+Math.sin(x*.02+y)*2);c.stroke();}});woodgrain.repeat.set(2,1);
 const paint=material({color:'#7b8a7b',roughness:.79,bumpMap:brushed,bumpScale:.0014}),metal=material({color:'#394b4b',roughness:.48,metalness:.65}),rubber=material({color:'#243434',roughness:.84}),steel=material({color:'#9ba5a0',metalness:.8,roughness:.36}),edge=material({color:'#bdbaa3',roughness:.73}),rust=material({color:'#9b6745',roughness:.88});
 const wood=material({color:'#82785b',map:woodgrain,roughness:.86,bumpMap:woodgrain,bumpScale:.001}),coat=material({color:'#92775a',roughness:.96,bumpMap:weave,bumpScale:.0004}),coatShade=material({color:'#75644f',roughness:.97,bumpMap:weave,bumpScale:.0004}),seam=material({color:'#b49b76',roughness:1}),clothDark=material({color:'#435455',roughness:1,bumpMap:weave,bumpScale:.0004}),glove=material({color:'#58635d',roughness:.96,bumpMap:weave,bumpScale:.0002}),palm=material({color:'#303d39',roughness:.9}),skin=material({color:'#a3836b',roughness:.98}),hair=material({color:'#454940',roughness:1}),signal=material({color:'#bd8a44',roughness:.67,metalness:.25});
 const lightMat=material({color:'#efe4c2',emissive:'#f6c27d',emissiveIntensity:2.1,roughness:.65}),screenMat=material({color:'#a4bfaf',emissive:'#5c938b',emissiveIntensity:.6,roughness:.57});
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.08);scene.environment=env.texture;scene.environmentIntensity=.22;room.dispose();pmrem.dispose();
 const hemi=new T.HemisphereLight('#c8dfdc','#4e5145',2.0);scene.add(hemi);
 const sun=new T.DirectionalLight('#e0e9db',2.3);sun.position.set(4,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-3,near:.5,far:20});sun.shadow.normalBias=.012;sun.shadow.bias=-.0001;scene.add(sun);
 const worklight=new T.SpotLight('#ffd79e',12,5,1.12,.7,2);worklight.position.set(.35,2.02,-.38);worklight.target.position.set(.3,1.1,.44);worklight.castShadow=true;worklight.shadow.mapSize.set(1024,1024);worklight.shadow.normalBias=.005;scene.add(worklight,worklight.target);
 const architecture=new T.Group();scene.add(architecture);
 box([6,.14,4.9],[0,-.09,-.7],material({color:'#8d9385',roughness:.93}),architecture);
 // Standing seams and recessed weatherboard sit behind the actual work surface.
 box([5.2,2.8,.16],[-.45,1.25,-.65],paint,architecture);
 for(let x=-3;x<2.2;x+=.43){box([.009,2.7,.012],[x,1.3,-.553],paint,architecture);for(const y of [.18,1.8,2.48])ellipsoid([.006,.006,.004],[x,y,-.543],steel,architecture);}
 box([5.6,.12,2.45],[-.2,2.62,-.35],metal,architecture);box([5.6,.075,.075],[-.2,2.54,.89],paint,architecture);
 for(const x of [-2.35,2.1]){box([.075,2.65,.075],[x,1.3,.86],metal,architecture);rod([x,2.15,.86],[x,2.58,.36],.024,steel,architecture);}
 tube([[2.16,2.57,.9],[2.28,2.5,.9],[2.28,.12,.9],[2.55,.04,1.13]],.032,metal,architecture);
 // An exposed ground surface with coherent wetness; the covered strip stays matte.
 const groundMat=material({color:'#64736d',roughness:.88});groundMat.onBeforeCompile=s=>{s.vertexShader='varying vec3 vGround;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='varying vec3 vGround;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float fleck=sin(vGround.x*16.+sin(vGround.z*19.))*sin(vGround.z*24.);diffuseColor.rgb*=.93+fleck*.07;
 float exposed=smoothstep(.86,1.03,vGround.z);float pool=smoothstep(-.1,.65,sin(vGround.x*2.5+sin(vGround.z*3.1))*sin(vGround.z*3.7));diffuseColor.rgb*=1.-exposed*(.13+.12*pool);`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(.94,.22,exposed*pool);`);};
 box([24,.08,23],[0,-.18,5],groundMat,architecture);
 for(let z=1.45;z<5;z+=.76)box([4,.005,.008],[.2,-.132,z],metal,architecture);
 // Bench construction: replaceable planks, open steel legs, lower cable shelf.
 for(let z=-.27;z<.52;z+=.19)box([2.85,.065,.181],[.13,1.01,z],wood,architecture,true);
 for(const x of [-1.2,1.45]){box([.055,.97,.055],[x,.49,-.25],metal,architecture);box([.055,.97,.055],[x,.49,.43],metal,architecture);rod([x,.2,-.25],[x,.94,.43],.014,steel,architecture);box([.14,.025,.15],[x,.01,.43],rubber,architecture);box([.14,.025,.15],[x,.01,-.25],rubber,architecture);}
 box([2.7,.04,.6],[.13,.32,.08],paint,architecture);box([2.82,.055,.03],[.13,.962,.52],steel,architecture);
 for(let x=-1.1;x<1.5;x+=.36){box([.017,.004,.08],[x,1.046,.42],edge,architecture);}
 // The focus: a weatherproof field recorder, gasket, latch, recessed face and locking connector.
 const equipment=new T.Group();scene.add(equipment);
 box([.99,.38,.58],[.7,1.26,-.005],paint,equipment,true);box([.92,.325,.025],[.7,1.26,.294],rubber,equipment,true);box([.87,.28,.025],[.7,1.26,.311],metal,equipment,true);
 box([.36,.185,.014],[.8,1.285,.329],rubber,equipment,true);box([.315,.139,.008],[.8,1.285,.339],screenMat,equipment);
 const display=label('LINK  /  02',[.8,1.31,.345],.28,'#cce0c8','#425f58',equipment);display.scale.y=.5;
 for(let i=0;i<5;i++)box([.015,.015,.007],[.69+i*.046,1.25,.348],i<3?screenMat:rubber,equipment);
 for(const x of [.28,1.12])for(const y of [1.145,1.375]){ellipsoid([.011,.011,.006],[x,y,.33],steel,equipment);box([.012,.002,.002],[x,y,.337],rubber,equipment);}
 for(const x of [.3,1.1]){box([.09,.04,.14],[x,1.47,.025],metal,equipment,true);box([.064,.012,.075],[x,1.495,.045],steel,equipment);box([.032,.1,.028],[x,1.3,-.302],metal,equipment);}
 rod([.38,1.48,-.04],[.98,1.48,-.04],.02,rubber,equipment);
 const plugCenter=[.4,1.23,.39];rod([.4,1.23,.33],[.4,1.23,.405],.045,steel,equipment);rod([.4,1.23,.385],[.4,1.23,.48],.038,signal,equipment);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;rod([.4+Math.cos(a)*.039,1.23+Math.sin(a)*.039,.405],[.4+Math.cos(a)*.039,1.23+Math.sin(a)*.039,.465],.0022,steel,equipment);}
 for(let z=.48;z<.59;z+=.012)rod([.4,1.23,z],[.4,1.23,z+.005],.022,rubber,equipment);
 tube([[.4,1.23,.57],[.39,1.18,.7],[.44,.99,.75],[.7,.72,.78],[1.17,.59,.63],[1.3,.7,.29],[1.3,1.1,-.2]],.012,rubber,equipment);
 tube([[1.1,1.1,-.3],[1.18,.92,-.45],[1.3,.6,-.53],[1.3,.2,-.53]],.009,rubber,equipment);
 box([.4,.025,.26],[-.67,1.06,.06],rubber,equipment,true);box([.34,.012,.2],[-.67,1.083,.06],signal,equipment,true);label('17  /  CHECK',[-.67,1.093,.06],.28,'#d5c5a1','#696750',equipment).rotation.x=-Math.PI/2;
 tube([[-1.17,1.057,.12],[-1.02,1.058,.1],[-.92,1.057,.18]],.011,steel,equipment);box([.105,.018,.065],[-1.17,1.063,.11],signal,equipment,true);
 // Wall utilities belong to the task, rather than a random decorative prop field.
 box([.54,.6,.14],[1.3,1.87,-.47],metal,architecture,true);box([.46,.5,.016],[1.3,1.87,-.387],paint,architecture,true);label('FIELD  /  07',[1.3,2,-.375],.37,'#dddac4','#4e615a',architecture);box([.09,.15,.035],[1.43,1.78,-.36],rubber,architecture);box([.055,.08,.018],[1.43,1.79,-.33],signal,architecture);
 tube([[1.3,1.57,-.47],[1.3,1.5,-.43],[1.15,1.43,-.28]],.014,rubber,architecture);
 box([.76,.07,.15],[.35,2.09,-.4],metal,architecture,true);box([.65,.016,.11],[.35,2.05,-.39],lightMat,architecture);
 for(let x=-.03;x<.75;x+=.16)rod([x,2.08,-.44],[x,2.08,-.34],.007,rubber,architecture);
 // Tailored cloth surfaces: continuous sections, an asymmetric lean, elbows and cuffs.
 const person=new T.Group();person.position.x=.24;scene.add(person);
 function sectionSurface(rings,mat,parent=person,fold=.004){const positions=[],uvs=[],idx=[],sides=32;for(let j=0;j<rings.length;j++){const [x,y,z,rx,rz]=rings[j];for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,w=fold*(Math.sin(a*7+j*.8)+.4*Math.sin(a*13-j*.6));positions.push(x+(rx+w)*Math.cos(a),y,z+(rz+w)*Math.sin(a));uvs.push(i/sides,j/(rings.length-1));if(j<rings.length-1&&i<sides){const k=j*(sides+1)+i;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}}const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(idx);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[1,1,1],parent);}
 function sleeve(points,radii,mat=coat,parent=person){const curve=new T.CatmullRomCurve3(points.map(V)),steps=32,sides=20,frames=curve.computeFrenetFrames(steps,false),positions=[],uvs=[],idx=[];for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPointAt(t),f=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(f)),r=T.MathUtils.lerp(radii[j],radii[j+1],f-j);for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,rr=r*(1+.055*Math.sin(a*6+i*.7)),q=p.clone().addScaledVector(frames.normals[i],rr*Math.cos(a)).addScaledVector(frames.binormals[i],rr*.9*Math.sin(a));positions.push(...q.toArray());uvs.push(k/sides,t);if(i<steps&&k<sides){const v=i*(sides+1)+k;idx.push(v,v+1,v+sides+1,v+1,v+sides+2,v+sides+1);}}}const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(idx);g.computeVertexNormals();return mesh(g,mat,[0,0,0],[1,1,1],parent);}
 sectionSurface([[-.75,.78,.64,.19,.16],[-.73,.83,.63,.205,.17],[-.7,.94,.61,.18,.155],[-.64,1.09,.57,.175,.155],[-.57,1.25,.53,.19,.177],[-.5,1.4,.48,.19,.208],[-.46,1.47,.45,.14,.17],[-.43,1.5,.44,.077,.095]],coat);
 sectionSurface([[-.75,.8,.64,.194,.162],[-.75,.825,.64,.209,.177],[-.73,.85,.63,.2,.172]],coatShade);
 for(const p of [[[-.82,.82,.53],[-.83,.49,.56],[-.94,.15,.6]],[[-.65,.82,.74],[-.52,.48,.79],[-.53,.15,.9]]]){sleeve(p,[.105,.095,.068],clothDark);const end=p[2];box([.2,.15,.29],[end[0]+.03,.08,end[2]],rubber,person,true);box([.21,.025,.3],[end[0]+.03,.015,end[2]],metal,person,true);}
 // A soft hood frames a downturned adult head. No imported base character.
 const head=new T.Group();head.position.set(-.36,1.61,.43);head.rotation.z=-.2;person.add(head);
 ellipsoid([.088,.122,.082],[-.003,0,0],skin,head);ellipsoid([.052,.061,.064],[.028,-.065,0],skin,head);ellipsoid([.025,.024,.016],[.088,-.018,.004],skin,head);
 tube([[.073,.024,.043],[.087,.021,.04]],.0035,hair,head);tube([[.085,-.057,.025],[.091,-.055,.009]],.0025,coatShade,head);
 const hoodPos=[],hoodUV=[],hoodIdx=[];for(let j=0;j<=20;j++){const theta=.82+j/20*(Math.PI-.82);for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,rr=1+.022*Math.sin(a*5+j*.5);hoodPos.push(-.022+.147*Math.cos(theta),.016+.177*Math.sin(theta)*Math.cos(a)*rr,.122*Math.sin(theta)*Math.sin(a)*rr);hoodUV.push(i/40,j/20);if(j<20&&i<40){const k=j*41+i;hoodIdx.push(k,k+41,k+1,k+1,k+41,k+42);}}}const hoodGeo=own(new T.BufferGeometry());hoodGeo.setAttribute('position',new T.Float32BufferAttribute(hoodPos,3));hoodGeo.setAttribute('uv',new T.Float32BufferAttribute(hoodUV,2));hoodGeo.setIndex(hoodIdx);hoodGeo.computeVertexNormals();mesh(hoodGeo,coat,[0,0,0],[1,1,1],head);
 const hoodRim=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;hoodRim.push([.078,.016+.13*Math.cos(a),.089*Math.sin(a)]);}tube(hoodRim,.007,coatShade,head);
 tube([[-.155,-.035,0],[-.166,.05,0],[-.125,.14,0],[-.03,.192,0],[.065,.15,0]],.0025,seam,head);
 sectionSurface([[-.43,1.43,.44,.09,.1],[-.42,1.49,.44,.09,.107],[-.4,1.54,.44,.071,.093]],coatShade);
 tube([[-.4,1.51,.53],[-.35,1.4,.63],[-.43,1.23,.72],[-.56,.94,.76],[-.6,.82,.77]],.005,rubber,person);
 // The storm flap and shoulder panel follow the coat rather than floating beside it.
 tube([[-.63,1.37,.385],[-.69,1.24,.39],[-.73,1.08,.46],[-.8,.91,.51]],.0025,seam,person);
 tube([[-.55,1.39,.33],[-.59,1.43,.46],[-.55,1.4,.63]],.005,coatShade,person);
 for(const z of [.39,.69]){tube([[-.55,1.25,z],[-.62,1.13,z+.02],[-.56,1.01,z+.02]],.003,seam,person);}
 // Back hand supports the lead; near hand turns the locking ring.
 sleeve([[-.5,1.42,.29],[-.4,1.28,.2],[-.25,1.16,.24],[.03,1.16,.52]],[.098,.08,.061,.043]);
 sleeve([[-.51,1.41,.68],[-.44,1.26,.77],[-.3,1.18,.79],[.03,1.24,.54]],[.103,.083,.061,.043]);
 for(const [a,b] of [[ [-.02,1.23,.565],[.05,1.24,.53] ],[[-.02,1.15,.5],[.05,1.16,.535]]])rod(a,b,.043,clothDark,person);
 // Individual curled fingers make contact with the ring, rather than hovering mitten shapes.
 const hand=new T.Group();hand.position.x=-.24;person.add(hand);
 ellipsoid([.058,.026,.045],[.335,1.247,.51],glove,hand);ellipsoid([.044,.014,.036],[.345,1.228,.503],palm,hand);
 for(let i=0;i<4;i++){const z=.421+i*.016;tube([[.35,1.254,z+.012],[.388,1.272,z],[.427,1.255,z],[.43,1.229,z]],.009-i*.0006,glove,hand);tube([[.383,1.275,z],[.405,1.27,z]],.0017,seam,hand);}
 tube([[.31,1.239,.49],[.338,1.211,.47],[.371,1.201,.46],[.388,1.216,.455]],.013,glove,hand);
 ellipsoid([.05,.023,.045],[.322,1.17,.553],glove,hand);for(let i=0;i<4;i++)tube([[.33,1.18,.532+i*.014],[.372,1.196,.535+i*.012],[.406,1.189,.548+i*.012]],.008,glove,hand);tube([[.31,1.184,.52],[.35,1.208,.516],[.382,1.21,.536]],.011,glove,hand);
 // Shoulder yoke, a stitched pocket and a narrow utility strap follow the leaning body.
 tube([[-.66,1.38,.34],[-.62,1.43,.49],[-.57,1.41,.66]],.0035,seam,person);tube([[-.68,1.02,.765],[-.59,1.07,.769],[-.49,1.14,.72]],.003,seam,person);
 sleeve([[-.58,1.44,.33],[-.71,1.3,.36],[-.79,1.11,.42],[-.77,.86,.5]],[.017,.018,.017,.015],rubber);box([.036,.052,.017],[-.77,1.04,.45],steel,person,true);
 // A recessed sill catches a warm return, with real brackets and separated paint chips.
 box([1.2,.09,.16],[-1.55,1.88,-.43],paint,architecture);for(let i=0;i<26;i++){const x=-2.13+random()*1.2;box([.008+random()*.027,.003,.006],[x,1.927,-.37+random()*.06],rust,architecture);}
 // Exterior is a glimpse beyond the post, with wind-leaned plants and layered ridges.
 const terrain=own(new T.PlaneGeometry(100,100,45,45));terrain.rotateX(-Math.PI/2);terrain.translate(15,-.25,-21);const tp=terrain.attributes.position;for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i);tp.setY(i,-.3+Math.max(0,-z-5)*.07+Math.sin(x*.14+z*.1)*1.2+Math.sin(x*.28-z*.17)*.6);}terrain.computeVertexNormals();mesh(terrain,material({color:'#6c7c70',roughness:1}),[0,0,0]);
 const grassMat=material({color:'#7a8265',roughness:1,side:T.DoubleSide}),grassGeo=own(new T.PlaneGeometry(.035,.45,1,3)),grass=new T.InstancedMesh(grassGeo,grassMat,160),dummy=new T.Object3D();grass.castShadow=false;grass.receiveShadow=true;for(let i=0;i<160;i++){dummy.position.set(2.7+random()*12,-.06,1.4+random()*10);dummy.rotation.set(-.2,random()*6.28,-.15-random()*.4);dummy.scale.setScalar(.5+random()*.7);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}scene.add(grass);
 // A few readable streaks, restricted to the exterior of the roof, use one GPU draw.
 const rainCount=600,rainPos=[],rainSeed=[];for(let i=0;i<rainCount;i++){const x=-3+random()*11,y=random()*5,z=1.12+random()*10;rainPos.push(x,0,z,x+.014,-.07-random()*.07,z+.009);rainSeed.push(y,y);}const rg=own(new T.BufferGeometry());rg.setAttribute('position',new T.Float32BufferAttribute(rainPos,3));rg.setAttribute('phase',new T.Float32BufferAttribute(rainSeed,1));
 const time={value:5},rainMat=new T.ShaderMaterial({uniforms:{uTime:time},transparent:true,depthWrite:false,vertexShader:`attribute float phase;uniform float uTime;void main(){vec3 p=position;p.y+=mod(phase-uTime*1.6,5.);p.x+=mod(uTime*.8,2.)*.1;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`void main(){gl_FragColor=vec4(.73,.84,.83,.16);}`});kit.materials.add(rainMat);const rain=new T.LineSegments(rg,rainMat);scene.add(rain);
 // Gutter drips are outside the bench footprint; their splashes share the time bus.
 const drops=[];for(let i=0;i<12;i++){const x=-2.1+i*.34,y=.05+random()*2.5,drop=ellipsoid([.0035,.022,.0035],[x,y,.94],steel);drop.castShadow=false;drops.push({mesh:drop,x,phase:random()*3});}
 const rippleMat=material({color:'#b3c4ba',transparent:true,opacity:.16,depthWrite:false,roughness:.3,side:T.DoubleSide}),ripples=[];for(let i=0;i<9;i++){const ring=mesh(own(new T.RingGeometry(.93,1,40)),rippleMat,[-1.8+i*.46,-.132,1.1+random()*.5],[.07,.07,.07]);ring.rotation.x=-Math.PI/2;ring.castShadow=ring.receiveShadow=false;ripples.push(ring);}
 // Merge static geometry by material while retaining UVs for cloth, signs and wood.
 const bins=new Map(),sources=[];scene.updateMatrixWorld(true);for(const group of [architecture,equipment,person])group.traverse(o=>{if(o.isMesh){let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!bins.has(o.material))bins.set(o.material,[]);bins.get(o.material).push(g);sources.push(o);}});for(const o of sources)o.removeFromParent();for(const [m,parts]of bins){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!g)throw Error('Static material geometry failed to merge');mesh(own(g),m);}
 const composer=new EffectComposer(renderer),beauty=new RenderPass(scene,camera),ao=new SSAOPass(scene,camera,1,1,12);ao.kernelRadius=.14;ao.minDistance=.0001;ao.maxDistance=.003;composer.addPass(beauty);composer.addPass(ao);const output=new OutputPass();composer.addPass(output);
 let view='work',weather='rain',playing=false,disposed=false,visible=true,frame=0,frames=0,last=0,drawMS=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),clock=new T.Clock();clock.start();
 function aim(){const narrow=host.clientWidth<760;camera.fov=view==='detail'?(narrow?39:30):narrow?42:34;camera.position.set(...(view==='detail'?[.88,1.52,1.74]:narrow?[-1.25,1.97,2.9]:[-1.5,1.85,2.6]));camera.lookAt(...(view==='detail'?[.36,1.255,.42]:narrow?[.14,1.28,.3]:[.1,1.36,.16]));camera.updateProjectionMatrix();}
 function update(t){time.value=t;for(const d of drops)d.mesh.position.y=2.5-((t*1.1+d.phase)%2.5);ripples.forEach((r,i)=>{const s=.025+((t*.45+i*.13)%1)*.12;r.scale.setScalar(s);});}
 function draw(){if(disposed)return;const start=performance.now();renderer.info.reset();composer.render();drawMS=performance.now()-start;frames++;}
 function active(){return playing&&!still&&!reduced.matches&&visible&&!document.hidden&&!disposed;}
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;}
 function tick(now){frame=0;if(!active())return;if(!last||now-last>=48){update(time.value+Math.min(clock.getDelta(),.08));draw();last=now;}frame=requestAnimationFrame(tick);}
 function reconcile(){stop();clock.getDelta();if(active())frame=requestAnimationFrame(tick);}
 function resize(){if(disposed)return;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth,host.clientHeight);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;aim();renderer.shadowMap.needsUpdate=true;draw();}
 function setView(v){if(!['work','detail'].includes(v)||disposed)return;view=v;aim();draw();}
 function setWeather(v){if(!['rain','clearing'].includes(v)||disposed)return;weather=v;rain.visible=v==='rain';drops.forEach(d=>d.mesh.visible=v==='rain');sun.intensity=v==='rain'?.8:2.8;hemi.intensity=v==='rain'?2.4:2.5;scene.environmentIntensity=.35;scene.background.set(v==='rain'?'#829a9b':'#a2b3ad');scene.fog.color.copy(scene.background);renderer.shadowMap.needsUpdate=true;draw();}
 const observer=new ResizeObserver(resize);observer.observe(host);const intersection=new IntersectionObserver(e=>{visible=e[0].isIntersecting;reconcile();});intersection.observe(host);
 const visibility=()=>reconcile();document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
 update(5);resize();setWeather('rain');
 const stats=()=>({view,weather,playing,disposed,loop:!!frame,time:time.value,frames,drawMS:Math.round(drawMS*10)/10,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),canvas:host.querySelectorAll('canvas').length,eye:camera.position.toArray(),art:'sheltered-connection',character:'native-tailored-study',externalCharacterAssets:0,wetBoundaryZ:.94});
 function destroy(){if(disposed)return;disposed=true;stop();observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);ao.dispose();output.dispose();composer.dispose();kit.dispose();env.dispose();sun.shadow.dispose();worklight.shadow.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 return{setView,setWeather,setPlaying(v){playing=!!v;reconcile();},stats,destroy};
}
