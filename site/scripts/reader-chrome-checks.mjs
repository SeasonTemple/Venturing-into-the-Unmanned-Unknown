export async function run({send,evaluate,until,pause,check,report}){
 const url='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/ch3/';
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await send('Page.navigate',{url});await until('window.__readingStudy?.ready');
 const palette=()=>evaluate(`(()=>{const style=s=>{const c=getComputedStyle(document.querySelector(s));return {background:c.backgroundColor,color:c.color,duration:c.transitionDuration}};return {tools:style('.reader-chrome'),travel:style('.chapter-travel'),track:getComputedStyle(document.documentElement).getPropertyValue('--scroll-track').trim()}})()`);
 await evaluate('document.documentElement.dataset.theme="light"');await pause(360);
 const top=await palette();
 check('light theme masthead starts with two equally dark bars and a dark page scrollbar',top.tools.background==='rgb(16, 29, 33)'&&top.travel.background===top.tools.background&&top.travel.color===top.tools.color&&top.track==='#101d21',top);
 check('next chapter aligns to the far right of the travel bar',await evaluate('(()=>{const a=document.querySelector(".chapter-travel a:last-child"),span=a.querySelector("span");return a.getBoundingClientRect().right-span.getBoundingClientRect().right<2})()'));
 await evaluate('document.getElementById("body").scrollIntoView({behavior:"instant"})');await until('!document.body.classList.contains("over-survey")');await pause(100);
 const middle=await palette();await pause(300);const paper=await palette();
 report.metrics.chromeTransition={top,middle,paper};
 check('scrolling interpolates both bars together before reaching the paper palette',middle.travel.background===middle.tools.background&&middle.travel.background!==top.travel.background&&middle.travel.background!==paper.travel.background&&paper.travel.background==='rgb(247, 249, 246)',{middle,paper});
 await evaluate('document.documentElement.dataset.theme="dark"');await pause(360);const dark=await palette();
 check('night reading keeps both bars and the page scrollbar dark',dark.tools.background==='rgb(23, 38, 44)'&&dark.travel.background===dark.tools.background&&dark.track==='#17262c',dark);
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:600,deviceScaleFactor:1,mobile:false});
 await evaluate('document.getElementById("body").scrollIntoView({behavior:"instant"})');await pause(160);
 const rails=await evaluate('[...document.querySelectorAll(".field-route,.chapter-margin")].map(e=>({name:e.className,position:getComputedStyle(e).position,overflow:getComputedStyle(e).overflowY,height:e.clientHeight,scrollHeight:e.scrollHeight,top:e.scrollTop}))');
 check('long chapter rails participate in document flow with no inner scrollport',rails.every(r=>r.overflow==='visible'&&r.scrollHeight<=r.height+1)&&rails.some(r=>r.name.includes('route-flow')&&r.position==='static'),rails);
 const position=await evaluate('({scroll:scrollY,x:document.querySelector(".chapter-margin").getBoundingClientRect().left+35,y:250})');
 await send('Page.bringToFront');await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:position.x,y:position.y,deltaX:0,deltaY:400});await pause(250);
 check('wheel over the long outline scrolls the document rather than a nested panel',await evaluate(`scrollY>${position.scroll+50}&&document.querySelector('.chapter-margin').scrollTop===0`));
 // A real chapter link retains a full load and opts into native document fading.
 const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:'addEventListener("pageswap",e=>sessionStorage.setItem("reader-native-transition",String(!!e.viewTransition)));'});
 await send('Page.navigate',{url});await until('window.__readingStudy?.ready');
 await evaluate('document.querySelector(".chapter-travel [rel=next]").click()');await until('window.__readingStudy?.ready&&location.pathname.endsWith("/ch4/")');
 const transition=await evaluate('({supported:typeof ViewTransition!=="undefined",observed:sessionStorage.getItem("reader-native-transition"),search:!!document.querySelector("site-search")})');
 check('chapter link uses a native cross-document transition without losing search',transition.supported&&transition.observed==='true'&&transition.search,transition);
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 check('reduced motion disables the added color transitions',await evaluate('getComputedStyle(document.querySelector(".chapter-travel")).transitionDuration==="0s"'));
}
