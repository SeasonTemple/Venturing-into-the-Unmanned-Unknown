export async function run({send,evaluate,pause,check,report}) {
  report.metrics.surveyHeaders=[];
  for(const width of [2560,1440,1024,767,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:782,deviceScaleFactor:1,mobile:width===390});await pause(180);
    const metric=await evaluate(`(()=>{
      const opening=document.getElementById('opening'),hero=opening.getBoundingClientRect(),art=document.getElementById('chapter-art').getBoundingClientRect(),canvas=document.querySelector('.terrain-view canvas').getBoundingClientRect(),title=document.getElementById('chapter-title').getBoundingClientRect(),copy=document.querySelector('.opening-copy').getBoundingClientRect(),unknown=document.querySelector('.terrain-unknown-label').getBoundingClientRect(),note=document.querySelector('.field-note'),nr=note.getBoundingClientRect(),body=document.querySelector('.section-content').getBoundingClientRect();
      const chrome=document.querySelector('.reader-chrome'),preview=document.querySelector('.preview-bar');
      return {width:innerWidth,page:document.documentElement.scrollWidth,hero:{x:hero.x,w:hero.width,y:hero.y,bottom:hero.bottom},canvas:{x:canvas.x,w:canvas.width,h:canvas.height},title:{x:title.x,right:title.right,y:title.y,bottom:title.bottom},copyBottom:copy.bottom,artTop:art.top,unknown:{x:unknown.x,right:unknown.right,y:unknown.y,bottom:unknown.bottom},frame:getComputedStyle(document.querySelector('.terrain-view')).borderWidth,bodyBottom:body.bottom,noteTop:nr.top,noteFont:parseFloat(getComputedStyle(note).fontSize),tinySketches:document.querySelectorAll('.margin-sketch').length,chrome:getComputedStyle(chrome).backgroundColor,preview:getComputedStyle(preview).backgroundColor,heroColor:getComputedStyle(opening).backgroundColor};
    })()`);
    report.metrics.surveyHeaders.push(metric);
    check(`${width}px: terrain forms an unframed full-width chapter header`,metric.page<=width&&Math.abs(metric.hero.w-metric.canvas.w)<2&&metric.hero.x===0&&metric.frame==='0px'&&metric.title.y>metric.hero.y&&metric.title.bottom<metric.hero.bottom,metric);
    check(`${width}px: title stays compact over a full-height scene`,Math.abs(metric.canvas.h-(metric.hero.bottom-metric.hero.y))<2&&metric.copyBottom-metric.hero.y<(metric.hero.bottom-metric.hero.y)*.31,metric);
    check(`${width}px: navigation and preview share the chapter palette`,metric.chrome===metric.heroColor&&metric.preview===metric.heroColor,metric);
    check(`${width}px: unknown label stays inside the header`,metric.unknown.x>=0&&metric.unknown.right<=metric.hero.w&&metric.unknown.y>=metric.hero.y&&metric.unknown.bottom<=metric.hero.bottom,metric.unknown);
    check(`${width}px: annotations have readable type and no decorative micro-diagrams`,metric.noteFont>=15&&metric.tinySketches===0&&(width>=1400||metric.noteTop>=metric.bodyBottom),metric);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await pause(120);
  await evaluate(`window.__inkSample=()=>{const canvas=document.querySelector('.ink-atmosphere'),{width:w,height:h}=canvas,d=canvas.getContext('2d').getImageData(0,0,w,h).data,a=[];for(let y=20;y<h;y+=20)for(let x=20;x<w;x+=20)a.push({x,alpha:d[(y*w+x)*4+3]});return a;};window.__inkBefore=window.__inkSample();`);
  await pause(1800);
  const ink=await evaluate(`(()=>{const before=window.__inkBefore,after=window.__inkSample();let changed=0,interior=0,maxDelta=0,maxAlpha=0;for(let i=0;i<after.length;i++){const delta=Math.abs(after[i].alpha-before[i].alpha);maxDelta=Math.max(maxDelta,delta);maxAlpha=Math.max(maxAlpha,after[i].alpha);if(delta>=3)changed++;if(after[i].x>innerWidth*.15&&after[i].x<innerWidth*.85&&after[i].alpha>=8)interior++;}delete window.__inkBefore;delete window.__inkSample;return {samples:after.length,changedFraction:changed/after.length,interiorFraction:interior/after.length,maxDelta,maxAlpha};})()`);
  report.metrics.inkDiffusion=ink;
  check('survey scan changes actual pixels within two seconds while the prose area stays quiet',ink.maxDelta>=6&&ink.changedFraction>.04&&ink.interiorFraction>.005,ink);
  const reserve=await evaluate(`(()=>{const c=document.querySelector('.ink-atmosphere'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let center=0,edge=0,nc=0,ne=0;for(let y=10;y<c.height;y+=10)for(let x=10;x<c.width;x+=10){const a=d[(y*c.width+x)*4+3];if(x>c.width*.34&&x<c.width*.70){center+=a;nc++;}else if(x<c.width*.16||x>c.width*.88){edge+=a;ne++;}}return {center:center/nc,edge:edge/ne};})()`);
  check('the underlay preserves lower average opacity beneath the prose than at the edges',reserve.center<reserve.edge, reserve);
  // All flow pixels are alpha-capped before the optical blur plane.
  const lum=h=>{const v=h.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  const surface=await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.reading-veil'));return {opacity:Number(s.backgroundColor.match(/[\\d.]+/g)[3]),filter:s.backdropFilter,z:s.zIndex,flowZ:getComputedStyle(document.querySelector('.ink-atmosphere')).zIndex};})()`);
  check('a translucent optical blur plane sits above the surveying grid',surface.opacity>0&&surface.opacity<.4&&surface.filter.includes('blur(2px)')&&Number(surface.z)>Number(surface.flowZ),surface);
  check('flow opacity is capped even where moving light packets overlap',ink.maxAlpha<=149,ink);
  const alpha=.585*(1-surface.opacity);
  const background=[247,249,246].map((c,i)=>Math.floor(c*(1-alpha)+[81,147,94][i]*alpha)).map(c=>c.toString(16).padStart(2,'0')).join('');
  const palette=await evaluate(`(()=>{const s=getComputedStyle(document.body);return Object.fromEntries(['ink','muted','copper'].map(k=>[k,s.getPropertyValue('--rd-'+k).trim().slice(1)]));})()`);
  report.metrics.inkTextContrast={background,...Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,(lum(background)+.05)/(lum(color)+.05)]))};
  check('prose, annotations and links retain 4.5 contrast over the worst possible flow color',Object.keys(palette).every(k=>report.metrics.inkTextContrast[k]>=4.5),report.metrics.inkTextContrast);
}
