import * as T from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const noise = new ImprovedNoise();
const smooth = (a,b,x) => { const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t); };
const n = (x,z) => noise.noise(x,z,3.71);
export const reliefBoundary = z => 2.5+.7*Math.sin(z*.68)+.25*Math.sin(z*1.7);
const boundaryGLSL=`float surveyBank(float z){return 2.5+.7*sin(z*.68)+.25*sin(z*1.7);}`;

// Surface and shadow passes use the same material boundary. Darkness alone is not unknown.
function surveyVisibility(shader){
  shader.vertexShader='varying vec3 vSurvey;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurvey=position;');
  shader.fragmentShader='varying vec3 vSurvey;\n'+boundaryGLSL+'\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`diffuseColor.a*=1.-smoothstep(surveyBank(vSurvey.z)-.85,surveyBank(vSurvey.z)+.05,vSurvey.x);
    #include <alphatest_fragment>`);
}
export function reliefHeight(x,z) {
  // A continuous, branching ridge field. The geometry stays fixed under moving light.
  const wx=x+1.5*n(x*.19+6,z*.19), wz=z+1.2*n(x*.21,z*.21+8);
  let ridge=0,amp=1,freq=.22,weight=1;
  for(let i=0;i<5;i++) {
    let r=Math.max(0,1-Math.abs(n(wx*freq+11,wz*freq+4))*1.8);r*=r;
    ridge+=r*amp*weight;weight=T.MathUtils.clamp(r*1.8,0,1);freq*=2.12;amp*=.48;
  }
  const spine=Math.exp(-(((wz+1.1-Math.sin(wx*.34)*1.6)/3.25)**2));
  const reach=Math.exp(-(((x+1)/9.7)**4));
  const edge=smooth(0,2.1,10-Math.abs(x))*smooth(0,1.8,6-Math.abs(z));
  return .08+edge*(.22+ridge*2.3)*(.30+spine*.9)*reach;
}

export function mineralTexture() {
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    // Periodic detail makes the wrap seam continuous.
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    const a=noise.noise(Math.cos(u)*5,Math.sin(u)*5,Math.cos(v)*5+Math.sin(v)*3);
    const b=noise.noise(Math.cos(u)*17,Math.sin(u)*17,Math.cos(v)*17+Math.sin(v)*11);
    const shade=Math.round(128+a*66+b*24),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;
  }
  const tex=new T.DataTexture(data,size,size);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.repeat.set(9,5);tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;
  return tex;
}

