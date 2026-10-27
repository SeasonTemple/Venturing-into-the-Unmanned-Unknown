export async function run({send,evaluate,until,pause,check,report}){
 const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown';
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await send('Page.navigate',{url:base+'/ch3/'});await until('window.__readingStudy?.ready');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 await evaluate('document.querySelector("starlight-theme-select select").focus({preventScroll:true})');await pause(200);
 const focus=await evaluate('(()=>{const s=document.querySelector("starlight-theme-select select"),line=getComputedStyle(s.closest("label"),"::after");return {visible:s.matches(":focus-visible"),outline:getComputedStyle(s).outlineStyle,line:line.height,opacity:line.opacity}})()');
 check('theme selector replaces the orange rectangle with a visible one-pixel keyboard cue',focus.visible&&focus.outline==='none'&&focus.line==='1px'&&focus.opacity==='1',focus);
 await evaluate('document.activeElement.blur()');await pause(1000);
 check('direct chapter entry stays on the masthead',await evaluate('window.__readingStudy.arrival.phase==="idle"&&scrollY<8'));
 async function change(selector,slug){
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await until(`window.__readingStudy?.ready&&location.pathname.endsWith('/${slug}/')`);
 }
 const position=()=>evaluate('({phase:window.__readingStudy.arrival.phase,scroll:scrollY,body:document.getElementById("body").getBoundingClientRect().top,chrome:document.querySelector(".chapter-travel").getBoundingClientRect().bottom})');
 await change('.chapter-travel [rel=next]','ch4');await pause(350);
 check('next chapter pauses at its own masthead before entering the text',await evaluate('window.__readingStudy.arrival.phase==="preview"&&scrollY<8'));
 await until('window.__readingStudy.arrival.phase==="reading"');
 const next=await position();
 check('next chapter then scrolls to the text and focuses the article',next.scroll>400&&Math.abs(next.body-next.chrome)<80&&await evaluate('document.activeElement.id==="body"'),next);
 await send('Page.reload');await until('window.__readingStudy?.ready&&window.__readingStudy.arrival.phase==="idle"');await pause(300);
 check('reload does not replay the chapter arrival',await evaluate('window.__readingStudy.arrival.phase==="idle"&&scrollY>400'));
 await change('.journal-pagination [rel=prev]','ch3');await pause(200);
 check('footer previous chapter uses the same masthead preview',await evaluate('window.__readingStudy.arrival.phase==="preview"&&scrollY<8'));
 await until('window.__readingStudy.arrival.phase==="reading"');
 await change('.chapter-travel [rel=next]','ch4');await pause(300);
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:300,deltaX:0,deltaY:120});await until('window.__readingStudy.arrival.phase==="cancelled"');await pause(200);
 const manual=await position();await pause(1200);
 check('a user wheel gesture cancels the automatic arrival without a later jump',await evaluate(`window.__readingStudy.arrival.phase==='cancelled'&&Math.abs(scrollY-${manual.scroll})<4&&scrollY<400`),manual);
 await send('Page.navigate',{url:base+'/ch3/'});await until('window.__readingStudy?.ready');
 const heading=await evaluate('document.querySelector("#body h2").id');
 await send('Page.navigate',{url:base+'/ch3/?arrival-check=direct#'+encodeURIComponent(heading)});await until('window.__readingStudy?.ready');await pause(1200);
 check('a direct section URL keeps its section and skips the preview flow',await evaluate(`window.__readingStudy.arrival.phase==='idle'&&location.hash&&document.getElementById(${JSON.stringify(heading)}).getBoundingClientRect().top<300&&scrollY>400`));
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await change('.chapter-travel [rel=next]','ch4');await pause(250);
 check('reduced motion still previews the chapter without an immediate jump',await evaluate('window.__readingStudy.arrival.phase==="preview"&&scrollY<8'));
 await until('window.__readingStudy.arrival.phase==="reading"');
 check('reduced motion enters the text with a static transition',await evaluate('scrollY>400&&getComputedStyle(document.documentElement).scrollBehavior==="auto"'));
 report.metrics.chapterArrival={next,manual};
}
