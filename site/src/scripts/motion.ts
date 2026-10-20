// 全站动效运行时（无依赖）：顶栏滚动态、阅读进度、右栏共享指示条、首屏以下区块入场、代码块复制反馈。
// 与 Astro ClientRouter 配合：每次 astro:page-load（含首次加载）重新绑定；所有监听挂在同一个 AbortController 上，换页时整体撤销。
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let ac: AbortController | undefined;
let io: IntersectionObserver | undefined;
let mo: MutationObserver | undefined;

function init() {
  ac?.abort();
  io?.disconnect();
  mo?.disconnect();
  ac = new AbortController();
  const { signal } = ac;
  const root = document.documentElement;

  // 1) 顶栏 data-scrolled（>8px）+ 阅读进度（scaleX，仅 transform，不触发布局）
  const progress = document.querySelector<HTMLElement>('.mt-progress');
  // 进度条挂到 body 直接子级：它在 <main> 内的层叠上下文里时，z-index 压不过顶栏（z-index:10）
  if (progress && progress.parentElement !== document.body) document.body.append(progress);
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = window.scrollY;
    root.toggleAttribute('data-scrolled', y > 8);
    if (progress) {
      const max = root.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progress.style.setProperty('--mt-progress', p.toFixed(4));
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  addEventListener('scroll', schedule, { passive: true, signal });
  addEventListener('resize', schedule, { signal });
  update();

  // 2) 右栏 ON THIS PAGE：一根共享指示条，随 aria-current 变化只改 transform
  const toc = document.querySelector<HTMLElement>('.right-sidebar starlight-toc nav');
  if (toc) {
    toc.querySelectorAll('.mt-toc-bar').forEach((n) => n.remove());
    const bar = document.createElement('span');
    bar.className = 'mt-toc-bar';
    bar.setAttribute('aria-hidden', 'true');
    toc.append(bar);
    let placed = false;
    const place = () => {
      const cur = toc.querySelector<HTMLElement>('a[aria-current="true"]');
      if (!cur) return;
      const n = toc.getBoundingClientRect();
      const a = cur.getBoundingClientRect();
      if (!placed) {
        bar.dataset.instant = '';
        bar.style.transform = `translateY(${(a.top - n.top).toFixed(1)}px) scaleY(${a.height.toFixed(1)})`;
        bar.dataset.ready = '';
        void bar.offsetWidth;
        requestAnimationFrame(() => delete bar.dataset.instant);
        placed = true;
        return;
      }
      bar.style.transform = `translateY(${(a.top - n.top).toFixed(1)}px) scaleY(${a.height.toFixed(1)})`;
    };
    mo = new MutationObserver(place);
    mo.observe(toc, { attributes: true, attributeFilter: ['aria-current'], subtree: true });
    addEventListener('resize', place, { signal });
    place();
  }

  // 3) 首屏以下区块入场：进入视口时补 .mt-in（节奏同首屏：500ms、相邻 60ms）。减少动效时完全跳过，内容始终可见。
  if (!reduceMotion()) {
    const pending = [...document.querySelectorAll<HTMLElement>('[data-mt-reveal]')].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.92,
    );
    pending.forEach((el) => el.classList.add('mt-pre'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove('mt-pre');
          e.target.classList.add('mt-in');
          observer.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io = observer;
    pending.forEach((el) => observer.observe(el));
  }

  // 4) 代码块复制反馈。Expressive Code 成功时会在 [aria-live] 里插入 .feedback；没出现即判失败。
  document.addEventListener(
    'click',
    (ev) => {
      const btn = (ev.target as Element).closest?.<HTMLButtonElement>('.expressive-code .copy button');
      if (!btn) return;
      const live = btn.parentElement?.querySelector('[aria-live]');
      const setState = (state: 'done' | 'fail') => {
        delete btn.dataset.mtState;
        void btn.offsetWidth;
        btn.dataset.mtState = state;
        clearTimeout((btn as any)._mt);
        (btn as any)._mt = setTimeout(() => delete btn.dataset.mtState, 1600);
      };
      let settled = false;
      const watcher = new MutationObserver(() => {
        if (settled || !live?.querySelector('.feedback')) return;
        settled = true;
        watcher.disconnect();
        setState('done');
      });
      if (live) watcher.observe(live, { childList: true });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        watcher.disconnect();
        setState(live?.querySelector('.feedback') ? 'done' : 'fail');
      }, 600);
    },
    { signal },
  );
}

document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
