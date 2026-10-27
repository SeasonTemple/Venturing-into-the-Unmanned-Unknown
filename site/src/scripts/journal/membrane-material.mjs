import * as T from 'three';
import { reliefHeight,pixelProbe } from './relief-material.mjs';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export function createMembrane(canvas) {
  const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
  const fieldScene=new T.Scene(),paper=new T.Color('#f3f3eb');fieldScene.background=paper;
  const fieldCamera=new T.OrthographicCamera(-12,12,10,-10,.1,65);fieldCamera.position.z=25;
  const rawHeight=new Float32Array(512*308),fieldData=new Float32Array(512*308);
  for(let y=0;y<308;y++)for(let x=0;x<512;x++){
    const u=-10+x/511*20,v=-6+y/307*12;
    rawHeight[y*512+x]=reliefHeight(u,v);
  }
  function sample(x,y){x=Math.max(0,Math.min(511,x));y=Math.max(0,Math.min(307,y));const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,a=rawHeight[j*512+i],b=rawHeight[j*512+Math.min(511,i+1)],c=rawHeight[Math.min(307,j+1)*512+i],d=rawHeight[Math.min(307,j+1)*512+Math.min(511,i+1)];return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;}
  const dx=.14*511/20,dy=.14*307/12;
  for(let y=0;y<308;y++)for(let x=0;x<512;x++)fieldData[y*512+x]=(rawHeight[y*512+x]*4+sample(x+dx,y)+sample(x-dx,y)+sample(x,y+dy)+sample(x,y-dy))/8;
  const heights=new T.DataTexture(fieldData,512,308,T.RedFormat,T.FloatType);heights.minFilter=heights.magFilter=T.LinearFilter;heights.needsUpdate=true;
  const time={value:0},gap={value:.58},covered={value:1};
  const fieldMaterial=new T.ShaderMaterial({uniforms:{uHeight:{value:heights},uTime:time,uPaper:{value:paper},uInk:{value:new T.Color('#62795c')},uCopper:{value:new T.Color('#a47648')}},vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform sampler2D uHeight;uniform float uTime;uniform vec3 uPaper,uInk,uCopper;
    float stroke(float coord,float width){float d=abs(fract(coord-.5)-.5)/max(fwidth(coord),.0001);return 1.-smoothstep(width,width+1.,d);}
    float seg(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
    void main(){
      vec2 uv=vUv;float h=texture2D(uHeight,uv).r;
      float iso=stroke(h/0.34,.25),major=stroke(h/1.02,.5);
      vec2 g=uv*vec2(25.,15.);float grid=max(stroke(g.x,.1),stroke(g.y,.1));
      // A slow, bounded survey pass exposes fine lines without deforming the map.
      float pass=.5+.38*sin(uTime*.17-1.1);
      float scan=exp(-pow((uv.x+uv.y*.24-pass)/.095,2.));
      float center=1.-smoothstep(.12,.34,abs(uv.x-.51));
      float reserve=mix(1.,.36,center);
      vec3 color=mix(uPaper,uInk,reserve*(iso*.32+major*.22+grid*.075+scan*iso*.18));
      vec2 p=uv;float route=min(seg(p,vec2(.16,.29),vec2(.43,.49)),seg(p,vec2(.43,.49),vec2(.77,.65)));
      float line=1.-smoothstep(.0007,.0015,route);
      float nodes=min(length(p-vec2(.16,.29)),min(length(p-vec2(.43,.49)),length(p-vec2(.77,.65))));
      float ring=1.-smoothstep(.0005,.0015,abs(nodes-.006));
      color=mix(color,uCopper,(line*.34+ring*.65)*reserve);
      vec2 cross=abs(fract(uv*vec2(8.,5.))-.5);float plus=(1.-smoothstep(.001,.004,min(cross.x,cross.y)))*(1.-smoothstep(.035,.045,max(cross.x,cross.y)));
      color=mix(color,uInk,plus*.32);
      gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
    }`});
  const map=new T.Mesh(new T.PlaneGeometry(36,27),fieldMaterial);map.rotation.set(.34,-.16,-.31);map.position.set(-1,0,-2);fieldScene.add(map);
  const target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true,type:T.HalfFloatType});
  target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const resolution={value:new T.Vector2(1,1)};
  const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uScene:{value:target.texture},uDepth:{value:target.depthTexture},uResolution:resolution,uGap:gap,uCovered:covered,uPaper:{value:paper}},vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform sampler2D uScene,uDepth;uniform vec2 uResolution;uniform float uGap,uCovered;uniform vec3 uPaper;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec2 px=1./uResolution,uv=vUv;
      // These normals belong to a stationary sheet. Time only moves the scene beneath it.
      vec2 q=uv*vec2(uResolution.x/uResolution.y,1.)*5.;
      float nx=noise(q+vec2(.045,0.))-noise(q-vec2(.045,0.));
      float ny=noise(q+vec2(0.,.045))-noise(q-vec2(0.,.045));
      float depth=texture2D(uDepth,uv).r;
      float distance=clamp((depth-.22)/.38,0.,1.);
      vec2 bend=vec2(nx,ny)*(12.+uGap*58.)*px;
      float radius=(.5+uGap*9.)*(.16+distance*1.3);
      vec2 sampleUv=clamp(uv+bend,px*20.,1.-px*20.);
      vec3 transmission=texture2D(uScene,sampleUv).rgb*.16;
      float total=.16;
      for(int i=0;i<20;i++){
        float fi=float(i)+.5;float angle=fi*2.39996323;
        float r=sqrt(fi/20.);vec2 offset=vec2(cos(angle),sin(angle))*r*radius*px;
        float weight=exp(-r*r*1.5);
        transmission+=texture2D(uScene,clamp(sampleUv+offset,px,1.-px)).rgb*weight;total+=weight;
      }
      transmission/=total;
      // Rough transmission plus restrained reflection: keep the sheet clean, not milky grey.
      float grazing=pow(clamp(.5+nx*.8+ny*.6,0.,1.),3.);
      float fiber=noise(vec2(gl_FragCoord.x*.35,gl_FragCoord.y*.08))-.5;
      float sheen=exp(-pow((uv.x*.65+uv.y-.86)/.17,2.));
      vec3 surface=mix(transmission,uPaper,.12+grazing*.08);
      surface+=vec3(sheen*.025+fiber*.0035);
      vec3 raw=texture2D(uScene,uv).rgb;
      gl_FragColor=vec4(mix(raw,surface,uCovered),1.);
      #include <colorspace_fragment>
    }`});
  const screen=new T.Mesh(new T.PlaneGeometry(2,2),material);scene.add(screen);
  let width=1,height=1,frames=0,disposed=false;
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,1.25,1440/width));renderer.setSize(width,height,false);const dpr=renderer.getPixelRatio();target.setSize(Math.round(width*dpr),Math.round(height*dpr));resolution.value.set(width*dpr,height*dpr);const halfWidth=innerWidth<760?9:12;fieldCamera.left=-halfWidth;fieldCamera.right=halfWidth;fieldCamera.top=halfWidth*height/width;fieldCamera.bottom=-fieldCamera.top;fieldCamera.updateProjectionMatrix();}
  function render(t){if(disposed)return;time.value=t;map.position.x=-1+Math.sin(t*.13)*.75;map.position.y=Math.sin(t*.09)*.35;map.position.z=-2-gap.value*4;renderer.setRenderTarget(target);renderer.render(fieldScene,fieldCamera);renderer.setRenderTarget(null);renderer.render(scene,camera);frames++;}
  resize();
  return {resize,render,probe:t=>{render(t);return pixelProbe(renderer);},setGap:value=>{gap.value=value;},setSurface:value=>{covered.value=+value;},state:()=>({frames,gap:gap.value,covered:!!covered.value,time:time.value,width,height,renderWidth:target.width,renderHeight:target.height}),dispose(){disposed=true;map.geometry.dispose();screen.geometry.dispose();fieldMaterial.dispose();material.dispose();heights.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
