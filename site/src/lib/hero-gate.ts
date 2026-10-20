// 首屏 3D 场景的加载闸门。默认只显示静态海报；全部条件成立才动态 import 场景（含 three）。
// 任一条件不成立 = 永远只有海报。海报始终留在 canvas 下方，场景销毁后立刻露出海报，不会黑屏。

const MIN_WIDTH = 821; // ≤820px 的竖屏手机：海报只有 16:9 一个机位，与竖屏相机构图对不上，直接只显示海报

type Scene = { mount(el: HTMLElement, o?: { onLost?: () => void }): unknown; destroy(): unknown };

const forcedStatic = () =>
  new URLSearchParams(location.search).get('static') === '1' || import.meta.env.PUBLIC_HERO_STATIC === '1';

const saveData = () => !!(navigator as any).connection?.saveData;

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

const afterLoadIdle = () =>
  new Promise<void>((resolve) => {
    const idle = () => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(() => resolve(), { timeout: 2000 }) : setTimeout(resolve, 200));
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });

/** 返回 teardown：撤销监听、销毁场景。重复调用安全。 */
export function initHero(): (() => void) | undefined {
  const root = document.querySelector<HTMLElement>('[data-hero-scene]');
  const stage = root?.querySelector<HTMLElement>('[data-hero-stage]');
  if (!root || !stage || forcedStatic()) return;

  const host = root.closest<HTMLElement>('.mt-hero') ?? root;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: ' + (MIN_WIDTH - 1) + 'px)');
  const conn = (navigator as any).connection as EventTarget | undefined;
  let scene: Scene | null = null;
  let gone = false;

  const allowed = () => !gone && !reduce.matches && !narrow.matches && !saveData() && webglOk();
  const stop = () => {
    root.classList.remove('is-live');
    if (scene) { try { scene.destroy(); } catch {} scene = null; }
  };
  const onCond = () => { if (reduce.matches || saveData() || narrow.matches) stop(); };
  reduce.addEventListener('change', onCond);
  narrow.addEventListener('change', onCond);
  conn?.addEventListener('change', onCond);

  async function load() {
    await afterLoadIdle();
    if (!allowed()) return;
    let mod: Scene;
    try { mod = (await import('../components/hero/scene.js')) as unknown as Scene; } catch { return; }
    if (!allowed()) return;
    const api = mod.mount(stage!, { onLost: stop });
    if (!api) return;
    scene = mod;
    // 首帧已在 mount 内同步渲染完；等浏览器合成一帧后再淡入，避免淡入起点是空白 canvas
    requestAnimationFrame(() => requestAnimationFrame(() => { if (scene) root!.classList.add('is-live'); }));
  }

  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); void load(); }
  }, { threshold: 0.1 });
  io.observe(host);

  return () => {
    gone = true;
    io.disconnect();
    reduce.removeEventListener('change', onCond);
    narrow.removeEventListener('change', onCond);
    conn?.removeEventListener('change', onCond);
    stop();
  };
}
