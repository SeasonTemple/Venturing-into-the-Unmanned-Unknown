const player = document.querySelector('#player');
const status = document.querySelector('#load-status');
const slider = document.querySelector('#frame');
const play = document.querySelector('#play');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const speed = document.querySelector('#speed');
const loop = document.querySelector('#loop');
const source = document.querySelector('#paint-source');
const frameLabel = document.querySelector('#frame-label');
const note = document.querySelector('#paint-note');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const study = new URLSearchParams(location.search).get('study');
const hipStudy = study === 'hip06';
const gaitStudy = study === 'gait05' || hipStudy;
const mediaBase = new URL(hipStudy ? 'actor-rig-v06/' : gaitStudy ? 'actor-rig-v05/' : 'actor-rig-v04/', import.meta.url);
const contexts = Object.fromEntries(['actor', 'knee-before', 'knee-after', 'small'].map(id => {
  const context = document.getElementById(id).getContext('2d');
  context.imageSmoothingEnabled = false;
  return [id, context];
}));
let data, before, after, frame = 1, playing = false, task = null, generation = 0;

function drawCrop(context, atlas, sx, sy, sw, sh) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.drawImage(atlas, sx, sy, sw, sh, 0, 0, context.canvas.width, context.canvas.height);
}

function render() {
  const item = data.frames[frame - 1];
  const [w, h] = data.frameSize;
  const x = (frame - 1) % data.columns * w;
  const y = Math.floor((frame - 1) / data.columns) * h;
  const atlas = document.querySelector('input[name=version]:checked').value === 'after' ? after : before;
  drawCrop(contexts.actor, atlas, x, y, w, h);
  drawCrop(contexts.small, atlas, x, y, w, h);
  if (gaitStudy) {
    drawCrop(contexts['knee-before'], before, x + 70 + Math.round(item.beforeRootX), y + 208, 160, 192);
    drawCrop(contexts['knee-after'], after, x + 70 + Math.round(item.rootX), y + 208, 160, 192);
  } else {
    const [kx, ky] = item.knee;
    drawCrop(contexts['knee-before'], before, x + kx - 14, y + ky - 20, 40, 48);
    drawCrop(contexts['knee-after'], after, x + kx - 14, y + ky - 20, 40, 48);
  }
  slider.value = frame;
  slider.setAttribute('aria-valuetext', `第 ${frame} 帧，共 ${data.frameCount} 帧，${item.label}`);
  frameLabel.textContent = `${frame} / ${data.frameCount} · ${item.label}`;
  if (gaitStudy) {
    note.textContent = `已前移 ${Math.round(-item.rootX)} 原画像素 · ${item.support.length === 2 ? '双脚' : item.support === 'R' ? '右脚' : '左脚'}支撑。`;
    source.hidden = false;
    source.href = new URL(data.sourceRig, mediaBase).href;
  } else {
    note.textContent = item.changedPixels ? `${item.side === 'R' ? '右' : '左'}膝 · 此帧局部改动 ${item.changedPixels} 像素。` : '此帧未修绘，两版一致。';
    source.hidden = !item.ora;
    if (item.ora) source.href = new URL(item.ora, mediaBase).href;
    else source.removeAttribute('href');
  }
  previous.disabled = frame === 1;
  next.disabled = frame === data.frameCount;
  player.dataset.frame = frame;
}

function pause(message = '已暂停，可逐帧查看。') {
  playing = false;
  generation++;
  clearTimeout(task);
  task = null;
  play.textContent = frame === data?.frameCount ? '从头播放' : '播放一次';
  player.dataset.playing = 'false';
  status.textContent = message;
}

function seek(value) {
  pause();
  frame = Math.max(1, Math.min(data.frameCount, Number(value)));
  render();
  play.textContent = frame === data.frameCount ? '从头播放' : '播放一次';
}

function start() {
  if (!data || document.hidden) return;
  if (frame === data.frameCount) frame = 1;
  playing = true;
  const token = ++generation;
  const firstFrame = frame;
  const started = performance.now();
  const period = 1000 / (data.fps * Number(speed.value));
  play.textContent = '暂停';
  status.textContent = '播放中 · 两版同步';
  player.dataset.playing = 'true';
  render();
  function advance() {
    if (!playing || token !== generation) return;
    const elapsed = performance.now() - started;
    const expected = firstFrame + Math.floor(elapsed / period);
    if (expected > data.frameCount) {
      if (loop.checked) { frame = 1; start(); return; }
      frame = data.frameCount;
      render();
      pause('播放结束，可逐帧查看。');
      return;
    }
    if (frame !== expected) { frame = expected; render(); }
    task = setTimeout(advance, Math.max(4, period - elapsed % period));
  }
  task = setTimeout(advance, period);
}

play.addEventListener('click', () => playing ? pause() : start());
previous.addEventListener('click', () => seek(frame - 1));
next.addEventListener('click', () => seek(frame + 1));
slider.addEventListener('input', () => seek(slider.value));
speed.addEventListener('change', () => { if (playing) { pause(); start(); } });
document.querySelectorAll('[name=version]').forEach(control => control.addEventListener('change', () => data && render()));
document.querySelector('#keyframes').addEventListener('click', event => {
  const button = event.target.closest('button[data-frame]');
  if (button) seek(button.dataset.frame);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause('页面已离开，播放暂停。'); });
