export async function run({send,evaluate,until,pause,check,report}) {
  await send('Page.navigate',{url:'http://127.0.0.1:4395/outpost.html'});
  await until('!!window.__visualStudy'); await evaluate('window.__visualStudy.ready');
  report.metrics.home=await evaluate('window.__visualStudy.state()');
  check('candidate initializes without construction errors',report.metrics.home.errors.length===0,report.metrics.home.errors);
  if (!report.metrics.home.world) throw Error('Outpost world was not created: '+JSON.stringify(report.metrics.home.errors));
  check('one canvas renders the architectural section',await evaluate('document.querySelectorAll("canvas").length===1 && window.__visualStudy.state().world.art==="engineering-section" && window.__visualStudy.state().world.calls>0'));
  check('homepage keeps modes and actors inside the optional experience',await evaluate('document.getElementById("space-ui").hidden && !window.__visualStudy.state().world.actorsVisible'));
  await pause(200); const idle=await evaluate('window.__visualStudy.state().world.frames'); await pause(300);
  check('static composition has no idle animation loop',await evaluate(`window.__visualStudy.state().world.frames===${idle} && !window.__visualStudy.state().world.loopScheduled`));
  await evaluate('window.__candidateCanvas=document.querySelector("canvas");document.getElementById("enter").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  report.metrics.keyboardEntry=await evaluate('({active:document.activeElement.id,disabled:document.getElementById("enter").disabled,state:window.__visualStudy.state()})');
  await until('window.__visualStudy.state().view==="space" && !window.__visualStudy.state().busy');
  check('entry changes camera within the original canvas',await evaluate('!window.__visualStudy.state().busy && !window.__visualStudy.state().world.moving && document.querySelector("canvas")===window.__candidateCanvas && window.__visualStudy.state().world.actorsVisible'));
  check('all six work areas become keyboard reachable',await evaluate('!document.getElementById("space-ui").hidden && Array.from(document.querySelectorAll(".station-label")).every(e=>!e.hidden && e.tabIndex===0)'));
  await evaluate('document.getElementById("station-4").click()');
  check('selecting a region updates the indicated work area and chapter',await evaluate('window.__visualStudy.state().world.selected===4 && window.__visualStudy.state().currentChapter==="ch6" && document.getElementById("station-4").getAttribute("aria-pressed")==="true"'));
  await evaluate('document.querySelector("input[value=human]").click()');
  check('inside mode changes the scene and text together',await evaluate('window.__visualStudy.state().mode==="human" && window.__visualStudy.state().world.mode==="human" && document.getElementById("space-eyebrow").textContent.startsWith("HUMAN-LED")'));
  report.metrics.space=await evaluate('window.__visualStudy.state().world');
  await evaluate('document.getElementById("station-2").click();document.getElementById("station-read").focus();document.getElementById("station-read").click()');
  await until('document.getElementById("chapter-content").getAttribute("aria-busy")==="false" && window.__visualStudy.state().view==="reading"');
  check('verification opens full source content and chapter navigation',await evaluate('document.getElementById("chapter-content").textContent.length>3000 && document.querySelectorAll("#chapter-nav button").length===10 && document.querySelectorAll("#chapter-toc a").length>3'));
  const reading=await evaluate('window.__visualStudy.state().world.frames'); await pause(250);
  check('reading stops the scene',await evaluate(`window.__visualStudy.state().world.frames===${reading} && !window.__visualStudy.state().world.loopScheduled`));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until('window.__visualStudy.state().view==="space" && !window.__visualStudy.state().busy');
  check('Escape returns to the scene and restores focus',await evaluate('document.activeElement.id==="station-read" && document.querySelector("canvas")===window.__candidateCanvas'));
  await evaluate('window.__visualStudy.home()');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  report.metrics.layouts=[];
  for (const [width,height] of [[390,844],[320,740],[768,1024],[1440,960],[2560,1440]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:width<760}); await pause(120);
    await evaluate('window.__visualStudy.home()');
    const home=await evaluate('(()=>{const h=document.querySelector(".hero-caption h1"),r=h.getBoundingClientRect(),e=document.getElementById("enter").getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,titleWidth:h.scrollWidth,titleAvailable:h.clientWidth,titleHeight:r.height,clearOfEntry:r.bottom<=e.top||r.right<=e.left||r.left>=e.right,pixelRatio:window.__visualStudy.state().world.pixelRatio}})()');
    check(`${width}px homepage stays within its viewport`,home.scroll<=width&&home.titleWidth<=home.titleAvailable&&home.clearOfEntry,home);
    await evaluate('window.__visualStudy.enter()');
    check(`${width}px reduced-motion entry settles immediately`,await evaluate('!window.__visualStudy.state().busy && !window.__visualStudy.state().world.moving && !window.__visualStudy.state().world.loopScheduled'));
    const layout=await evaluate('({width:innerWidth,mode:document.querySelector(".mode-switch").getBoundingClientRect().bottom,dock:document.querySelector(".space-dock").getBoundingClientRect().top,labels:Array.from(document.querySelectorAll(".station-label"),e=>{const r=e.getBoundingClientRect();return {title:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden}})})');
    const boxes=layout.labels;
    check(`${width}px labels fit between controls without overlap`,boxes.every((a,i)=>!a.hidden&&a.x>=0&&a.x+a.w<=width&&a.y>layout.mode&&a.y+a.h<layout.dock&&boxes.slice(i+1).every(b=>a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y)),layout);
    report.metrics.layouts.push({home,space:layout});
  }
  await evaluate('window.__visualStudy.home()');
  check('no runtime or shader errors',report.consoleErrors.length===0&&(await evaluate('window.__visualStudy.state().errors.length===0')),report.consoleErrors);
  await send('Page.navigate',{url:'http://127.0.0.1:4395/outpost-review.html'});
  await until('document.querySelectorAll(".compare iframe").length===2');
  await until('Array.from(document.querySelectorAll(".compare iframe")).every(e=>e.contentWindow.__visualStudy?.state().world)');
  check('review presents functioning original and candidate worlds',await evaluate('document.querySelectorAll(".compare iframe")[0].contentWindow.__visualStudy.state().world.canvasCount===1 && document.querySelectorAll(".compare iframe")[1].contentWindow.__visualStudy.state().world.art==="engineering-section"'));
  check('review names sources and distinguishes design from accepted work',await evaluate('document.querySelectorAll(".sources a").length===3 && document.querySelector(".boundary").textContent.includes("没有被记为用户已认可")'));
  await send('Page.navigate',{url:'http://127.0.0.1:4395/outpost.html?checks=lifecycle'});
  await until('location.search.includes("lifecycle") && !!window.__visualStudy');await evaluate('window.__visualStudy.ready');
  report.metrics.lifecycle=await evaluate(`(async()=>{
    const {createWorld}=await import('/outpost-world.mjs'),records=[];
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-2000px;top:0;width:960px;height:640px';document.body.append(host);
    try {for(let i=0;i<3;i++){
      const world=createWorld(host,{still:true});await world.show('space',false);
      let lighting;
      if(i===0){const lit=world.sample(),unlit=world.sample({slitLight:false}),a=lit.pixels,b=unlit.pixels;let changed=0,total=0,max=0,workChanged=0,workRed=0,workBlue=0;const workSamples=[];
        const inside=(x,y)=>{const crosses=lit.workArea.map((v,i)=>{const n=lit.workArea[(i+1)%4];return (n.x-v.x)*(y-v.y)-(n.y-v.y)*(x-v.x)});return crosses.every(v=>v>=0)||crosses.every(v=>v<=0)};
        for(let p=0;p<a.length;p+=4){const diff=Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]);if(diff>9)changed++;total+=diff;max=Math.max(max,diff);
          const pixel=p/4;if(inside(pixel%160+.5,Math.floor(pixel/160)+.5)){if(diff>9){workChanged++;workSamples.push({lit:Array.from(a.slice(p,p+3)),unlit:Array.from(b.slice(p,p+3))});}workRed+=a[p]-b[p];workBlue+=a[p+2]-b[p+2];}}
        lighting={changed,total,max,workChanged,workRed,workBlue,workSamples};}
      const live=world.stats();world.destroy();const frames=world.stats().frames;await new Promise(r=>setTimeout(r,60));
      records.push({live,lighting,remainingCanvases:host.querySelectorAll('canvas').length,framesAfterDestroy:world.stats().frames-frames,loopAfterDestroy:world.stats().loopScheduled});
    }}finally{host.remove();}return records;
  })()`);
  check('the slit lamp changes actual surface pixels',report.metrics.lifecycle[0].lighting.changed>10&&report.metrics.lifecycle[0].lighting.max>30,report.metrics.lifecycle[0].lighting);
  check('warm light reaches the inspection plane itself',report.metrics.lifecycle[0].lighting.workChanged>3&&report.metrics.lifecycle[0].lighting.workRed>report.metrics.lifecycle[0].lighting.workBlue,report.metrics.lifecycle[0].lighting);
  check('three mounts and disposals keep resource counts stable and remove canvases',report.metrics.lifecycle.every(r=>r.remainingCanvases===0&&r.framesAfterDestroy===0&&!r.loopAfterDestroy&&r.live.geometries===report.metrics.lifecycle[0].live.geometries&&r.live.textures===report.metrics.lifecycle[0].live.textures),report.metrics.lifecycle);
  await send('Page.navigate',{url:'http://127.0.0.1:4395/outpost.html'});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)};`});
  await send('Page.reload');await until('!!window.__visualStudy');await evaluate('window.__visualStudy.ready');
  check('no-WebGL fallback keeps the diagram, chapter index and reading available',await evaluate('!window.__visualStudy.state().world && !document.body.classList.contains("world-ready") && getComputedStyle(document.querySelector(".scene-fallback")).display!=="none" && document.getElementById("enter").disabled && document.querySelectorAll(".chapter-row").length===10'));
  await evaluate('window.__visualStudy.read("ch3")');
  check('full reading works after WebGL initialization fails',await evaluate('window.__visualStudy.state().view==="reading" && document.getElementById("chapter-content").textContent.length>3000'));
  await evaluate('window.__visualStudy.back()');
  check('fallback reading can return to a usable homepage',await evaluate('window.__visualStudy.state().view==="home" && !document.getElementById("display-view").hidden && document.getElementById("enter").disabled && !document.getElementById("hero-caption").hidden'));
}
