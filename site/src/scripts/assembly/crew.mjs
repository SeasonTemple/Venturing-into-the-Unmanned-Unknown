// Crew task orchestrator adapted from delineate/assembly/hand/crew.ts.
// Takes finalized markup, decomposes it into guides, blocks, typed text,
// conflicting concurrent gate slots, and vector pen strokes.

const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function painted(el) {
  const s = getComputedStyle(el);
  const bg = s.backgroundColor;
  const hasBg = bg !== 'transparent' && !/,\s*0\)$/.test(bg) && bg !== 'rgba(0, 0, 0, 0)';
  const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
    (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
  );
  return hasBg || hasBorder || s.boxShadow !== 'none' || el instanceof SVGSVGElement;
}

const isLeaf = (el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '';

export class Crew {
  stats = { total: 0, done: 0, busy: 0, conflicts: 0, settled: 0 };
  onchange = () => {};
  #hands;
  #marks;
  #clock;
  #space;
  #sections = [];
  #finish;
  #over = false;

  constructor(root, hands, marks, clock, space) {
    this.#hands = hands;
    this.#marks = marks;
    this.#clock = clock;
    this.#space = space;
    this.finished = new Promise((done) => (this.#finish = done));
    root.querySelectorAll('[data-section]').forEach((el, index) => {
      const section = { el, index, active: true, tasks: [], guides: [], built: [] };
      this.#sections.push(section);
      this.#read(section);
    });
    this.stats.total = this.#sections.reduce((n, s) => n + s.tasks.length, 0);
  }

  start() {
    for (const h of this.#hands) this.#work(h);
  }

  stop() {
    this.#over = true;
    for (const s of this.#sections) {
      for (const g of s.guides) g.remove();
      s.guides = [];
    }
  }

  #read(section) {
    const guides = this.#guides(section);
    const walk = (el, parent) => {
      for (const child of el.children) {
        if (!(child instanceof HTMLElement || child instanceof SVGSVGElement)) continue;
        const build = child.dataset.build;
        if (build === 'skip' || child.getClientRects().length === 0) continue;
        if (build === 'draw') {
          child.querySelectorAll('g[data-hand]').forEach((g) => this.#add(section, [...guides, ...parent], this.#draw(g)));
          continue;
        }
        if (build === 'slots') {
          const slots = [...child.children];
          const row = this.#row(slots);
          slots.forEach((slot, i) => this.#add(section, [...guides, ...parent], this.#slot(slot, i, row)));
          continue;
        }
        const isBlock = build === 'block' || (build !== 'type' && build !== 'headline' && painted(child));
        if (isBlock) {
          const t = this.#add(section, [...guides, ...parent], this.#block(child));
          if (isLeaf(child)) this.#add(section, [...guides, t], this.#text(child, true));
          else walk(child, [t]);
        } else if (isLeaf(child) || build === 'type' || build === 'headline') {
          this.#add(section, [...guides, ...parent], this.#text(child, false));
        } else {
          walk(child, parent);
        }
      }
    };
    walk(section.el, []);
  }

  #add(section, deps, work) {
    const task = { section, deps, state: 'waiting', ...work };
    section.tasks.push(task);
    return task;
  }

  #guides(section) {
    const wrap = section.el.querySelector('.wrap') ?? section.el;
    const heading = section.el.querySelector('h2, h3');
    const across = heading
      ? [
          this.#add(section, [], {
            where: () => ({ x: this.#space.view().x + 36, y: this.#space.text(heading).y }),
            run: async (h) => {
              const v = this.#space.view();
              const y = this.#space.text(heading).y;
              const x0 = v.x + Math.min(24, v.w * 0.04);
              h.tool = 'cross';
              await h.reachPoint({ x: x0, y }, 2);
              await h.press();
              const guide = this.#marks.guide(y, true);
              section.guides.push(guide);
              const stop = this.#clock.each(() => guide.span(x0, h.pos.x));
              await h.reachPoint({ x: x0 + v.w * h.random.uniform(0.18, 0.28), y }, 2, 1.05);
              stop();
              guide.span(v.x, v.x + v.w);
              h.release();
              h.tool = 'arrow';
            },
          }),
        ]
      : [];
    return [
      ...across,
      ...[0, 1].map((side) =>
        this.#add(section, [], {
          where: () => {
            const b = this.#space.box(wrap);
            return { x: side ? b.x + b.w : b.x, y: Math.max(b.y, this.#space.view().y + 32) };
          },
          run: async (h) => {
            const b = this.#space.box(wrap);
            const s = getComputedStyle(wrap);
            const x = side ? b.x + b.w - parseFloat(s.paddingRight) : b.x + parseFloat(s.paddingLeft);
            const top = this.#space.box(section.el).y;
            const bottom = top + section.el.offsetHeight;
            const v = this.#space.view();
            const y0 = clamp(v.y + 24 + h.random.uniform(0, 28), top, bottom - 20);
            h.tool = 'cross';
            await h.reachPoint({ x, y: y0 }, 2);
            await h.press();
            const guide = this.#marks.guide(x);
            section.guides.push(guide);
            const stop = this.#clock.each(() => guide.span(y0, h.pos.y));
            await h.reachPoint({ x, y: clamp(y0 + v.h * h.random.uniform(0.2, 0.35), top, bottom) }, 2, 1.05);
            stop();
            guide.span(top, bottom);
            h.release();
            h.tool = 'arrow';
          },
        }),
      ),
    ];
  }

  async #dragFrame(h, box, fill) {
    h.tool = 'cross';
    await h.reachPoint({ x: box.x, y: box.y }, 3);
    const frame = this.#marks.frame().fill(fill);
    const o = { ...h.pos };
    frame.set({ x: o.x, y: o.y, w: 0, h: 0 });
    await h.press();
    const left = this.#marks.extension();
    const up = this.#marks.extension();
    const v = this.#space.view();
    left.set(v.x, o.y, o.x, o.y);
    up.set(o.x, Math.max(v.y, o.y - 160), o.x, o.y);
    const stop = this.#clock.each(() => frame.set({ x: o.x, y: o.y, w: h.pos.x - o.x, h: h.pos.y - o.y }));
    await h.reachPoint({ x: box.x + box.w, y: box.y + box.h }, 3, 1.1);
    stop();
    left.remove();
    up.remove();
    frame.set(box);
    h.release();
    return frame;
  }

  #block(el) {
    el.classList.add('is-unbuilt');
    return {
      where: () => centre(this.#space.box(el)),
      run: async (h) => {
        const box = this.#space.box(el);
        if (box.w < 32 || box.h < 22) {
          await h.reach(box);
          await h.click();
          this.#reveal(el);
          return;
        }
        const frame = await this.#dragFrame(h, box, true);
        this.#reveal(el);
        frame.fill(false);
        this.#aligned(this.#sectionOf(el), box);
        await h.rest(0.14);
        frame.remove();
        h.tool = 'arrow';
      },
    };
  }

  #reveal(el) {
    el.classList.remove('is-unbuilt');
    el.classList.add('is-arriving');
    el.addEventListener('animationend', () => el.classList.remove('is-arriving'), { once: true });
  }

  #sectionOf(el) {
    return this.#sections.find((s) => s.el.contains(el));
  }

  #aligned(section, box) {
    if (!section) return;
    let shown = 0;
    for (const b of section.built) {
      if (shown >= 2) break;
      if (Math.abs(b.x - box.x) < 1.5) {
        this.#marks.align(box.x, Math.min(b.y, box.y), box.x, Math.max(b.y + b.h, box.y + box.h));
        shown++;
      } else if (Math.abs(b.y - box.y) < 1.5) {
        this.#marks.align(Math.min(b.x, box.x), box.y, Math.max(b.x + b.w, box.x + box.w), box.y);
        shown++;
      }
    }
    section.built.push(box);
  }

  #writing(el) {
    const full = el.textContent ?? '';
    const typed = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'type-caret';
    const rest = document.createElement('span');
    rest.className = 'type-rest';
    rest.textContent = full;
    el.replaceChildren(typed, caret, rest);
    return { el, full, typed, caret, rest };
  }

  #write(w, shown, held = true) {
    w.typed.data = shown;
    w.rest.textContent = held ? w.full.slice(shown.length) : '';
  }

  #done(w) {
    w.el.textContent = w.full;
  }

  async #typeInto(h, w, text, held = true) {
    w.caret.style.background = h.colour;
    w.el.classList.add('is-typing');
    await h.type(text, (shown) => this.#write(w, shown, held), clamp(text.length / 55, 1, 2.5));
    w.el.classList.remove('is-typing');
  }

  #text(el, inBlock) {
    const w = this.#writing(el);
    const headline = el.dataset.build === 'headline';
    return {
      where: () => centre(this.#space.box(el)),
      run: async (h) => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (headline) {
          el.style.minHeight = `${this.#space.box(el).h}px`;
          el.style.fontSize = `${size * 0.48}px`;
        }
        const box = this.#space.text(el);
        let frame;
        if (box.w >= 140 && !inBlock) frame = await this.#dragFrame(h, box, false);
        else {
          await h.reach(box);
          await h.click();
          frame = this.#marks.frame().set(box).bare(true);
        }
        h.tool = 'text';
        await h.reachPoint({ x: box.x + 4, y: box.y + Math.min(box.h, size * 1.2) / 2 }, 3, 0.7);
        const keep = headline ? this.#clock.each(() => frame.set(this.#space.text(el))) : null;
        await this.#typeInto(h, w, w.full);
        if (headline) await this.#enlarge(h, el, size);
        keep?.();
        this.#done(w);
        el.style.minHeight = '';
        this.#aligned(this.#sectionOf(el), this.#space.text(el));
        await h.rest(0.1);
        frame.remove();
        h.tool = 'arrow';
      },
    };
  }

  async #enlarge(h, el, size) {
    const small = parseFloat(el.style.fontSize);
    const start = this.#space.text(el);
    el.style.fontSize = '';
    const end = this.#space.text(el);
    el.style.fontSize = `${small}px`;
    const from = { x: start.x + start.w, y: start.y + start.h };
    const to = { x: end.x + end.w, y: end.y + end.h };
    const spanPx = (to.x - from.x) ** 2 + (to.y - from.y) ** 2 || 1;
    h.tool = 'resize';
    await h.reachPoint(from, 3);
    await h.press();
    const stop = this.#clock.each(() => {
      const k = clamp(((h.pos.x - from.x) * (to.x - from.x) + (h.pos.y - from.y) * (to.y - from.y)) / spanPx, 0, 1);
      el.style.fontSize = `${small + (size - small) * k}px`;
    });
    await h.reachPoint(to, 3, 1.2);
    stop();
    el.style.fontSize = '';
    h.release();
  }

  #row(slots) {
    const row = { n: slots.length, typed: 0, wrong: (slots[0].textContent ?? '').trim(), all: Promise.resolve(), arrive: () => {} };
    row.all = new Promise((done) => (row.arrive = () => void (++row.typed === row.n && done())));
    for (const s of slots) s.style.minWidth = `${s.getBoundingClientRect().width}px`;
    return row;
  }

  #slot(el, i, row) {
    const w = this.#writing(el);
    return {
      where: () => centre(this.#space.box(el)),
      run: async (h) => {
        const box = this.#space.box(el);
        await h.reach(box);
        await h.click();
        const frame = this.#marks.frame().set(box);
        h.tool = 'text';
        const wrong = i === 1;
        await this.#typeInto(h, w, wrong ? row.wrong : w.full, !wrong);
        if (wrong) {
          frame.conflict(true).label('冲突 · 重复断言');
          this.stats.conflicts++;
          this.onchange();
        }
        row.arrive();
        await row.all;
        await h.rest(wrong ? 0.55 : h.random.uniform(0.15, 0.45));
        if (wrong) {
          el.classList.add('is-selected');
          await h.rest(0.24);
          el.classList.remove('is-selected');
          this.#write(w, '');
          frame.conflict(false).label(null);
          await this.#typeInto(h, w, w.full);
          this.stats.settled++;
          this.onchange();
        }
        this.#done(w);
        await h.rest(0.08);
        frame.remove();
        h.tool = 'arrow';
      },
    };
  }

  #draw(g) {
    const paths = [...g.querySelectorAll('path')].map((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = '1 1';
      p.style.strokeDashoffset = '1';
      return { p, len };
    });
    const d0 = paths.map((_, idx) => idx * 0.14);
    const dur = 0.38;
    const end = Math.max(0.2, d0[d0.length - 1] + dur);
    const show = (tau) => {
      paths.forEach((s, idx) => {
        const k = clamp((tau - d0[idx]) / dur, 0, 1);
        s.p.style.strokeDashoffset = String(1 - k);
      });
    };
    return {
      where: () => centre(this.#space.box(g)),
      run: async (h) => {
        const DT = 1 / 48;
        const points = [];
        for (let tau = 0; tau <= end; tau += DT) {
          let activeIdx = 0;
          for (let i = 0; i < paths.length; i++) if (tau >= d0[i]) activeIdx = i;
          const s = paths[activeIdx];
          const u = clamp((tau - d0[activeIdx]) / dur, 0, 1);
          const m = s.p.getScreenCTM();
          if (!m) continue;
          const pt = s.p.getPointAtLength(s.len * u).matrixTransform(m);
          points.push(this.#space.point(pt.x, pt.y));
        }
        let tau = 0;
        const stop = this.#clock.each(() => show(tau));
        h.tool = 'pen';
        if (points.length >= 2) {
          await h.reachPoint(points[0], 2, 0.75);
          h.pointer.tagged = true;
          const begun = h.clock.now;
          const step = this.#clock.each((now) => (tau = Math.min(now - begun, end)));
          await h.follow(points, DT);
          step();
        }
        tau = end;
        show(end);
        stop();
        paths.forEach((s) => {
          s.p.style.strokeDasharray = '';
          s.p.style.strokeDashoffset = '';
        });
        h.release();
        h.tool = 'arrow';
      },
    };
  }

  async #work(h) {
    while (!this.#over) {
      const task = this.#take(h);
      if (!task) {
        await h.rest(0.16);
        continue;
      }
      task.state = 'taken';
      this.stats.busy++;
      this.onchange();
      await task.run(h);
      task.state = 'done';
      this.stats.busy--;
      this.stats.done++;
      this.onchange();
      this.#closed(task.section);
    }
  }

  #take(h) {
    let best = null;
    let score = Infinity;
    for (const s of this.#sections) {
      if (!s.active) continue;
      for (const t of s.tasks) {
        if (t.state !== 'waiting' || t.deps.some((d) => d.state !== 'done')) continue;
        const p = t.where();
        const sc = s.index * 1e5 + Math.hypot(p.x - h.pos.x, p.y - h.pos.y);
        if (sc < score) {
          score = sc;
          best = t;
        }
      }
      if (best) break;
    }
    return best;
  }

  #closed(section) {
    if (section.tasks.some((t) => t.state !== 'done')) return;
    for (const g of section.guides) g.remove();
    section.guides = [];
    if (this.#sections.every((s) => s.tasks.every((t) => t.state === 'done'))) {
      this.#over = true;
      this.#finish();
    }
  }
}
