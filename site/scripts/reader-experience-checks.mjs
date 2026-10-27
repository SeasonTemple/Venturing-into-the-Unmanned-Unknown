// DOM, computed paint values and real input; no screenshot capture.
export async function run({send,evaluate,until,pause,check,report}){
 const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown';
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await send('Page.navigate',{url:base+'/ch3/'});await until('window.__readingStudy?.ready');
 await evaluate('sessionStorage.removeItem("field-reader-paused");if(!window.__readingStudy.effects.enabled)document.getElementById("motion-toggle").click()');
 check('left rail contains all ten chapters and right rail contains every section',await evaluate('document.querySelectorAll(".book-rail a").length===10&&document.querySelector(".book-rail [aria-current=page]").href.endsWith("/ch3/")&&document.querySelectorAll("#route-links a").length===document.querySelectorAll("#body h2").length'));
 report.metrics.readerThemes=[];
 for(const theme of ['light','dark']){
  await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.getElementById('body').scrollIntoView({behavior:'instant'})`);await pause(300);
  const paint=await evaluate(`(()=>{
    const l=c=>{const a=c.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
    const ratio=(a,b)=>{a=l(a);b=l(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    const pre=document.querySelector('.expressive-code pre'),background=getComputedStyle(pre).backgroundColor;
    const tokens=[...new Set([...document.querySelectorAll('.expressive-code pre span[style]')].filter(e=>e.textContent.trim()).map(e=>getComputedStyle(e).color))];
    const code=document.querySelector('.expressive-code pre code'),body=getComputedStyle(document.body),panel=getComputedStyle(document.querySelector('.chapter-travel'));
    return {theme:document.documentElement.dataset.theme,codeFont:parseFloat(getComputedStyle(code).fontSize),background,tokens:tokens.map(c=>({color:c,contrast:ratio(c,background)})),bodyContrast:ratio(body.color,body.backgroundColor),travelContrast:ratio(panel.color,panel.backgroundColor),scheme:getComputedStyle(document.documentElement).colorScheme};
  })()`);
  report.metrics.readerThemes.push(paint);
  check(`${theme} block code keeps a readable font and syntax contrast`,paint.codeFont>=14&&paint.tokens.length>1&&paint.tokens.every(t=>t.contrast>=4.5),paint);
  check(`${theme} paper and persistent navigation keep readable contrast`,paint.bodyContrast>=7&&paint.travelContrast>=7&&paint.scheme===theme,paint);
  await until('!document.querySelector("site-search [data-open-modal]").disabled');await evaluate('document.querySelector("site-search [data-open-modal]").click()');await until('!!document.querySelector(".pagefind-ui__search-input")');
  const search=await evaluate(`(()=>{const d=document.querySelector('site-search dialog'),r=d.getBoundingClientRect(),input=document.querySelector('.pagefind-ui__search-input'),s=getComputedStyle(input);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],background:s.backgroundColor,color:s.color,scheme:getComputedStyle(d).colorScheme,focus:document.activeElement===input,paused:!window.__readingStudy.effects.running&&!window.__readingStudy.effects.headerRunning}})()`);
  check(`${theme} search is centered, themed, focused and pauses motion`,Math.abs((search.left+search.right)/2-720)<2&&Math.abs((search.top+search.bottom)/2-480)<2&&search.height<900&&search.scheme===theme&&search.focus&&search.paused,search);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 }
 await evaluate('document.documentElement.dataset.theme="light";[...document.querySelectorAll("#route-links a")].find(a=>a.textContent.includes("分层验证模型")).click()');await pause(650);
 check('right rail tracks section and carries its authored note',await evaluate('!!document.querySelector("#route-links [aria-current=location]")&&!!document.querySelector("#margin-note strong")'),await evaluate('({current:document.querySelector("#route-links [aria-current]")?.textContent,note:document.querySelector("#margin-note").textContent})'));
 const geometry=await evaluate('(()=>{const c=document.querySelector(".section-content").getBoundingClientRect(),l=document.querySelector(".field-route").getBoundingClientRect(),r=document.querySelector(".chapter-margin").getBoundingClientRect(),t=document.querySelector(".chapter-travel").getBoundingClientRect();return {content:c.toJSON(),left:l.toJSON(),right:r.toJSON(),travel:t.toJSON(),chrome:document.querySelector(".reader-chrome").getBoundingClientRect().bottom}})()');
 check('desktop article occupies the middle column with both rails visible',geometry.left.right<geometry.content.left&&geometry.content.right<geometry.right.left&&geometry.content.width<=800&&Math.abs((geometry.content.left+geometry.content.right)/2-720)<80,geometry);
 check('previous and next chapter remain visible deep in the article',geometry.travel.top===geometry.chrome&&geometry.travel.height>=44&&await evaluate('document.querySelector(".chapter-travel [rel=prev]").href.endsWith("/ch2/")&&document.querySelector(".chapter-travel [rel=next]").href.endsWith("/ch4/")'),geometry.travel);
 await evaluate('scrollTo({top:0,behavior:"instant"})');await until('window.__readingStudy.effects.headerRunning');
 const boundary=await evaluate('getComputedStyle(document.querySelector(".frontier-drift path")).transform');await pause(450);
 check('unknown boundary visibly drifts while the chapter masthead is in view',await evaluate(`getComputedStyle(document.querySelector('.frontier-drift path')).transform!==${JSON.stringify(boundary)}`));
 await evaluate('document.getElementById("motion-toggle").click()');await pause(60);
 const stopped=await evaluate('getComputedStyle(document.querySelector(".frontier-drift path")).transform');await pause(200);
 check('motion pause freezes the masthead as well as the paper',await evaluate(`!window.__readingStudy.effects.headerRunning&&getComputedStyle(document.querySelector('.frontier-drift path')).transform===${JSON.stringify(stopped)}`));
 await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 for(const width of [320,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:base+'/ch3/'});await until('window.__readingStudy?.ready');await pause(150);
  check(`${width}px masthead uses a flat plan and does not fetch the desktop relief`,await evaluate('getComputedStyle(document.querySelector(".survey-flat")).display!=="none"&&getComputedStyle(document.querySelector(".survey-map")).display==="none"&&document.querySelectorAll(".flat-node").length===3&&!performance.getEntriesByType("resource").some(r=>r.name.includes("relief-base"))&&document.documentElement.scrollWidth===innerWidth'),await evaluate('({resources:performance.getEntriesByType("resource").filter(r=>r.name.includes("relief-base")).map(r=>r.name),width:document.documentElement.scrollWidth})'));
  await evaluate('document.querySelector(".flat-node").dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}))');await pause(650);
  check(`${width}px flat map links to the body with persistent chapter travel`,await evaluate('document.activeElement.tagName==="H2"&&Math.abs(document.querySelector(".chapter-travel").getBoundingClientRect().top-document.querySelector(".reader-chrome").getBoundingClientRect().bottom)<1'),await evaluate('({active:document.activeElement.tagName,id:document.activeElement.id,travel:document.querySelector(".chapter-travel").getBoundingClientRect().toJSON(),chrome:document.querySelector(".reader-chrome").getBoundingClientRect().toJSON()})'));
 }
 check('custom favicon and touch icon are served at the project base',await evaluate('(async()=>{const link=document.querySelector("link[rel~=icon]");return link.href.endsWith("/favicon.svg")&&(await(await fetch(link.href)).text()).includes("#132f35")&&(await fetch(document.querySelector("link[rel=apple-touch-icon]").href)).ok})()'));
}