export function createRelief(canvas) {
  const compact=canvas.clientWidth<760;
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1.25:1.5,1920/canvas.clientWidth));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#101d21');scene.fog=new T.Fog('#101d21',40,85);
  const camera=new T.OrthographicCamera(-16,16,9,-9,.1,100);
  camera.position.set(12,15.5,19);camera.lookAt(0,.55,0);
  const room=new RoomEnvironment();const pmrem=new T.PMREMGenerator(renderer);
  const env=pmrem.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.075;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight('#a9c9d3','#1a2726',.26));
  const sun=new T.DirectionalLight('#fff0d9',4.6);sun.castShadow=true;
  sun.shadow.mapSize.set(compact?1024:2048,compact?1024:2048);sun.shadow.autoUpdate=false;Object.assign(sun.shadow.camera,{left:-15,right:15,top:12,bottom:-12,near:.5,far:50});sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;sun.shadow.radius=2;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(0,0,0);scene.add(sun,sun.target);
  const floorMaterial=new T.ShadowMaterial({color:'#000000',opacity:.22});
  floorMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vReceiver;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvReceiver=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 vReceiver;\n'+boundaryGLSL+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`gl_FragColor.a*=1.-smoothstep(surveyBank(vReceiver.z)-1.3,surveyBank(vReceiver.z),vReceiver.x);
      #include <tonemapping_fragment>`);
  };
  const floor=new T.Mesh(new T.PlaneGeometry(150,150),floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.43;floor.receiveShadow=true;scene.add(floor);
  const nx=compact?160:224,nz=compact?96:134,positions=[],uvs=[],indices=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=-10+20*i/nx,z=-6+12*j/nz;positions.push(x,reliefHeight(x,z),z);uvs.push(i/nx,j/nz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=-10+20*i/nx,z=-6+12*j/nz;
    // Reject cells beyond the material boundary before they enter any GPU pass.
    if(x>Math.max(reliefBoundary(z),reliefBoundary(z+12/nz))+.15)continue;
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
  const detail=mineralTexture(),grid={value:1};
  const mat=new T.MeshStandardMaterial({color:'#3f5550',roughness:.7,metalness:0,bumpMap:detail,bumpScale:.065,alphaHash:true});
  mat.onBeforeCompile=shader=>{
    surveyVisibility(shader);
    shader.uniforms.uSurveyGrid=grid;
    shader.fragmentShader='uniform float uSurveyGrid;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 field=vSurvey.xz/0.8;
      vec2 d=abs(fract(field-.5)-.5)/max(fwidth(field),vec2(.0001));
      float line=1.-smoothstep(.35,1.05,min(d.x,d.y));
      float contour=abs(fract(vSurvey.y/0.44-.5)-.5)/max(fwidth(vSurvey.y/0.44),.0001);
      float iso=1.-smoothstep(.3,.95,contour);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.33,.44,.35),uSurveyGrid*line*.19);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.08,.15,.13),uSurveyGrid*iso*.14);`);
  };
  const depthMat=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,alphaHash:true});depthMat.onBeforeCompile=surveyVisibility;
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=depthMat;scene.add(mesh);
  // A thin, solid relief edge gives the mountain a material base, rather than a floating sheet.
  const perimeter=[];
  for(let i=0;i<=nx;i++)perimeter.push([-10+20*i/nx,-6]);
  for(let j=1;j<=nz;j++)perimeter.push([10,-6+12*j/nz]);
  for(let i=nx-1;i>=0;i--)perimeter.push([-10+20*i/nx,6]);
  for(let j=nz-1;j>=0;j--)perimeter.push([-10,-6+12*j/nz]);
  const edge=[];for(let i=0;i<perimeter.length;i++){const [x,z]=perimeter[i],[u,v]=perimeter[(i+1)%perimeter.length];if(Math.min(x,u)>Math.max(reliefBoundary(z),reliefBoundary(v))+.15)continue;edge.push(x,reliefHeight(x,z),z,u,reliefHeight(u,v),v,x,-.39,z,u,reliefHeight(u,v),v,u,-.39,v,x,-.39,z);}
  const edgeGeo=new T.BufferGeometry();edgeGeo.setAttribute('position',new T.Float32BufferAttribute(edge,3));edgeGeo.computeVertexNormals();
  const edgeMaterial=new T.MeshStandardMaterial({color:'#3c4b45',roughness:.91,side:T.DoubleSide,alphaHash:true});edgeMaterial.onBeforeCompile=surveyVisibility;
  const edgeMesh=new T.Mesh(edgeGeo,edgeMaterial);edgeMesh.customDepthMaterial=depthMat;edgeMesh.castShadow=edgeMesh.receiveShadow=true;scene.add(edgeMesh);
  const route=[];
  for(let i=0;i<=170;i++){const x=-8+i/170*10.4,z=2.5-Math.sin((x+3)*.29)*1.25;route.push(new T.Vector3(x,reliefHeight(x,z)+.045,z));}
  const routeGeo=new T.BufferGeometry().setFromPoints(route),routeMat=new T.LineBasicMaterial({color:'#d9b181',transparent:true,opacity:.8});scene.add(new T.Line(routeGeo,routeMat));
  const anchor=route[100].clone();
  const markerMat=new T.MeshStandardMaterial({color:'#d5ab73',roughness:.4,metalness:.55});
  const pin=new T.Mesh(new T.CylinderGeometry(.026,.04,.23,12),markerMat);pin.position.copy(anchor).add(new T.Vector3(0,.1,0));pin.castShadow=true;scene.add(pin);
  const ring=new T.Mesh(new T.TorusGeometry(.13,.016,8,40),markerMat);ring.rotation.x=-Math.PI/2;ring.position.copy(anchor).add(new T.Vector3(0,.025,0));scene.add(ring);
  // A projected strip of real light crosses the relief; mountains can occlude it.
  const apertureData=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const cross=Math.abs((x/127-.5)*2),along=Math.abs((y/127-.5)*2);
    const value=Math.round(255*(1-smooth(.18,.49,cross))*(1-smooth(.65,1,along))),i=(y*128+x)*4;
    apertureData[i]=apertureData[i+1]=apertureData[i+2]=value;apertureData[i+3]=255;
  }
  const aperture=new T.DataTexture(apertureData,128,128);aperture.needsUpdate=true;aperture.magFilter=aperture.minFilter=T.LinearFilter;
  const local=new T.SpotLight('#ffd19a',330,22,.65,.5,2);local.map=aperture;local.castShadow=true;local.shadow.autoUpdate=false;local.shadow.mapSize.set(compact?512:1024,compact?512:1024);local.shadow.normalBias=.025;local.shadow.bias=-.0002;scene.add(local,local.target);
  const clues=[],clueColors=[],segments=[],segmentColors=[];
  for(let row=0;row<25;row++){
    const z=-5.7+row*.47,bank=reliefBoundary(z),boundaryHeight=reliefHeight(bank,z);
    // Only short, disconnected traces survive beyond the last resolved surface.
    for(let col=0;col<4;col++){
      if(n(row*2.3,col*1.7)>.12)continue;
      const x=bank+.16+col*.39,y=boundaryHeight*(1-col*.13)+.1;
      for(const k of [0,1]){segments.push(x+k*.20,y+k*.025,z);const c=new T.Color('#729fa4').multiplyScalar(.5-col*.08);segmentColors.push(c.r,c.g,c.b);}
    }
    for(let col=0;col<19;col++){
      const x=bank+.35+col*.37,random=(n(col*3.7+9,row*2.6)+1)*.5;
      if(x>10||random<.27+col*.021)continue;
      // These are unconnected hints, deliberately not the completed height field.
      const y=.3+random*1.7+Math.max(0,1-(x-bank)/2.2)*boundaryHeight*.6;
      clues.push(x,y,z+n(row,col)*.35);const c=new T.Color(col<5?'#95b9b9':'#6d879c');clueColors.push(c.r,c.g,c.b);
    }
  }
  const surveyTime={value:0},pointRatio={value:renderer.getPixelRatio()};
  const traceGeo=new T.BufferGeometry();traceGeo.setAttribute('position',new T.Float32BufferAttribute(segments,3));traceGeo.setAttribute('color',new T.Float32BufferAttribute(segmentColors,3));
  const traceMaterial=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.62,depthWrite:false});
  traceMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uTraceTime=surveyTime;
    shader.vertexShader='uniform float uTraceTime;varying float vTracePhase;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vTracePhase=position.z*.6+position.x*.3;
      transformed.x+=.12*sin(uTraceTime*.35+position.z*.4);
      transformed.y+=.08*sin(uTraceTime*.4+position.z*.5);`);
    shader.fragmentShader='uniform float uTraceTime;varying float vTracePhase;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=.72+.22*sin(vTracePhase+uTraceTime*.5);');
  };
  traceGeo.computeBoundingSphere();traceGeo.boundingSphere.radius+=.3;
  scene.add(new T.LineSegments(traceGeo,traceMaterial));
  const clueGeo=new T.BufferGeometry();clueGeo.setAttribute('position',new T.Float32BufferAttribute(clues,3));clueGeo.setAttribute('color',new T.Float32BufferAttribute(clueColors,3));
  clueGeo.computeBoundingSphere();clueGeo.boundingSphere.radius+=.5;
  const clueMaterial=new T.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,uniforms:{uTime:surveyTime,uDPR:pointRatio},vertexShader:`uniform float uTime,uDPR;varying vec3 vColor;varying float vAlpha;void main(){
    vColor=color;vAlpha=.42+.2*sin(position.x*.7+position.z+uTime*.42);
    vec3 p=position;p.x+=.26*sin(uTime*.34+position.z*.45);p.y+=.16*sin(uTime*.4+position.x*.9);p.z+=.12*cos(uTime*.3+position.x*.6);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=uDPR*(1.7+.5*sin(position.z*3.));}`,fragmentShader:`varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColor,vAlpha*(1.-smoothstep(.2,.5,d)));
    #include <colorspace_fragment>
  }`});scene.add(new T.Points(clueGeo,clueMaterial));
  let width=1,height=1,angle=-48,frames=0,disposed=false,currentTime=0,localEnabled=true,lastShadowTime=-1;
  const focus=new T.Vector3(),lightOffset=new T.Vector3(-3.5,4.7,3),aimOffset=new T.Vector3(.65,0,-.7),unknownCenter=new T.Vector3(7.2,1.1,-.2);
  const labels=[['landmark',anchor],['unknown-marker',new T.Vector3(7.5,2,-2.7)]].map(([id,point])=>({element:document.getElementById(id),point}));
  const shadowUpdates={sun:0,local:0};
  function setLight(degrees){angle=degrees;const rad=degrees*Math.PI/180;sun.position.set(Math.sin(rad)*15,4.9,Math.cos(rad)*15);sun.shadow.needsUpdate=true;}
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1.25:1.5,1920/width));pointRatio.value=renderer.getPixelRatio();renderer.setSize(width,height,false);const span=innerWidth<760?27:32;camera.left=-span/2;camera.right=span/2;camera.top=span/2*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();camera.updateMatrixWorld();for(const {element,point} of labels){if(!element)continue;const p=point.clone().project(camera);element.style.left=(p.x*.5+.5)*width+'px';element.style.top=(-p.y*.5+.5)*height+'px';}}
  function render(t=currentTime){
    if(disposed)return;currentTime=t;surveyTime.value=t;
    const along=100+Math.sin(t*.26)*34,index=Math.floor(along);focus.copy(route[index]).lerp(route[index+1],along-index);
    local.position.copy(focus).add(lightOffset);local.target.position.copy(focus).add(aimOffset);local.intensity=localEnabled?330:0;
    if(localEnabled&&t!==lastShadowTime){local.shadow.needsUpdate=true;lastShadowTime=t;}
    if(sun.shadow.needsUpdate)shadowUpdates.sun++;
    if(local.shadow.needsUpdate)shadowUpdates.local++;
    renderer.render(scene,camera);frames++;
  }
  setLight(angle);resize();
  function probe(){render();return pixelProbe(renderer);}
  function shadowCoverage(){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],p=new T.Vector3();
    for(let i=0;i<positions.length;i+=24){p.set(positions[i],positions[i+1],positions[i+2]).project(sun.shadow.camera);[p.x,p.y,p.z].forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});}
    return {min,max,projectionScale:sun.shadow.camera.projectionMatrix.elements[0]};
  }
  return {resize,render,probe,probeUnknown:()=>{render();return pixelProbe(renderer,unknownCenter.clone().project(camera));},setLight,setGrid:value=>{grid.value=+value;},setLocal:value=>{localEnabled=value;if(value){local.shadow.needsUpdate=true;lastShadowTime=-1;}},state:()=>({frames,time:currentTime,angle,grid:!!grid.value,local:localEnabled,compact,pixelRatio:renderer.getPixelRatio(),surfaceTriangles:indices.length/3,shadowUpdates:{...shadowUpdates},unknown:{samples:clues.length/3,traces:segments.length/6,boundary:reliefBoundary(0)},shadowCoverage:shadowCoverage(),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries}),dispose(){disposed=true;scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [o.material].flat())m.dispose();});depthMat.dispose();aperture.dispose();detail.dispose();env.dispose();sun.shadow.dispose();local.shadow.dispose();renderer.dispose();renderer.forceContextLoss();}};
}

// Synchronous framebuffer samples for render verification, without saving screenshots.
export function pixelProbe(renderer,center){
  const gl=renderer.getContext(),w=Math.min(192,gl.drawingBufferWidth),h=Math.min(192,gl.drawingBufferHeight),data=new Uint8Array(w*h*4);
  const x=center?Math.max(0,Math.min(gl.drawingBufferWidth-w,Math.floor((center.x*.5+.5)*gl.drawingBufferWidth-w/2))):Math.floor((gl.drawingBufferWidth-w)/2);
  const y=center?Math.max(0,Math.min(gl.drawingBufferHeight-h,Math.floor((center.y*.5+.5)*gl.drawingBufferHeight-h/2))):Math.floor((gl.drawingBufferHeight-h)/2);
  gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
  let hash=2166136261,sum=0;for(let i=0;i<data.length;i+=4){hash=Math.imul(hash^data[i],16777619);hash=Math.imul(hash^data[i+1],16777619);sum+=data[i]+data[i+1]+data[i+2];}
  return {hash:hash>>>0,mean:sum/(w*h*3),width:w,height:h};
}