reduced.addEventListener('change', () => { loop.checked = false; if (playing) pause('动态偏好已改变，播放暂停。'); });
// This event does not bubble reliably: listen on the content-visibility owner.
player.addEventListener('contentvisibilityautostatechange', event => {
  if (event.skipped && playing) pause('预览已离开可绘制区域，播放暂停。');
});
if (!('contentVisibility' in document.documentElement.style) || !('oncontentvisibilityautostatechange' in player)) {
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting && playing) pause('预览已离开画面，播放暂停。');
  }, {rootMargin: '100px'}).observe(player);
}
window.addEventListener('pagehide', () => pause());

async function loadImage(name) {
  const image = new Image();
  image.src = new URL(name, mediaBase).href;
  await image.decode();
  return image;
}
// Show the rejection before media loading; a failed atlas must not hide it.
if (gaitStudy) configureGaitReview();
try {
  const response = await fetch(new URL('review.json', mediaBase));
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  data = await response.json();
  [before, after] = await Promise.all([loadImage(data.beforeAtlas), loadImage(data.afterAtlas)]);
  document.querySelector('#transport').inert = false;
  player.dataset.ready = 'true';
  render();
  pause(reduced.matches ? '已静止 · 按需播放，减少动态偏好已生效。' : '已就绪 · 按需播放');
} catch (error) {
  status.textContent = '图集读取失败；请刷新重试，或查看下方静帧。';
  player.dataset.error = error.message;
}

function configureGaitReview() {
  document.title = '交替承重与停步 · 逐帧检查';
  const copy = {
    '#study-number': '人物动作试制 / 05',
    '#study-title': '从挪近，到交替迈步。',
    '#study-intro': '未通过的历史试验。步序改变没有解决站立屈膝、髋腿形体与交会遮挡问题；此页只保留复盘，不作为最新修正或成品推荐。',
    '#review-heading': '交替承重 → 迈步 → 停稳',
    '#study-notes': '上一版前脚先迈，后脚追近；身体在各关键姿态之间反复减速。05 改为左后脚先越过右脚，随后右脚越过左脚；身体持续向前，停步时收回前倾，箱体再回摆归正。上方两幅近景跟随各自身体，显示髋部至鞋底的原始像素。',
    '#study-limits': '新版未套用旧衣褶修绘。脚掌滚动、腿部交会的遮挡与裤料形变仍需检查；这是固定视角的两步候选，尚未验证转身、多方向、循环或场景接触。位移曲线是动作控制，不是人体质心或物理模拟。',
    '#paint-source': '打开步态骨架工程 ↗',
    '#study-still': '查看新版关键姿态 ↗',
  };
  if (hipStudy) {
    document.title = '06 未通过 · 历史动作试验';
    Object.assign(copy, {
      '#study-number': '未通过的历史试验 / 06',
      '#study-title': '此版已撤回。',
      '#study-intro': '髋到膝的形体不连续，上大腿出现假关节；站姿和完整迈步也未成立。局部权重调整没有解决这些问题，此页仅保留失败记录。当前没有已通过的行走版本。',
      '#review-heading': '05 与 06 / 两版均未通过',
      '#study-notes': '为避免髋部露缝，旧绑定将较大一段上腿留给骨盆；跟随预览抵消身体平移后，就显得像固定的贴片。06 提前提箱侧的权重过渡，让上大腿参与摆动。记录器一侧保留原权重，此处隐藏衣料不足仍需补齐。',
      '#study-limits': '失败项：髋到膝出现非关节折角；轻微下沉就改变原站姿的膝向；腿部交会缺少可信的体积与遮挡；鞋底没有随步态滚动。骨长、脚点或导出检查不能证明这些美术问题已经解决。停止沿用此版扩展动作。',
    });
  }
  for (const [selector, value] of Object.entries(copy)) document.querySelector(selector).textContent = value;
  for (const [id, title] of [['before-caption', hipStudy ? '05 / 未通过' : '04 / 短步追近'], ['after-caption', hipStudy ? '06 / 已撤回' : '05 / 交替迈步']]) {
    const caption = document.getElementById(id);
    caption.firstChild.nodeValue = title;
    caption.querySelector('span').textContent = '髋部至鞋底 · 1×';
  }
  document.querySelector('[name=version][value=before]').parentNode.lastChild.nodeValue = hipStudy ? '原权重 05' : '上一版 04';
  document.querySelector('[name=version][value=after]').parentNode.lastChild.nodeValue = hipStudy ? '已撤回的试验 06' : '未通过的步态 05';
  contexts['knee-before'].canvas.setAttribute('aria-label', '上一版短步的髋部至鞋底，原始像素。');
  contexts['knee-after'].canvas.setAttribute('aria-label', '新版交替步态的髋部至鞋底，与上一版同步。');
  document.querySelector('#study-still').href = new URL(hipStudy ? 'actor-v06-keyposes.png' : 'actor-v05-keyposes.png', mediaBase).href;
  const keys = [[1, '站立'], [8, '左脚经过'], [13, '左脚落地'], [18, '右脚经过'], [23, '右脚落地'], [31, '停稳']];
  document.querySelector('#keyframes').replaceChildren(...keys.map(([frame, title]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.frame = frame; button.textContent = title;
    return button;
  }));
}
