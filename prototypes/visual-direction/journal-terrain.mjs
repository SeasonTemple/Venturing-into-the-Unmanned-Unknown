import * as T from '/deps/three/build/three.module.js';

// A finite survey: the mesh gives way to samples, never a fabricated probability map.
export function createJournalTerrain(figure) {
  const fallback = figure.querySelector(':scope > svg');
  const viewport = document.createElement('div'); viewport.className = 'terrain-view';
  viewport.setAttribute('role','img'); viewport.setAttribute('aria-label','三维测绘地形：网格峰谷中的证据路径，在边界之外逐渐散为稀疏粒子。示意图，不是实际验证结果。');
  fallback.before(viewport); viewport.append(fallback);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', {alpha:true, antialias:true, powerPreference:'low-power'});
  if (!context) { viewport.before(fallback); viewport.remove(); return null; }
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch { context.getExtension('WEBGL_lose_context')?.loseContext(); viewport.before(fallback); viewport.remove(); return null; }
  canvas.setAttribute('aria-hidden','true'); viewport.prepend(canvas);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.setClearColor(0x10212b,1);
  const paper = new T.Color('#10212b'), ink = new T.Color('#60bfc4'), copper = new T.Color('#f0bc7b');
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-14,14,7,-7,.1,90);
  const group = new T.Group(); scene.add(group);
  const resources = new Set();
  const geometry = (positions, colors) => { const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(positions,3)); if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3)); resources.add(g); return g; };
  const material = value => { resources.add(value); return value; };
  // One displacement field keeps the surface, survey lines and samples together.
  const time={value:0};
  const wave=(x,z,t)=>.25*Math.sin(x*.62+z*.88-t*.85)+.16*Math.sin(x*.31-z*.54+t*.57);
  const waveGLSL=`uniform float uTime;
    float surveyWave(vec3 p){return .25*sin(p.x*.62+p.z*.88-uTime*.85)+.16*sin(p.x*.31-p.z*.54+uTime*.57);}`;
  function waving(value){
    value.onBeforeCompile=shader=>{shader.uniforms.uTime=time;shader.vertexShader=waveGLSL+'\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += surveyWave(position);');};
    value.customProgramCacheKey=()=> 'survey-wave-v1';return material(value);
  }
  const height = (x,z) => .13*Math.sin(x*.8+z*.5) + 3.4*Math.exp(-((x+5.3)**2/10+(z+.7)**2/8)) + 2.5*Math.exp(-((x-.3)**2/6+(z-2.8)**2/5)) + 3.0*Math.exp(-((x-6.7)**2/10+(z+1.5)**2/6)) - .4;
  const boundary = z => 2.6 + .7*Math.sin(z*.75) + .25*Math.sin(z*2.1);
  const point = (x,z,lift=0) => new T.Vector3(x,height(x,z)+lift,z);
  const sample = (i,j) => Math.abs(Math.sin(i*127.1+j*311.7)*43758.5453)%1;
  const grid=[], colors=[], fill=[], dots=[], dotColors=[];
  const nx=64,nz=36,stepX=20/nx,stepZ=11/nz;
  function segment(a,b) {
    for(const p of [a,b]) { grid.push(p.x,p.y+.018,p.z); const edge=Math.max(0,(Math.abs(p.x)-8.5)/2,(Math.abs(p.z)-4.3)/1.5); const c=ink.clone().lerp(paper,Math.min(.94,.22+edge*.75)); colors.push(c.r,c.g,c.b); }
  }
  for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++) {
    const x=-10+i*stepX,z=-5.5+j*stepZ,b=boundary(z),known=x<b;
    if(known) {
      if(i<nx && x+stepX<boundary(z))segment(point(x,z),point(x+stepX,z));
      if(j<nz && x<boundary(z+stepZ))segment(point(x,z),point(x,z+stepZ));
      if(i<nx && j<nz && x+stepX<Math.min(b,boundary(z+stepZ))) {
        const a=point(x,z),c=point(x+stepX,z),d=point(x,z+stepZ),e=point(x+stepX,z+stepZ);
        for(const p of [a,d,c,c,d,e])fill.push(p.x,p.y,p.z);
        if((i+j)%5===0)segment(c,d);
      }
    }
    const chance = known ? .09 : Math.max(.18,.78-(x-b)*.07);
    if(sample(i,j)<chance) {
      const p=point(x+(sample(j,i)-.5)*.10,z,.04+(known?0:sample(i+9,j)*.18)); dots.push(p.x,p.y,p.z);
      const c=new T.Color(known?'#8cddd5':sample(j+7,i)>.52?'#799af1':'#b09be8').lerp(paper,known?.05:Math.min(.48,(x-b)*.045)); dotColors.push(c.r,c.g,c.b);
    }
  }
  group.add(new T.Mesh(geometry(fill),waving(new T.MeshBasicMaterial({color:'#173440',transparent:true,opacity:.58,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}))));
  group.add(new T.LineSegments(geometry(grid,colors),waving(new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65}))));
  const pointDPR={value:1};
  group.add(new T.Points(geometry(dots,dotColors),material(new T.ShaderMaterial({
    uniforms:{uTime:time,uDPR:pointDPR},vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`${waveGLSL}
      uniform float uDPR; varying vec3 vColor; varying float vPulse;
      void main(){vColor=color; vPulse=.72+.28*sin(uTime*.9+position.x*.5+position.z);
        vec3 p=position; p.y+=surveyWave(p);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=(3.8+1.5*vPulse)*uDPR;}`,
    fragmentShader:`varying vec3 vColor;varying float vPulse;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float a=(1.-smoothstep(.05,1.,r))*.78*vPulse;gl_FragColor=vec4(vColor,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }))));
  function terrainPath(stops, samples=100) {
    const curve = new T.CatmullRomCurve3(stops.map(([x,z])=>new T.Vector3(x,0,z)),false,'catmullrom',.25);
    return Array.from({length:samples+1},(_,i)=>{ const p=curve.getPoint(i/samples); return point(p.x,p.z,.10); });
  }
  const anchors=[[-7.8,2.5],[-3.2,1.5],[1.8,-1.8]];
  const routePoints=terrainPath([anchors[0],[-5.4,1.9],anchors[1],[-.7,-.1],anchors[2]]);
  const route=new T.Line(new T.BufferGeometry().setFromPoints(routePoints),waving(new T.LineBasicMaterial({color:copper})));
  resources.add(route.geometry); group.add(route);
  const unknown=new T.Line(new T.BufferGeometry().setFromPoints(terrainPath([anchors[2],[4.5,-2.5],[7,.3],[9.8,-2]])),waving(new T.LineDashedMaterial({color:copper,dashSize:.16,gapSize:.17,transparent:true,opacity:.72})));
  resources.add(unknown.geometry); unknown.computeLineDistances(); group.add(unknown);
  const edgePoints=Array.from({length:80},(_,i)=>{const z=-5.3+i/79*10.6;return point(boundary(z),z,.05);});
  const edge=new T.Line(new T.BufferGeometry().setFromPoints(edgePoints),waving(new T.LineDashedMaterial({color:ink,dashSize:.13,gapSize:.19,transparent:true,opacity:.65})));
  resources.add(edge.geometry); edge.computeLineDistances(); group.add(edge);
  const labels=anchors.map(([x,z],i)=>{
    const p=point(x,z,.15); const sphere=new T.SphereGeometry(.07,10,8); resources.add(sphere);
    const marker=new T.Mesh(sphere,material(new T.MeshBasicMaterial({color:copper})));marker.position.copy(p);group.add(marker);
    const ring=new T.RingGeometry(.13,.145,32);resources.add(ring);const beacon=new T.Mesh(ring,material(new T.MeshBasicMaterial({color:copper,side:T.DoubleSide})));beacon.rotation.x=-Math.PI/2;beacon.position.copy(p);group.add(beacon);
    const el=document.createElement('span');el.className='terrain-label';el.textContent=['意图','模型','证据'][i];viewport.append(el);return {el,p,marker,beacon};
  });
  const unknownLabel=document.createElement('span');unknownLabel.className='terrain-unknown-label';unknownLabel.textContent='尚未测绘';viewport.append(unknownLabel);
  const register=document.createElement('span');register.className='terrain-register';register.textContent='FIG. 03 / A PARTIAL SURVEY';viewport.append(register);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const stats={frames:0,time:0,calls:0,triangles:0,points:dots.length/3,geometries:0,textures:0,pixelRatio:1,visible:true,disposed:false,mode:'reading'};
  let visible=true,frame=0,disposed=false,currentX=0,currentY=0,targetX=0,targetY=0,last=0;
  const active=()=>!motion.matches&&!document.body.classList.contains('motion-paused');
  function projectLabels() {
    for(const {el,p} of [...labels,{el:unknownLabel,p:point(7,-3.7,1.1)}]) {
      const v=p.clone();v.y+=wave(p.x,p.z,time.value);v.project(camera);el.style.left=`${(v.x*.5+.5)*100}%`;el.style.top=`${(-v.y*.5+.5)*100}%`;
    }
  }
  function render(now) {
    frame=0;if(disposed||!visible||document.hidden||stats.contextLost||document.body.classList.contains('focused')){last=0;return;}
    if(active()&&last&&now-last<32){invalidate();return;}
    if(active()&&last)time.value+=Math.min(.08,(now-last)/1000);last=now;stats.time=time.value;
    currentX+=(targetX-currentX)*.16;currentY+=(targetY-currentY)*.16;
    camera.position.set(1.3+currentX,11.5+currentY,17.2);camera.lookAt(0,.8,0);camera.updateMatrixWorld();
    for(const {p,marker,beacon} of labels){marker.position.y=beacon.position.y=p.y+wave(p.x,p.z,time.value);}
    renderer.render(scene,camera);projectLabels();stats.frames++;stats.calls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.geometries=renderer.info.memory.geometries;stats.textures=renderer.info.memory.textures;
    if(active())invalidate();
  }
  function invalidate() { if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(render); }
  function resize() {
    const box=viewport.getBoundingClientRect();if(box.width<1||box.height<1)return;
    const aspect=box.width/box.height,span=13.5;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
    stats.pixelRatio=Math.min(devicePixelRatio||1,innerWidth<760?1.5:2);pointDPR.value=stats.pixelRatio;renderer.setPixelRatio(stats.pixelRatio);renderer.setSize(box.width,box.height,false);invalidate();
  }
  function move(event) {if(!active()||event.pointerType!=='mouse')return;const b=viewport.getBoundingClientRect();targetX=((event.clientX-b.left)/b.width-.5)*.7;targetY=((event.clientY-b.top)/b.height-.5)*.35;invalidate();}
  function leave(){targetX=targetY=0;invalidate();}
  function mediaChange(){last=0;targetX=targetY=currentX=currentY=0;cancelAnimationFrame(frame);frame=0;invalidate();}
  function visibility(){last=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate();}
  const resizer=new ResizeObserver(resize);resizer.observe(viewport);
  const observer=new IntersectionObserver(([entry])=>{last=0;visible=entry.isIntersecting;stats.visible=visible;if(visible)invalidate();else{cancelAnimationFrame(frame);frame=0;}});observer.observe(viewport);
  viewport.addEventListener('pointermove',move,{passive:true});viewport.addEventListener('pointerleave',leave);
  document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',mediaChange);
  document.addEventListener('readingmotionchange',mediaChange);
  const bodyObserver=new MutationObserver(()=>{resize();invalidate();});bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
  function contextLost(event){event.preventDefault();cancelAnimationFrame(frame);frame=0;viewport.classList.remove('terrain-ready');stats.contextLost=true;}
  function contextRestored(){stats.contextLost=false;viewport.classList.add('terrain-ready');invalidate();}
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  function dispose(){if(disposed)return;disposed=true;stats.disposed=true;cancelAnimationFrame(frame);resizer.disconnect();observer.disconnect();bodyObserver.disconnect();viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('readingmotionchange',mediaChange);motion.removeEventListener('change',mediaChange);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);for(const r of resources)r.dispose();renderer.dispose();renderer.forceContextLoss();viewport.before(fallback);viewport.remove();stats.geometries=renderer.info.memory.geometries;stats.textures=renderer.info.memory.textures;}
  function pagehide(event){if(!event.persisted)dispose();else{cancelAnimationFrame(frame);frame=0;}}
  function pageshow(){resize();invalidate();}
  addEventListener('pagehide',pagehide);addEventListener('pageshow',pageshow);
  viewport.classList.add('terrain-ready');resize();
  return {stats,dispose};
}
