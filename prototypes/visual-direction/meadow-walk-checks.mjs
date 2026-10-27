export async function run({send,evaluate,until,pause,check,report,url='http://127.0.0.1:4395/meadow-study.html',scrollSelector='#cast',mediaBase='./meadow-media/'}){
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('window.__meadowMotion.pause(false);window.scrollTo({top:0,behavior:"instant"});document.querySelector("#enter-field").focus();');
  const same=await evaluate('window.__savedEnvironment=document.querySelector(".environment-motion");true');
  await evaluate('document.querySelector("#enter-field").click()');await until('window.__meadowWalk.stats().state==="station"');
  check('entry keeps the same environment and reveals a same-position complete actor',same&&await evaluate('document.querySelector(".environment-motion")===window.__savedEnvironment&&window.__meadowWalk.stats().position.x===1254&&window.__meadowWalk.stats().position.y===858&&document.querySelector(".landscape-art").src.includes("walk-plate")&&document.activeElement.id==="field-action"&&!document.querySelector("#field-controls").hidden'));
  await evaluate('window.__meadowWalk.action()');const begin=await evaluate('window.__meadowWalk.stats()');await pause(1650);const next=await evaluate('window.__meadowWalk.stats()');
  report.metrics.walk={begin,next};
  check('walking advances along the route and changes complete-body frames',next.distance>begin.distance+30&&next.frame!==begin.frame&&next.position.x<begin.position.x&&next.frames>begin.frames,report.metrics.walk);
  await evaluate('window.__meadowWalk.action()');const stopped=await evaluate('window.__meadowWalk.stats()');await pause(160);
  check('stop settles to standing with stationary feet and no loop',await evaluate(`window.__meadowWalk.stats().state==='paused'&&window.__meadowWalk.stats().frame===12&&window.__meadowWalk.stats().distance===${stopped.distance}&&!window.__meadowWalk.stats().loopScheduled`));
  await evaluate('window.__meadowWalk.action();window.__meadowMotion.pause(true)');const global=await evaluate('window.__meadowWalk.stats()');await pause(150);
  check('the global pause freezes both route and environment',await evaluate(`!window.__meadowWalk.stats().loopScheduled&&window.__meadowWalk.stats().distance===${global.distance}&&!window.__meadowMotion.stats().running`));
  await evaluate('window.__meadowMotion.pause(false)');await pause(100);
  check('resume continues the existing route',await evaluate(`window.__meadowWalk.stats().distance>${global.distance}&&window.__meadowWalk.stats().loopScheduled`));
  await evaluate(`document.body.style.paddingBottom=innerHeight+'px';document.querySelector(${JSON.stringify(scrollSelector)}).scrollIntoView({behavior:'instant'})`);await pause(150);const off=await evaluate('window.__meadowWalk.stats()');await pause(150);
  check('offscreen walking stops without advancing position',await evaluate(`!window.__meadowWalk.stats().loopScheduled&&window.__meadowWalk.stats().distance===${off.distance}`));
  await evaluate('window.scrollTo({top:0,behavior:"instant"});document.body.style.paddingBottom=""');await pause(100);
  check('visible route resumes after offscreen pause',await evaluate('window.__meadowWalk.stats().loopScheduled'));
  // Compare a painted cart pixel with the final actor layer, then find actor
  // pixels above it. The original foreground actually covers the passing body.
  report.metrics.occlusion=await evaluate(`(async()=>{
    window.__meadowWalk.sample(.389);const c=document.querySelector('.field-actor'),ctx=c.getContext('2d');
    const img=new Image();img.src=${JSON.stringify(mediaBase+'walk-foreground-v01.png')};await img.decode();
    const ref=document.createElement('canvas');ref.width=c.width;ref.height=c.height;const r=ref.getContext('2d');r.imageSmoothingEnabled=false;r.drawImage(img,0,0,c.width,c.height);
    const a=ctx.getImageData(0,0,c.width,c.height).data,b=r.getImageData(0,0,c.width,c.height).data;
    let foreground=0,covered=0,actorAbove=0;
    for(let y=Math.round(780*c.height/1080);y<Math.round(1005*c.height/1080);y++)for(let x=Math.round(800*c.width/1920);x<Math.round(980*c.width/1920);x++){
      const i=(y*c.width+x)*4;if(b[i+3]===255){foreground++;if(a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2])covered++;}else if(a[i+3]>0)actorAbove++;
    }return{foreground,covered,actorAbove,position:window.__meadowWalk.stats().position};
  })()`);
  const o=report.metrics.occlusion;check('foreground cart remains intact with the actor visible above it',o.foreground>1000&&o.foreground===o.covered&&o.actorAbove>100,o);
  await evaluate('window.__meadowMotion.pause(true);window.__walkContext=document.querySelector(".environment-motion").getContext("webgl").getExtension("WEBGL_lose_context");window.__walkContext.loseContext()');await pause(100);
  check('context loss keeps the clean background and actor at the same route position',await evaluate('document.querySelector(".landscape-art").src.includes("walk-plate")&&window.__meadowWalk.stats().active&&window.__meadowWalk.stats().globalPaused&&!document.querySelector(".environment-motion").classList.contains("ready")'));
  await evaluate('window.__walkContext.restoreContext()');await until('document.querySelector(".environment-motion").classList.contains("ready")');
  check('context restoration retains the route and global pause preference',await evaluate('window.__meadowWalk.stats().active&&window.__meadowWalk.stats().globalPaused&&window.__meadowMotion.stats().userPaused&&!window.__meadowMotion.stats().running'));
  await evaluate('window.__meadowWalk.sample(.99);window.__meadowWalk.pause(false)');await until('window.__meadowWalk.stats().state==="arrived"');
  check('arrival stops on the near bank without revealing the note automatically',await evaluate('window.__meadowWalk.stats().position.x===370&&window.__meadowWalk.stats().position.y===795&&!window.__meadowWalk.stats().loopScheduled&&document.querySelector("#field-note").hidden&&document.querySelector("#field-action").textContent==="查阅记录器"'));
  await evaluate('window.__meadowWalk.action()');
  check('checking uses the recorder pose and reveals a specific discrepancy',await evaluate('window.__meadowWalk.stats().state==="observed"&&window.__meadowWalk.stats().frame===13&&!document.querySelector("#field-note").hidden&&document.querySelector("#note-title").textContent==="位置对不上。"'));
  report.metrics.walkLayouts=[];
  for(const width of [320,390,768,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});await pause(100);
    const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.field-buttons a,.field-buttons button')].map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right}}),noteVisible:!document.querySelector('#field-note').hidden,buffer:window.__meadowWalk.stats().canvas})`);
    report.metrics.walkLayouts.push(layout);check(`${width}px exploration controls and note fit`,layout.scroll<=width&&layout.controls.every(r=>r.left>=0&&r.right<=width)&&layout.noteVisible&&layout.buffer[0]<=1440,layout);
  }
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(60);
  check('escape restores the original poster and entry focus',await evaluate('window.__meadowWalk.stats().state==="poster"&&!window.__meadowWalk.stats().loopScheduled&&document.querySelector(".landscape-art").src.includes("hero-v04")&&document.activeElement.id==="enter-field"'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('window.__meadowWalk.open()');await evaluate('window.__meadowWalk.action()');
  check('reduced-motion visitors can reach the point without a walking animation',await evaluate('window.__meadowWalk.stats().state==="arrived"&&!window.__meadowWalk.stats().loopScheduled&&document.querySelector("#field-action").textContent==="查阅记录器"'));
  await evaluate('window.__meadowWalk.close()');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  // A failed lazy asset fetch must keep the poster and direct reading usable.
  await send('Page.navigate',{url});await until('!!window.__meadowWalk');
  await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*walk-plate-v01.webp']});
  await evaluate('window.__meadowWalk.open()');
  check('asset failure keeps the complete poster, entry retry and reading available',await evaluate('window.__meadowWalk.stats().state==="poster"&&!document.querySelector("#enter-field").disabled&&!document.querySelector("#field-load-error").hidden&&document.querySelector(".landscape-art").src.includes("hero-v04")&&!!document.querySelector(".read-link[href]")'));
  await send('Network.setBlockedURLs',{urls:[]});await evaluate('window.__meadowWalk.open()');
  check('retry succeeds after an asset failure',await evaluate('window.__meadowWalk.stats().state==="station"'));
  await evaluate('window.__meadowMotion.pause(false);window.__meadowWalk.action()');
  const started=Date.now();
  for(let i=0;i<55;i++){if(await evaluate('window.__meadowWalk.stats().state==="arrived"'))break;await pause(500);}
  report.metrics.completeWalk={seconds:(Date.now()-started)/1000,...await evaluate('window.__meadowWalk.stats()')};
  check('an uninterrupted complete walk naturally reaches the bank and releases its loop',report.metrics.completeWalk.state==='arrived'&&report.metrics.completeWalk.seconds<27&&!report.metrics.completeWalk.loopScheduled,report.metrics.completeWalk);
  await evaluate('window.__meadowWalk.close()');
}
