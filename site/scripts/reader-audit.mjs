// Same owned Chrome / viewport / 4x CPU throttle for before-and-after measurements.
export async function run({send,evaluate,until,pause,check,report}) {
  const base='http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown';
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Performance.enable');await send('Emulation.setCPUThrottlingRate',{rate:4});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__audit={contexts:[],longTasks:[]};const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl/i.test(type))window.__audit.contexts.push(type);return original.call(this,type,...args)};new PerformanceObserver(list=>window.__audit.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});`});
  report.metrics.reader=[];
  for(const width of [1440,390]) {
    const profile=width===1440&&process.argv.includes('--profile-reader');
    if(profile){await send('Profiler.enable');await send('Profiler.start');}
    await send('Emulation.setDeviceMetricsOverride',{width,height:width<700?844:960,deviceScaleFactor:1,mobile:width<700});
    await send('Page.navigate',{url:base+'/ch3/'});await until('window.__readingStudy?.ready');
    await until('window.__readingStudy.artwork.status!=="loading"');await pause(150);
    await evaluate('document.getElementById("body").scrollIntoView({behavior:"instant"})');
    await until('window.__readingStudy.effects.surface');await pause(500);
    const data=await evaluate(`({width:innerWidth,contexts:window.__audit.contexts,longTasks:window.__audit.longTasks,resources:performance.getEntriesByType('resource').filter(e=>/\.js|\.mjs/.test(e.name)).map(e=>({name:e.name.split('/').pop(),bytes:e.encodedBodySize})),artwork:window.__readingStudy.artwork,effects:window.__readingStudy.effects})`);
    data.longTaskTotalMs=Math.round(data.longTasks.reduce((sum,t)=>sum+t.duration,0));
    data.longestTaskMs=Math.round(Math.max(0,...data.longTasks.map(t=>t.duration)));
    data.jsBytes=data.resources.reduce((sum,r)=>sum+r.bytes,0);
    report.metrics.reader.push(data);
    if(profile){const {profile:p}=await send('Profiler.stop');const weights=new Map();p.samples.forEach((id,i)=>weights.set(id,(weights.get(id)||0)+(p.timeDeltas[i]||0)));report.metrics.cpuProfile=p.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url.split('/').pop(),line:n.callFrame.lineNumber,ms:Math.round((weights.get(n.id)||0)/1000)})).sort((a,b)=>b.ms-a.ms).slice(0,12);}
    check(`${width}px reader remains functional during performance audit`,await evaluate('document.querySelectorAll("#body h2").length===10&&window.__readingStudy.errors.length===0'));
  }
  await send('Emulation.setCPUThrottlingRate',{rate:1});
}
