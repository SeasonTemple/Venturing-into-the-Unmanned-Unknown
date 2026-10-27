const vertex=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*vec2(.5,-.5)+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const fragment=`
precision highp float;
uniform sampler2D uArt;uniform sampler2D uMask;uniform float uTime;varying vec2 vUv;
void main(){
  vec2 pixel=vec2(1920.,1080.);vec2 p=floor(vUv*pixel)+.5;
  vec3 zones=texture2D(uMask,vUv).rgb;
  float gust=.6+.4*sin(uTime*.41-p.x*.002);
  // Bounded cloud travel preserves the painted horizon and never resets a loop.
  float cloud=32.*(1.-exp(-uTime/80.));
  vec2 shift=vec2(-cloud*zones.r,0.);
  float grass=(sin(uTime*2.1-p.x*.018)+.35*sin(uTime*3.7-p.x*.031))*gust;
  shift+=vec2(-grass*2.8,abs(grass)*.25)*zones.b;
  float ripple=sin(p.y*.21-uTime*2.3+p.x*.007);
  shift+=vec2(sin(uTime*1.5+p.y*.11)*3.5,ripple*.7)*zones.g;
  vec2 uv=(floor(p+shift)+.5)/pixel;
  vec3 color=texture2D(uArt,clamp(uv,vec2(0.),vec2(1.))).rgb;
  float glint=smoothstep(.94,1.,sin(p.y*.37-uTime*1.7+p.x*.008));
  color+=zones.g*glint*vec3(.025,.022,.012);
  gl_FragColor=vec4(color,1.);
}`;

export async function createMeadowMotion({canvas,art,maskUrl,onState}){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false});
  if(!gl)throw Error('WebGL unavailable');
  const textures=[],shaders=[];
  let buffer,program,raf=0,destroyed=false,lost=false,running=false,userPaused=false,visible=true,inView=true;
  let elapsed=0,last=0,lastDraw=-Infinity,frames=0,totalDrawMs=0,maxDrawMs=0;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const compile=(type,source)=>{const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const notify=()=>onState?.({running,userPaused,reduced:reduce.matches,lost,frames,elapsed,buffer:[canvas.width,canvas.height]});
  const stats=()=>({running,userPaused,reduced:reduce.matches,inView,visible,lost,frames,elapsed,drawsPerFrame:1,textureCount:textures.length,buffer:[canvas.width,canvas.height],averageSubmitMs:frames?totalDrawMs/frames:0,maxSubmitMs:maxDrawMs});
  try{
    const mask=new Image();mask.src=maskUrl;
    await Promise.all([art.decode(),mask.decode()]);
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    for(const [unit,img,name]of[[0,art,'uArt'],[1,mask,'uMask']]){
      const texture=gl.createTexture();textures.push(texture);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform1i(gl.getUniformLocation(program,name),unit);
    }
  }catch(error){textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);throw error;}
  const time=gl.getUniformLocation(program,'uTime');
  const draw=()=>{
    if(destroyed||lost)return;
    const start=performance.now();gl.uniform1f(time,elapsed);gl.drawArrays(gl.TRIANGLES,0,6);
    const ms=performance.now()-start;totalDrawMs+=ms;maxDrawMs=Math.max(maxDrawMs,ms);frames++;
  };
  const tick=now=>{
    raf=0;if(!running||destroyed||lost)return;
    if(now-lastDraw>=1000/24){elapsed+=Math.min((now-last)/1000,.1);last=now;lastDraw=now;draw();}
    raf=requestAnimationFrame(tick);
  };
  const sync=()=>{
    const next=!destroyed&&!lost&&!userPaused&&!reduce.matches&&visible&&inView&&!document.body.hasAttribute('data-search-modal-open');
    if(next!==running){running=next;if(raf)cancelAnimationFrame(raf);raf=0;if(next){last=performance.now();lastDraw=-Infinity;raf=requestAnimationFrame(tick);}notify();}
    else notify();
  };
  const resize=()=>{
    const box=canvas.getBoundingClientRect();if(box.width===0)return;
    const width=Math.min(1440,Math.max(480,Math.round(box.width/16)*16)),height=Math.round(width*9/16);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);draw();}
  };
  const onVisibility=()=>{visible=document.visibilityState==='visible';sync();};
  const onReduced=()=>sync();
  const onLost=event=>{event.preventDefault();lost=true;canvas.classList.remove('ready');sync();};
  const onRestored=()=>{onState?.({...stats(),reloadRequired:true});};
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.02});observer.observe(canvas);
  const searchObserver=new MutationObserver(sync);searchObserver.observe(document.body,{attributes:true,attributeFilter:['data-search-modal-open']});
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
    destroy(){destroyed=true;sync();resizeObserver.disconnect();observer.disconnect();searchObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduce.removeEventListener('change',onReduced);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);textures.forEach(t=>gl.deleteTexture(t));shaders.forEach(s=>gl.deleteShader(s));gl.deleteBuffer(buffer);gl.deleteProgram(program);canvas.classList.remove('ready');}
  };
}
