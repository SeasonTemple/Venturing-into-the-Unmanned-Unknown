const vertex=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*vec2(.5,-.5)+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`
precision highp float;
uniform sampler2D uArt;uniform sampler2D uMask;uniform sampler2D uSky;uniform float uTime;varying vec2 vUv;
void main(){
  vec2 pixel=vec2(1920.,1080.);vec2 p=floor(vUv*pixel)+.5;
  vec3 zones=texture2D(uMask,vUv).rgb;
  bool vane=p.x>=1400.&&p.x<=1580.&&p.y>=218.&&p.y<=318.;
  bool machine=p.x>=1709.&&p.x<=1748.&&p.y>=790.&&p.y<=837.;
  if(max(zones.r,max(zones.g,zones.b))<.001&&!vane&&!machine){gl_FragColor=vec4(0.);return;}
  float gust=.6+.4*sin(uTime*.41-p.x*.002);
  vec2 shift=vec2(0.);
  float grass=(sin(uTime*2.1-p.x*.018)+.35*sin(uTime*3.7-p.x*.031))*gust;
  shift+=vec2(-grass*4.2,abs(grass)*.25)*zones.b;
  vec2 uv=(p+shift)/pixel;
  vec3 color=texture2D(uArt,clamp(uv,vec2(0.),vec2(1.))).rgb;
  // A separate seamless sky travels east, behind stationary occluders.
  float skyX=mod(vUv.x*1920.-uTime*6.,3840.);
  vec2 skyUv=vec2(min(skyX,3840.-skyX)/1920.,vUv.y*1080./576.);
  color=mix(color,texture2D(uSky,skyUv).rgb,zones.r);
  float alpha=max(zones.r,max(zones.g,zones.b));
  // Moving broken reflections stay inside the painted water mask. Never shift
  // the shoreline or overwrite it with a lower-resolution displaced copy.
  if(zones.g>.001){
    vec2 ripplePixel=floor(p/vec2(3.,2.))*vec2(3.,2.);
    float wave=sin(ripplePixel.y*.28+ripplePixel.x*.016-uTime*1.8);
    float broken=.5+.5*sin(ripplePixel.x*.085+ripplePixel.y*.04+uTime*.8);
    float crest=smoothstep(.35,.93,wave)*broken;
    color=vec3(.98,1.,.86);
    alpha=zones.g*crest*.65;
  }
  // The wind vane is a rigid fin, not cloth. Yaw changes its projected width;
  // the smaller anemometer above it revolves independently around its mast.
  if(vane){
    vec2 q=p;
    bool rotor=p.x>=1528.&&p.y<280.;
    float width=rotor?(.22+.78*abs(cos(uTime*2.6))):(.78+.20*sin(uTime*.85));
    q.x=1548.+(p.x-1548.)/width;
    vec2 source=q/pixel;
    float silhouette=step(.75,texture2D(uMask,source).a);
    if(rotor&&q.x<1528.)silhouette=0.;
    color=mix(color,texture2D(uArt,source).rgb,silhouette);
    alpha=1.;
  }
  // Daylight keeps the original painted lamp steady. Task lighting needs a
  // separately authored evening scene, not a pulse applied to the day painting.
  if(p.x>=1736.&&p.x<=1748.&&p.y>=790.&&p.y<=799.){
    float scan=step(.72,fract(uTime/2.4));
    color=mix(color,vec3(.36,.82,.64),.28+.55*scan);alpha=1.;
  }
  if(p.x>=1709.&&p.x<=1715.&&p.y>=832.&&p.y<=837.){
    color=mix(vec3(.25,.24,.11),vec3(1.,.64,.19),step(.86,fract(uTime/3.2)));alpha=1.;
  }
  gl_FragColor=vec4(color,alpha);
}`;

