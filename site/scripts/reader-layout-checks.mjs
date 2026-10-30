// Regression for the 981–1199px spread: inspect real boxes after scrolling,
// rather than accepting a correct title and absence of horizontal overflow.
export async function run({send,evaluate,until,pause,check,report}) {
  const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown';
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  report.metrics.readerLayouts=[];
  for (const chapter of ['ch0','ch3']) {
    await send('Page.navigate',{url:`${base}/${chapter}/`});
    await until('window.__readingStudy?.ready');
    await evaluate('document.fonts.ready');
    for (const width of [390,768,980,981,1024,1144,1199,1200,1440,2048]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
      await pause(100);
      await until('Math.abs(parseFloat(getComputedStyle(document.querySelector(".chapter-travel")).top)-document.querySelector(".reader-chrome").getBoundingClientRect().height)<1');
      for (const theme of ['light','dark']) {
        await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
        await evaluate('scrollTo({top:0,behavior:"instant"})');
        await pause(60);
        const opening=await evaluate(`(()=>{const r=document.querySelector('#opening').getBoundingClientRect(),title=document.querySelector('#_top').getBoundingClientRect(),spread=document.querySelector('.reading-spread').getBoundingClientRect();return {separate:spread.top>=r.bottom-1,titleInside:title.left>=0&&title.right<=innerWidth&&title.top>=r.top&&title.bottom<=r.bottom}})()`);
        const positions=[];
        // Include the introduction's tables shown in the reported screenshot.
        for (const index of [0,2,5]) {
          await evaluate(`document.querySelectorAll('#body h2')[${index}].scrollIntoView({behavior:'instant',block:'start'})`);
          await pause(100);
          positions.push(await evaluate(`(()=>{
            const box=s=>{const e=document.querySelector(s);return getComputedStyle(e).display==='none'?null:e.getBoundingClientRect().toJSON()};
            const left=box('.field-route'),right=box('.chapter-margin'),content=box('.reading-column'),travel=box('.chapter-travel'),chrome=box('.reader-chrome');
            const heading=document.querySelectorAll('#body h2')[${index}].getBoundingClientRect();
            return {left,right,content,travel,chrome,heading:heading.toJSON(),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,grid:getComputedStyle(document.querySelector('.reading-spread')).display};
          })()`));
        }
        const detail={chapter,width,theme,opening,positions};
        check(`${chapter} ${width}px ${theme}: rails stay outside the article while scrolling`,positions.every(p=>(!p.left||p.left.right<=p.content.left-1)&&(!p.right||p.right.left>=p.content.right+1)&&(width<=980?!p.left:p.grid==='grid'&&!!p.left)&&(width<1200?!p.right:!!p.right)),detail);
        check(`${chapter} ${width}px ${theme}: heading, chrome and page stay within their bounds`,opening.separate&&opening.titleInside&&positions.every(p=>p.scrollWidth<=width&&p.heading.left>=p.content.left-1&&p.heading.right<=p.content.right+1&&p.heading.top>=p.travel.bottom-1&&Math.abs(p.travel.top-p.chrome.bottom)<1),detail);
        report.metrics.readerLayouts.push({chapter,width,theme,contentWidth:positions[0].content.width,columns:positions[0].grid});
      }
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate('document.getElementById("focus").click()');
  await pause(100);
  check('focused article remains centered with both rails hidden',await evaluate(`(()=>{const c=document.querySelector('.reading-column').getBoundingClientRect();return ['.field-route','.chapter-margin'].every(s=>getComputedStyle(document.querySelector(s)).display==='none')&&c.width>=650&&c.width<=900&&Math.abs((c.left+c.right)/2-document.documentElement.clientWidth/2)<20})()`));
  await evaluate('document.getElementById("focus").click()');
  await send('Emulation.setEmulatedMedia',{media:'print'});
  check('printed article uses the full spread without empty sidebar tracks',await evaluate('getComputedStyle(document.querySelector(".reading-spread")).display==="block"&&getComputedStyle(document.querySelector(".field-route")).display==="none"&&getComputedStyle(document.querySelector(".chapter-margin")).display==="none"'));
  await send('Emulation.setEmulatedMedia',{media:'screen',features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  check('no runtime errors during responsive layout checks',report.consoleErrors.length===0,report.consoleErrors);
}
