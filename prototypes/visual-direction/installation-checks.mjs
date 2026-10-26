export async function run({send,evaluate,until,pause,check,report}) {
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:4395/?still=1'});
  await until('!!window.__visualStudy');await evaluate('window.__visualStudy.ready');
  check('installation command and three download choices are visible without expanding anything',await evaluate('!document.getElementById("install-command").closest("details") && document.querySelectorAll(".artifact").length===3 && getComputedStyle(document.getElementById("install-command")).display!=="none"'));
  await evaluate('document.querySelector(\'[data-install-os="powershell"]\').click()');
  check('Windows command prepares destination and copies from the cloned guide',await evaluate('document.getElementById("install-command").textContent.includes("New-Item") && document.getElementById("install-command").textContent.includes("Copy-Item Venturing-into-the-Unmanned-Unknown/skills/* .agents/skills/") && document.querySelectorAll("[data-install-os][aria-pressed=true]").length===1'));
  await evaluate('document.querySelector(\'[data-install-os="bash"]\').focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  check('keyboard switches to the Bash installation command',await evaluate('document.getElementById("install-command").textContent.includes("mkdir -p .agents/skills") && document.getElementById("install-shell").textContent.startsWith("Bash")'));
  await send('Browser.grantPermissions',{origin:'http://127.0.0.1:4395',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
  await send('Page.bringToFront');await evaluate('document.getElementById("copy-install").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until('document.getElementById("install-status").textContent.length>0');
  const copied=await evaluate('(async()=>{const actual=await navigator.clipboard.readText(),expected=document.getElementById("install-command").textContent;return {button:document.getElementById("copy-install").textContent,message:document.getElementById("install-status").textContent,focused:document.hasFocus(),actualLength:actual.length,expectedLength:expected.length,equal:actual.replace(/\\r\\n/g,"\\n")===expected.replace(/\\r\\n/g,"\\n")}})()');
  check('copy action copies the selected command with visible feedback',copied.button.includes('已复制')&&copied.equal,copied);
  check('download choices resolve to real release links and Agent text endpoints respond',await evaluate('(async()=>[...document.querySelectorAll(".artifact")].every(a=>a.href.startsWith("https://github.com/SeasonTemple/Venturing-into-the-Unmanned-Unknown/releases")) && (await Promise.all([...document.querySelectorAll(".agent-access a")].map(a=>fetch(a.href)))).every(r=>r.ok))()'));
  report.metrics.installation=[];
  for(const [width,height] of [[2560,1440],[1251,1262],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});await pause(100);
    const metric=await evaluate('({width:innerWidth,page:document.documentElement.scrollWidth,section:document.getElementById("installation").clientWidth,terminal:document.querySelector(".install-terminal").clientWidth,code:document.querySelector(".install-terminal pre").clientWidth,codeScroll:document.querySelector(".install-terminal pre").scrollWidth})');report.metrics.installation.push(metric);
    check(`${width}px: install and download section fits with local command overflow`,metric.page<=width&&metric.terminal<=metric.section&&metric.code<=metric.terminal,metric);
  }
}
