export function setupInstallation(book) {
  const $=id=>document.getElementById(id), repo=book.github.split('/').pop();
  let os=navigator.platform.startsWith('Win')?'powershell':'bash';
  function command() {
    // Copy into the project where the user runs the command, rather than into the cloned guide.
    const common=`git clone ${book.github}.git`;
    return os==='powershell'
      ? `${common}\nNew-Item -ItemType Directory -Force .agents/skills | Out-Null\nCopy-Item ${repo}/skills/* .agents/skills/ -Recurse -Force`
      : `${common}\nmkdir -p .agents/skills\ncp -R ${repo}/skills/* .agents/skills/`;
  }
  function select(value) {os=value;$('install-command').textContent=command();$('install-shell').textContent=`${os==='powershell'?'PowerShell':'Bash / zsh'} · 在目标项目目录运行`;$('copy-install').textContent='复制命令 ↗';document.querySelectorAll('[data-install-os]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.installOs===os)));}
  document.querySelectorAll('[data-install-os]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.installOs)));
  $('installation-edition').textContent=`${book.version} / ${book.license}`;
  $('copy-install').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(command());$('copy-install').textContent='已复制 ✓';$('install-status').textContent='已复制当前系统的安装命令。';}catch{$('install-status').textContent='复制暂不可用，可直接选择命令文本。';}});select(os);
  // Only verified release assets become direct download links. Failures retain Releases links.
  const observer=new IntersectionObserver(async entries=>{
    if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
    try {
      const repoPath=new URL(book.github).pathname;
      const response=await fetch(`https://api.github.com/repos${repoPath}/releases/latest`,{signal:AbortSignal.timeout(6000)});
      if(!response.ok)return;
      const release=await response.json();if(!Array.isArray(release.assets))return;
      const tests={skills:/\.zip$/i,source:/\.tar\.gz$/i,book:/^BOOK\.md$/i};
      let matches=0;
      for(const row of document.querySelectorAll('[data-artifact]')) {
        const asset=release.assets.find(a=>tests[row.dataset.artifact].test(a.name));
        if(!asset)continue;
        const url=new URL(asset.browser_download_url);if(url.protocol!=='https:'||url.hostname!=='github.com')continue;
        row.href=url.href;const size=Number(asset.size);row.querySelector('.artifact-file').textContent=`${asset.name}${Number.isFinite(size)?' · '+(size/1024).toFixed(1)+' KB':''}`;matches++;
      }
      if(matches)$('release-status').textContent=`${release.tag_name} · 文件名和大小取自 GitHub Release`;
    } catch { /* The public Releases links remain useful without the API. */ }
  },{rootMargin:'150px'});observer.observe($('installation'));
  addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
