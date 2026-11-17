// Zero-dependency Assembly motion engine adapted from delineate/assembly/hand.
// Clock starts asleep so offscreen or settled stages cost 0 rAF frames.

export class Random {
  #s;
  constructor(seed) {
    this.#s = seed >>> 0;
  }
  random() {
    let t = (this.#s = (this.#s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }
  uniform(a, b) {
    return a + (b - a) * this.random();
  }
  normal(mean = 0, sd = 1) {
    const u = Math.max(1e-7, 1 - this.random());
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.random());
  }
  lognormal(median, spread) {
    return median * Math.exp(this.normal(0, spread));
  }
  chance(p) {
    return this.random() < p;
  }
  choice(items) {
    return items[Math.floor(this.random() * items.length)];
  }
}

export class Clock {
  now = 0;
  rate = 1;
  paused = false;
  frames = 0;
  #waits = [];
  #frames = new Set();
  #asleep = true;
  #raf = 0;
  #last = 0;

  get asleep() {
    return this.#asleep;
  }

  #tick = (ms) => {
    this.#raf = 0;
    if (this.#asleep) return;
    const dt = Math.min(Math.max(0, (ms - this.#last) / 1000), 1 / 20);
    this.#last = ms;
    if (!this.paused) {
      this.#advance(dt * this.rate);
      for (const frame of this.#frames) frame(this.now);
      this.frames++;
    }
    if (!this.#asleep && !this.paused) {
      this.#raf = requestAnimationFrame(this.#tick);
    }
  };

  sleep() {
    this.#asleep = true;
    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }
  }

  wake() {
    if (!this.#asleep && (this.#raf || this.paused)) return;
    this.#asleep = false;
    this.#last = performance.now();
    if (!this.paused && !this.#raf) {
      this.#raf = requestAnimationFrame(this.#tick);
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) {
      if (this.#raf) {
        cancelAnimationFrame(this.#raf);
        this.#raf = 0;
      }
    } else if (!this.#asleep && !this.#raf) {
      this.#last = performance.now();
      this.#raf = requestAnimationFrame(this.#tick);
    }
  }

  until(at) {
    return new Promise((done) => this.#waits.push({ at, done }));
  }

  wait(secs) {
    return this.until(this.now + secs);
  }

  each(frame) {
    this.#frames.add(frame);
    return () => this.#frames.delete(frame);
  }

  #advance(dt) {
    this.now += dt;
    const due = this.#waits.filter((w) => w.at <= this.now);
    this.#waits = this.#waits.filter((w) => w.at > this.now);
    for (const w of due) w.done();
  }
}

const minimumJerk = (u) => u * u * u * (10 - 15 * u + 6 * u * u);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function inside(p, b) {
  const m = Math.min(4, b.w * 0.2, b.h * 0.2);
  return p.x >= b.x + m && p.x <= b.x + b.w - m && p.y >= b.y + m && p.y <= b.y + b.h - m;
}

const clampInto = (p, b) => ({
  x: Math.min(Math.max(p.x, b.x + b.w * 0.3), b.x + b.w * 0.7),
  y: Math.min(Math.max(p.y, b.y + b.h * 0.3), b.y + b.h * 0.7),
});

export function reach(from, box, random, style = { tempo: 1, curl: 0.05, scatter: 1 }) {
  const width = Math.max(4, Math.min(box.w, box.h));
  const moves = [];
  let here = from;
  let t = 0;
  for (let i = 0; i <= 3; i++) {
    const aim = { x: centre(box).x + random.normal(0, box.w * 0.08), y: centre(box).y + random.normal(0, box.h * 0.08) };
    const d = distance(here, aim);
    const dx = (aim.x - here.x) / (d || 1);
    const dy = (aim.y - here.y) / (d || 1);
    const along = d * (1 - 0.03 + random.normal(0, 0.045 * style.scatter));
    const across = d * random.normal(0, 0.02 * style.scatter);
    let to = { x: here.x + dx * along - dy * across, y: here.y + dy * along + dx * across };
    if (i === 3) to = clampInto(to, box);
    const dur = style.tempo * (0.07 + 0.11 * Math.log2(d / width + 1));
    const bend = d * (style.curl + random.normal(0, 0.03));
    moves.push({ from: here, to, start: t, dur, bend });
    if (inside(to, box)) break;
    t += dur + random.lognormal(0.06, 0.35) * style.tempo;
    here = to;
  }
  return moves;
}

export const span = (moves) => {
  const last = moves[moves.length - 1];
  return last.start + last.dur;
};

export function at(moves, t) {
  let move = moves[0];
  for (const m of moves) if (t >= m.start) move = m;
  const u = Math.min(Math.max((t - move.start) / (move.dur || 1e-4), 0), 1);
  const s = minimumJerk(u ** 0.85);
  const { from, to } = move;
  const len = distance(from, to) || 1;
  const off = move.bend * 4 * s * (1 - s);
  return {
    x: from.x + (to.x - from.x) * s + (-(to.y - from.y) / len) * off,
    y: from.y + (to.y - from.y) * s + ((to.x - from.x) / len) * off,
  };
}

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
function neighbour(c, random) {
  const lower = c.toLowerCase();
  for (const [r, row] of ROWS.entries()) {
    const i = row.indexOf(lower);
    if (i < 0) continue;
    const near = [row[i - 1], row[i + 1], ROWS[r - 1]?.[i], ROWS[r + 1]?.[i]].filter(Boolean);
    const n = random.choice(near);
    return c === lower ? n : n.toUpperCase();
  }
  return c;
}

export function typing(before, text, random, typist = { pace: 26, slips: 0.012 }) {
  const keys = [];
  const beat = 1 / typist.pace;
  let shown = before;
  const gap = (c, prev) => {
    let g = random.lognormal(beat, 0.35);
    if (prev === ' ') g *= 1.5;
    if (/[.,;:!?，。；：！？]/.test(prev)) g *= 2.2;
    if (c !== c.toLowerCase()) g += beat * 0.6;
    return g;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = i ? text[i - 1] : '';
    if (/[a-z]/i.test(c) && random.chance(typist.slips)) {
      const wrong = neighbour(c, random);
      const after = text.slice(i + 1).match(/^[^\s]{0,2}/)[0].slice(0, Math.floor(random.uniform(0, 3)));
      shown += wrong;
      keys.push({ text: shown, gap: gap(wrong, prev) });
      for (const a of after) {
        shown += a;
        keys.push({ text: shown, gap: random.lognormal(beat, 0.3) });
      }
      for (let k = 0; k <= after.length; k++) {
        shown = shown.slice(0, -1);
        keys.push({ text: shown, gap: k ? random.lognormal(beat * 0.6, 0.2) : random.lognormal(beat * 6, 0.25) });
      }
    }
    shown += c;
    keys.push({ text: shown, gap: gap(c, prev) });
  }
  return keys;
}

function textRect(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

const shiftBox = (r, dx, dy) => ({ x: r.left + dx, y: r.top + dy, w: r.width, h: r.height });

export function stageSpace(el) {
  const origin = () => el.getBoundingClientRect();
  return {
    box: (target) => {
      const o = origin();
      return shiftBox(target.getBoundingClientRect(), -o.left, -o.top);
    },
    text: (target) => {
      const o = origin();
      return shiftBox(textRect(target), -o.left, -o.top);
    },
    point: (x, y) => {
      const o = origin();
      return { x: x - o.left, y: y - o.top };
    },
    view: () => ({ x: 0, y: 0, w: el.clientWidth, h: el.clientHeight }),
  };
}

const ARROW_AXIS = -118;
const LIT = 'color-mix(in oklab, var(--ink) 58%, #fff)';
const SHADE = 'var(--ink)';
const LINE = 'color-mix(in oklab, var(--ink) 62%, #000)';
const svgWrap = (body) => `<svg viewBox="-24 -24 48 48" width="48" height="48">${body}</svg>`;

function dart(s = 1) {
  const p = (x, y) => `${(x * s).toFixed(2)} ${(y * s).toFixed(2)}`;
  const outline = `M0 0Q${p(2.4, 9.4)} ${p(7, 19)}Q${p(3.1, 15.4)} ${p(0, 14.4)}Q${p(-3.1, 15.4)} ${p(-7, 19)}Q${p(-2.4, 9.4)} 0 0Z`;
  const left = `M0 0Q${p(-2.4, 9.4)} ${p(-7, 19)}Q${p(-3.1, 15.4)} ${p(0, 14.4)}Z`;
  const right = `M0 0L${p(0, 14.4)}Q${p(3.1, 15.4)} ${p(7, 19)}Q${p(2.4, 9.4)} 0 0Z`;
  return (
    `<path d="${outline}" fill="#fff" stroke="#fff" stroke-width="${(3.2 * s).toFixed(2)}" stroke-linejoin="round"/>` +
    `<path d="${left}" style="fill:${LIT}"/><path d="${right}" style="fill:${SHADE}"/>` +
    `<path d="M0 0L${p(0, 14.4)}" style="stroke:${LIT}" stroke-width="${(0.5 * s).toFixed(2)}" stroke-opacity="0.7"/>` +
    `<path d="${outline}" fill="none" style="stroke:${LINE}" stroke-width="${(0.85 * s).toFixed(2)}" stroke-linejoin="round"/>`
  );
}

const inked = (d, w = 1.3, rim = 2.4) =>
  `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${d}" stroke="#fff" stroke-width="${w + rim}"/>` +
  `<path d="${d}" style="stroke:${LINE}" stroke-width="${w}"/></g>`;

const rays = (angles, reachPx = 12) =>
  angles.map((a) => `<g transform="rotate(${a})">${inked(`M0 -2.6V-${reachPx - 5}`, 0.9, 2.2)}</g>`).join('') +
  angles.map((a) => `<g transform="rotate(${a}) translate(0 -${reachPx})">${dart(0.4)}</g>`).join('');

const SHAPES = {
  arrow: svgWrap(`<g transform="rotate(-28) scale(1.12)">${dart()}</g>`),
  text: svgWrap(inked('M-4 -9.5C-1.6 -9.5 0 -8.6 0 -6.6V6.6C0 8.6 -1.6 9.5 -4 9.5M4 -9.5C1.6 -9.5 0 -8.6 0 -6.6M4 9.5C1.6 9.5 0 8.6 0 6.6M-1.8 0H1.8', 1.15, 2.2)),
  cross: svgWrap(
    inked('M0 -11V-1.6M0 1.6V11M-11 0H-1.6M1.6 0H11', 0.8, 2) +
      `<circle r="4.2" fill="none" stroke="#fff" stroke-width="2.6"/><circle r="4.2" fill="none" style="stroke:${LINE}" stroke-width="0.8"/>`,
  ),
  pen: svgWrap(
    `<g transform="rotate(225)">` +
      `<path d="M0 0C-1.4 3.4 -6 7.4 -5.6 11.4L-4.4 18.4H4.4L5.6 11.4C6 7.4 1.4 3.4 0 0Z" fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>` +
      `<path d="M0 0C-1.4 3.4 -6 7.4 -5.6 11.4L-4.4 18.4H0Z" style="fill:${LIT}"/>` +
      `<path d="M0 0C1.4 3.4 6 7.4 5.6 11.4L4.4 18.4H0Z" style="fill:${SHADE}"/>` +
      `<path d="M0 0C-1.4 3.4 -6 7.4 -5.6 11.4L-4.4 18.4H4.4L5.6 11.4C6 7.4 1.4 3.4 0 0Z" fill="none" style="stroke:${LINE}" stroke-width="0.85" stroke-linejoin="round"/>` +
      `<path d="M0 1.2V8.6" stroke="#fff" stroke-width="0.9" stroke-linecap="round"/><circle cy="10" r="1.35" fill="#fff"/>` +
      `<path d="M-4.4 15.2H4.4" style="stroke:${LINE}" stroke-width="0.6" stroke-opacity="0.6"/></g>`,
  ),
  resize: svgWrap(rays([-45, 135])),
};

export class Pointer {
  #glyph;
  #tag;
  #shape;
  constructor(layer, colour, name, tilt = 0) {
    this.el = document.createElement('div');
    this.el.className = 'pointer';
    this.el.style.setProperty('--ink', colour);
    this.el.style.setProperty('--tilt', `${tilt}deg`);
    this.#glyph = document.createElement('span');
    this.#glyph.className = 'pointer-glyph';
    this.#tag = document.createElement('span');
    this.#tag.className = 'pointer-tag';
    this.#tag.textContent = name;
    this.el.append(this.#glyph, this.#tag);
    layer.append(this.el);
    this.shape = 'arrow';
  }
  set shape(shape) {
    if (shape === this.#shape) return;
    this.#shape = shape;
    this.#glyph.innerHTML = SHAPES[shape] ?? SHAPES.arrow;
    this.el.dataset.shape = shape;
  }
  set tagged(on) {
    this.el.classList.toggle('is-tagged', on);
  }
  place(x, y, turn) {
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.#glyph.style.transform = turn ? `rotate(${turn.toFixed(1)}deg)` : '';
  }
}

const px = (v) => `${Math.round(v * 2) / 2}px`;
const fmtSize = (b) => `${Math.round(b.w)} × ${Math.round(b.h)}`;

export class Frame {
  box = { x: 0, y: 0, w: 0, h: 0 };
  #badge;
  #label = null;
  #marks;
  constructor(marks, layer) {
    this.#marks = marks;
    this.el = document.createElement('div');
    this.el.className = 'frame';
    this.el.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>';
    this.#badge = document.createElement('span');
    this.#badge.className = 'frame-badge';
    this.el.append(this.#badge);
    layer.append(this.el);
  }
  set(box) {
    const x = Math.min(box.x, box.x + box.w);
    const y = Math.min(box.y, box.y + box.h);
    this.box = { x, y, w: Math.abs(box.w), h: Math.abs(box.h) };
    Object.assign(this.el.style, { left: px(x), top: px(y), width: px(this.box.w), height: px(this.box.h) });
    this.#badge.textContent = this.#label ?? fmtSize(this.box);
    return this;
  }
  label(text) {
    this.#label = text;
    this.#badge.textContent = text ?? fmtSize(this.box);
    return this;
  }
  conflict(on) {
    this.el.classList.toggle('is-conflict', on);
    return this;
  }
  fill(on) {
    this.el.classList.toggle('is-fill', on);
    return this;
  }
  bare(on) {
    this.el.classList.toggle('is-bare', on);
    return this;
  }
  remove() {
    this.#marks.frames.delete(this);
    this.el.classList.add('is-leaving');
    setTimeout(() => this.el.remove(), 260);
  }
}

export class Guide {
  #across;
  constructor(layer, coord, across = false) {
    this.#across = across;
    this.el = document.createElement('div');
    this.el.className = across ? 'guide is-across' : 'guide';
    this.el.style[across ? 'top' : 'left'] = px(coord);
    layer.append(this.el);
  }
  span(a0, a1) {
    const [start, length] = this.#across ? ['left', 'width'] : ['top', 'height'];
    Object.assign(this.el.style, { [start]: px(Math.min(a0, a1)), [length]: px(Math.abs(a1 - a0)) });
  }
  remove() {
    this.el.classList.add('is-leaving');
    setTimeout(() => this.el.remove(), 400);
  }
}

export class Extension {
  constructor(layer) {
    this.el = document.createElement('div');
    this.el.className = 'extension';
    layer.append(this.el);
  }
  set(x0, y0, x1, y1) {
    const across = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
    this.el.classList.toggle('is-across', across);
    Object.assign(this.el.style, {
      left: px(Math.min(x0, x1)),
      top: px(Math.min(y0, y1)),
      width: px(across ? Math.abs(x1 - x0) : 1),
      height: px(across ? 1 : Math.abs(y1 - y0)),
    });
  }
  remove() {
    this.el.remove();
  }
}

export class Marks {
  frames = new Set();
  constructor(layer) {
    this.layer = layer;
  }
  frame() {
    const f = new Frame(this, this.layer);
    this.frames.add(f);
    return f;
  }
  guide(coord, across = false) {
    return new Guide(this.layer, coord, across);
  }
  extension() {
    return new Extension(this.layer);
  }
  align(x0, y0, x1, y1) {
    const el = document.createElement('div');
    el.className = 'align';
    Object.assign(el.style, {
      left: px(Math.min(x0, x1)),
      top: px(Math.min(y0, y1)),
      width: px(Math.max(Math.abs(x1 - x0), 1)),
      height: px(Math.max(Math.abs(y1 - y0), 1)),
    });
    el.addEventListener('animationend', () => el.remove());
    this.layer.append(el);
  }
}

export class Hand {
  tool = 'arrow';
  #style;
  #typist;
  #t;
  #course = null;
  #heading = null;
  #turn = 0;
  #presses = 0;
  #unsub;

  constructor(clock, layer, o) {
    this.clock = clock;
    this.name = o.name;
    this.colour = o.colour;
    this.random = new Random(o.seed);
    this.pointer = new Pointer(layer, o.colour, o.name, this.random.uniform(-3.5, 2.5));
    this.#style = o.style ?? { tempo: 0.55, curl: 0.05, scatter: 1 };
    this.#typist = o.typist ?? { pace: 26, slips: 0.012 };
    this.pos = { ...o.start };
    this.#t = clock.now;
    this.#unsub = clock.each((now) => this.#frame(now));
  }

  dispose() {
    this.#unsub?.();
    this.pointer.el.remove();
  }

  #begin() {
    return (this.#t = Math.max(this.#t, this.clock.now));
  }

  rest(secs) {
    return this.clock.until((this.#t = this.#begin() + secs));
  }

  reach(box, tempo = 1) {
    const style = { ...this.#style, tempo: this.#style.tempo * tempo };
    const moves = reach(this.pos, box, this.random, style);
    const start = this.#begin();
    this.#heading = null;
    this.#course = { start, end: start + span(moves), at: (t) => at(moves, t - start) };
    return this.clock.until((this.#t = this.#course.end));
  }

  reachPoint(p, r = 4, tempo = 1) {
    return this.reach({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }, tempo);
  }

  follow(points, dt) {
    const start = this.#begin();
    const last = points.length - 1;
    this.#heading = null;
    this.#course = {
      start,
      end: start + dt * last,
      at: (t) => {
        const k = Math.min(Math.max((t - start) / dt, 0), last);
        const i = Math.min(Math.floor(k), Math.max(last - 1, 0));
        const j = Math.min(i + 1, last);
        const u = k - i;
        return { x: points[i].x + (points[j].x - points[i].x) * u, y: points[i].y + (points[j].y - points[i].y) * u };
      },
    };
    return this.clock.until((this.#t = this.#course.end));
  }

  async press() {
    await this.rest(this.random.lognormal(0.09, 0.32) * this.#style.tempo);
    this.#presses++;
    this.pointer.tagged = true;
  }

  release() {
    const n = this.#presses;
    this.clock.until(this.#t + 0.5).then(() => {
      if (this.#presses === n) this.pointer.tagged = false;
    });
  }

  async click() {
    await this.press();
    await this.rest(this.random.lognormal(0.08, 0.2));
    this.release();
  }

  async type(text, write, rush = 1) {
    for (const key of typing('', text, this.random, { ...this.#typist, pace: this.#typist.pace * rush })) {
      await this.clock.until((this.#t = this.#begin() + key.gap));
      write(key.text);
    }
  }

  #frame(now) {
    if (this.#course) {
      this.pos = this.#course.at(Math.min(now, this.#course.end));
      if (now >= this.#course.end) this.#course = null;
    }
    const want = this.#heading === null ? 0 : this.#heading - ARROW_AXIS;
    const d = ((want - this.#turn + 540) % 360) - 180;
    this.#turn += d * 0.25;
    if (Math.abs(this.#turn) < 0.05 && this.#heading === null) this.#turn = 0;
    this.pointer.shape = this.#heading === null ? this.tool : 'arrow';
    this.pointer.place(this.pos.x, this.pos.y, this.#turn);
  }
}