export async function createMeadowMotion({canvas,art,maskUrl,skyUrl,onState,signal}){
  signal?.throwIfAborted();
  const mask=new Image(),sky=new Image();let onAbort;
  try{
    mask.src=maskUrl;sky.src=skyUrl;
    const decoded=Promise.all([art.decode(),mask.decode(),sky.decode()]);
    if(signal){
      const aborted=new Promise((_,reject)=>{onAbort=()=>{mask.removeAttribute('src');sky.removeAttribute('src');reject(signal.reason);};signal.addEventListener('abort',onAbort,{once:true});});
      await Promise.race([decoded,aborted]);
    }else await decoded;
    signal?.throwIfAborted();
  }finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
  // No WebGL context or GPU allocations until all images are decoded and still wanted.
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false});
  if(!gl)throw Error('WebGL unavailable');
  const textures=[],shaders=[];
  let buffer,program,raf=0,destroyed=false,lost=false,running=false,userPaused=false,visible=true,inView=true;
  let elapsed=0,last=0,nextDraw=0,frames=0,totalDrawMs=0,maxDrawMs=0,lastPresented=0;
  const frameIntervals=[];let frameInterval=1000/30,maxWidth=1152,quality='balanced',slowFrames=0,adaptationFrames=0;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const notify=()=>onState?.({running,userPaused,reduced:reduce.matches,lost,frames,elapsed,buffer:[canvas.width,canvas.height]});
  const stats=()=>({running,destroyed,userPaused,reduced:reduce.matches,inView,visible,lost,frames,elapsed,targetFps:1000/frameInterval,quality,observedFps:frameIntervals.length?1000/(frameIntervals.reduce((a,b)=>a+b,0)/frameIntervals.length):0,p95FrameMs:frameIntervals.length?[...frameIntervals].sort((a,b)=>a-b)[Math.floor(frameIntervals.length*.95)]:0,cloudDirection:'east',cloudPhasePx:elapsed*6%3840,drawsPerFrame:1,textureCount:textures.length,transparent:true,buffer:[canvas.width,canvas.height],averageSubmitMs:frames?totalDrawMs/frames:0,maxSubmitMs:maxDrawMs});
  try{
    const maxTexture=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if([art,mask,sky].some(img=>img.naturalWidth>maxTexture||img.naturalHeight>maxTexture))throw Error('Scene textures exceed this device limit');
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    for(const [unit,img,name]of[[0,art,'uArt'],[1,mask,'uMask'],[2,sky,'uSky']]){
      const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const filter=name==='uMask'?gl.NEAREST:gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform1i(gl.getUniformLocation(program,name),unit);
    }
  }catch(error){textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);throw error;}
  const time=gl.getUniformLocation(program,'uTime');
  const draw=()=>{
    if(destroyed||lost)return;
    const start=performance.now();gl.uniform1f(time,elapsed);gl.drawArrays(gl.TRIANGLES,0,6);
    const ms=performance.now()-start;totalDrawMs+=ms;maxDrawMs=Math.max(maxDrawMs,ms);frames++;
    if(running){if(lastPresented){const interval=start-lastPresented;frameIntervals.push(interval);if(frameIntervals.length>120)frameIntervals.shift();slowFrames+=Number(interval>frameInterval*1.35);adaptationFrames++;}lastPresented=start;}
  };
  const tick=now=>{
    raf=0;if(!running||destroyed||lost)return;
    elapsed+=Math.min((now-last)/1000,.1);last=now;
    if(now+.25>=nextDraw){draw();nextDraw+=frameInterval;if(nextDraw<now-frameInterval)nextDraw=now+frameInterval;}
    if(adaptationFrames>=90){
      if(slowFrames>22&&maxWidth>896){maxWidth=896;quality='reduced';resize();}
      else if(slowFrames>30&&quality==='reduced'){frameInterval=1000/24;quality='economy';}
      adaptationFrames=0;slowFrames=0;
    }
    raf=requestAnimationFrame(tick);
  };
  const sync=()=>{
    const next=!destroyed&&!lost&&!userPaused&&!reduce.matches&&visible&&inView&&!document.body.hasAttribute('data-search-modal-open')&&!canvas.closest('.landscape')?.hasAttribute('data-notebook-open');
    if(next!==running){running=next;lastPresented=0;if(raf)cancelAnimationFrame(raf);raf=0;if(next){last=performance.now();nextDraw=last;raf=requestAnimationFrame(tick);}notify();}
    else notify();
  };
  const resize=()=>{
    const box=canvas.getBoundingClientRect();if(box.width===0)return;
    const width=Math.min(maxWidth,Math.max(480,Math.round(box.width/16)*16)),height=Math.round(width*9/16);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);draw();}
  };
  const onVisibility=()=>{visible=document.visibilityState==='visible';sync();};
  const onReduced=()=>sync();
  const onLost=event=>{event.preventDefault();lost=true;canvas.classList.remove('ready');sync();};
  const onRestored=()=>{onState?.({...stats(),reloadRequired:true});};
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.02});observer.observe(canvas);
  const searchObserver=new MutationObserver(sync);searchObserver.observe(document.body,{attributes:true,attributeFilter:['data-search-modal-open']});
  const notebookObserver=new MutationObserver(sync);notebookObserver.observe(canvas.closest('.landscape'),{attributes:true,attributeFilter:['data-notebook-open']});
  document.addEventListener('visibilitychange',onVisibility);reduce.addEventListener('change',onReduced);
  canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
  visible=document.visibilityState==='visible';resize();draw();canvas.classList.add('ready');sync();
  return{
    stats,
    pause(value){userPaused=value;sync();},
    sample(value){if(!userPaused)throw Error('Pause before sampling');elapsed=value;draw();},
    setArtwork(image){
      if(destroyed||lost)return;
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[0]);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);draw();
    },
    destroy(){if(destroyed)return;destroyed=true;sync();resizeObserver.disconnect();observer.disconnect();searchObserver.disconnect();notebookObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduce.removeEventListener('change',onReduced);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));textures.length=0;gl.deleteBuffer(buffer);gl.deleteProgram(program);canvas.classList.remove('ready');canvas.width=canvas.height=1;}
  };
}
