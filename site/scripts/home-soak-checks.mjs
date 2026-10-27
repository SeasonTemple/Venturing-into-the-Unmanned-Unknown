// Use the existing owned-browser runner. No screenshots or extra Chrome instances.
export async function run({send,evaluate,until,pause,check,report}){
 await send('Emulation.setDeviceMetricsOverride',{width:2560,height:1440,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:4395/Venturing-into-the-Unmanned-Unknown/'});
 await until('!!window.__meadowMotion');await pause(1200);
 await send('Performance.enable');await send('HeapProfiler.collectGarbage');
 await evaluate(`window.__soakLongTasks=[];window.__soakObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())window.__soakLongTasks.push({start:e.startTime,duration:e.duration});});window.__soakObserver.observe({type:'longtask'});`);
 const sample=async()=>({time:Date.now(),motion:await evaluate('window.__meadowMotion.stats()'),performance:Object.fromEntries((await send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])),dom:await send('Memory.getDOMCounters')});
 const samples=[await sample()];
 const windows=process.argv.includes('--baseline')?12:18;
 for(let i=0;i<windows;i++){await pause(10000);samples.push(await sample());process.stdout.write('soak '+(i+1)*10+'s\n');}
 await send('HeapProfiler.collectGarbage');const retained=await sample();
 const first=samples[0],last=samples.at(-1),wall=(last.time-first.time)/1000;
 report.metrics.soak={seconds:wall,samples,retainedHeapDelta:retained.performance.JSHeapUsedSize-first.performance.JSHeapUsedSize,mainThreadDuty:(last.performance.TaskDuration-first.performance.TaskDuration)/wall,longTasks:await evaluate('window.__soakLongTasks')};
 check('two-minute 2K run retains one renderer and bounded texture count',last.motion.textureCount===first.motion.textureCount&&last.motion.drawsPerFrame===1);
 check('retained JavaScript heap grows by less than 2 MiB',report.metrics.soak.retainedHeapDelta<2*1024*1024,report.metrics.soak.retainedHeapDelta);
 check('DOM nodes remain bounded through the sustained run',last.dom.nodes-first.dom.nodes<20,{first:first.dom,last:last.dom});
 check('no runtime errors during sustained rendering',report.consoleErrors.length===0,report.consoleErrors);
}
