export async function run({send,evaluate,until,pause,check,report}) {
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  report.metrics.layouts=[];
  for (const layout of ['journal','atlas']) {
    for (const [width,height] of [[2560,1440],[2048,1152],[1707,960],[1440,970],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
      await send('Page.navigate',{url:`http://127.0.0.1:4395/reading.html?layout=${layout}&section=2`});
      await until(`window.__readingStudy?.ready && window.__readingStudy.layout==="${layout}"`); await pause(80);
      const metrics=await evaluate(`(()=>{const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,visible:getComputedStyle(e).display!=='none'}};return {layout:document.body.dataset.layout,width:innerWidth,page:document.documentElement.scrollWidth,bodyFont:getComputedStyle(document.querySelector('.section-content')).fontSize,left:rect('.wide-book'),right:rect('.wide-outline'),spread:rect('.reading-spread'),body:rect('.article-section:nth-child(2) .section-content'),position:rect('.reading-position'),chapters:document.querySelectorAll('#wide-book-links a').length,outline:document.querySelectorAll('#wide-outline-links a').length,current:document.querySelector('#wide-outline-links [aria-current]')?.textContent,note:rect('#wide-note'),inlineNote:rect('.section-note')}})()`);
      report.metrics.layouts.push(metrics);
      check(`${layout} ${width}px: page fits viewport`,metrics.page<=width,metrics);
      if(width>=1600){
        check(`${layout} ${width}px: useful margins stay separate from readable main text`,metrics.left.visible&&metrics.right.visible&&metrics.chapters===10&&metrics.outline===9&&metrics.body.w<=800&&metrics.body.x>=metrics.left.x+metrics.left.w&&metrics.body.x+metrics.body.w<=metrics.right.x&&metrics.right.x+metrics.right.w<=width&&parseInt(metrics.bodyFont)>=18);
        check(`${layout} ${width}px: outline follows current section without duplicated journal note`,metrics.current?.includes('分层验证模型')&&(layout!=='journal'||(metrics.note.visible&&!metrics.inlineNote.visible)));
        await evaluate('document.querySelectorAll("#wide-outline-links a")[2].click()'); await pause(60);
        check(`${layout} ${width}px: wide outline navigates and updates context`,await evaluate('document.querySelector("#wide-outline-links [aria-current]")?.textContent.includes("规格歧义") && document.activeElement.tagName==="H2"'));
        await evaluate('document.getElementById("focus").click()');
        check(`${layout} ${width}px: focused reading hides both margins`,await evaluate('getComputedStyle(document.querySelector(".wide-book")).display==="none" && getComputedStyle(document.querySelector(".wide-outline")).display==="none" && document.documentElement.scrollWidth<=innerWidth'));
      }else check(`${layout} ${width}px: compact reading keeps margins collapsed`,!metrics.left.visible&&!metrics.right.visible);
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:2200,height:1500,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/reading-wide.html'});
  await until('document.getElementById("preview")?.contentWindow.__readingStudy?.ready'); await pause(100);
  report.metrics.preview=await evaluate('(()=>{const f=document.getElementById("preview"),d=f.contentDocument,w=f.contentWindow;return {width:w.innerWidth,page:d.documentElement.scrollWidth,transform:f.style.transform,frameWidth:f.getBoundingClientRect().width,hostWidth:document.getElementById("viewport").clientWidth,measure:document.getElementById("measure").textContent}})()');
  check('2K review embeds the actual 2560px viewport without cropping',report.metrics.preview.width===2560&&report.metrics.preview.page<=2560&&Math.abs(report.metrics.preview.frameWidth-report.metrics.preview.hostWidth)<2,report.metrics.preview);
  check('no browser runtime errors',report.consoleErrors.length===0,report.consoleErrors);
}
