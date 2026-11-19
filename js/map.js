/*
  Карта: SVG по схеме рынка (координаты картинки ref/plan-sadovod.webp), перемещение/масштаб,
  поиск пути по проходам (граф из ROADS + AISLES, Дейкстра) и маршрут по списку («ближайший следующий»).
*/
window.MapView = (() => {
  const { BUILDINGS, ROWS, ROADS, AISLES, ENTRANCES, POI, POI_META, STORES, CATS } = window.SG;
  const NS = 'http://www.w3.org/2000/svg';
  const M_PER_UNIT = 0.55;   // 1 пиксель схемы ≈ 0,55 м (вещевые ряды ≈ 480 м в ширину)
  const M_PER_MIN = 60;      // шаг в толпе
  const LAND = { x: 190, y: 230, w: 1510, h: 1060 };
  const FULL = { x: 120, y: 150, w: 1820, h: 1250 };

  let svg, stage, gRoute, onPin = () => {}, onBuilding = () => {};
  let vb = { ...FULL };
  let entrance = 'e3';
  const hiddenCats = new Set();
  const hiddenPoi = new Set(['taxi', 'kids']);
  let selected = null;
  let inRoute = new Set();

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ---------- граф проходов ---------- */
  const nodes = new Map(); // key -> {x,y,edges:[[key,w]]}
  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  function node(x, y) { const k = key(x, y); if (!nodes.has(k)) nodes.set(k, { x: Math.round(x), y: Math.round(y), edges: [] }); return k; }
  function link(a, b) {
    if (a === b) return;
    const A = nodes.get(a), B = nodes.get(b);
    const d = Math.hypot(A.x - B.x, A.y - B.y);
    A.edges.push([b, d]); B.edges.push([a, d]);
  }
  function project(p, s) {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / L));
    const x = s.a[0] + dx * t, y = s.a[1] + dy * t;
    return { t, x, y, d: Math.hypot(p[0] - x, p[1] - y) };
  }
  function attachNearest(p, segs) {
    let best = null, bs = null;
    segs.forEach((s) => { const q = project(p, s); if (!best || q.d < best.d) { best = q; bs = s; } });
    bs.ts.push(best.t);
    return [best.x, best.y];
  }
  function buildGraph() {
    const lines = [...ROADS, ...AISLES];
    const segs = [];
    lines.forEach((pl) => { for (let i = 1; i < pl.length; i++) segs.push({ a: pl[i - 1], b: pl[i], ts: [0, 1] }); });
    // пересечения
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s = segs[i], u = segs[j];
        const r = [s.b[0] - s.a[0], s.b[1] - s.a[1]], q = [u.b[0] - u.a[0], u.b[1] - u.a[1]];
        const den = r[0] * q[1] - r[1] * q[0];
        if (Math.abs(den) < 1e-9) continue;
        const w = [u.a[0] - s.a[0], u.a[1] - s.a[1]];
        const t = (w[0] * q[1] - w[1] * q[0]) / den, v = (w[0] * r[1] - w[1] * r[0]) / den;
        if (t > -1e-6 && t < 1 + 1e-6 && v > -1e-6 && v < 1 + 1e-6) { s.ts.push(t); u.ts.push(v); }
      }
    }
    // концы линий, которые почти касаются другой линии, — пристёгиваем
    const extra = [];
    lines.forEach((pl) => [pl[0], pl[pl.length - 1]].forEach((p) => {
      segs.forEach((s) => {
        const q = project(p, s);
        if (q.d > 0.5 && q.d < 16) { s.ts.push(q.t); extra.push([p, [q.x, q.y]]); }
      });
    }));
    // точки, которые нужно подцепить к ближайшему проходу
    const att = [];
    STORES.forEach((s) => att.push([[s.x, s.y], attachNearest([s.x, s.y], segs)]));
    ENTRANCES.forEach((e) => att.push([[e.x, e.y], attachNearest([e.x, e.y], segs)]));
    segs.forEach((s) => {
      const ts = [...new Set(s.ts.map((t) => Math.round(t * 1e4) / 1e4))].sort((a, b) => a - b);
      let prev = null;
      ts.forEach((t) => {
        const k = node(s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t);
        if (prev) link(prev, k);
        prev = k;
      });
    });
    [...extra, ...att].forEach(([a, b]) => link(node(a[0], a[1]), node(b[0], b[1])));
    STORES.forEach((s) => { s.node = key(s.x, s.y); });
    ENTRANCES.forEach((e) => { e.node = key(e.x, e.y); });
  }

  function dijkstra(src) {
    const dist = new Map([[src, 0]]), prev = new Map(), done = new Set();
    const heap = [[0, src]];
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (done.has(u)) continue;
      done.add(u);
      for (const [v, w] of nodes.get(u).edges) {
        const nd = d + w;
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); push([nd, v]); }
      }
    }
    return { dist, prev };
  }
  function pathTo(prev, src, dst) {
    const out = [dst];
    let c = dst;
    while (c !== src) { c = prev.get(c); if (!c) return []; out.push(c); }
    return out.reverse().map((k) => nodes.get(k));
  }

  /* ---------- отрисовка ---------- */
  const ptsAttr = (pts) => pts.map((p) => p.join(',')).join(' ');
  function render() {
    svg.innerHTML = '';
    const base = el('g', {}, svg);
    el('path', { class: 'm-street', d: 'M110 200 L1690 200 C1760 200 1800 190 1840 160' }, base);
    el('text', { class: 'm-streetl', x: 840, y: 207, 'text-anchor': 'middle' }, base).textContent = 'ул. Верхние Поля';
    el('path', { class: 'm-mkad', d: 'M1900 150 C1820 420 1700 820 1580 1100 L1460 1420' }, base);
    el('text', { class: 'm-streetl', x: 1745, y: 900, 'text-anchor': 'middle', transform: 'rotate(-66 1745 900)' }, base).textContent = 'МКАД · 14 км';
    el('polygon', { class: 'm-land', points: '195,232 1665,232 1690,290 1690,820 1640,880 1560,1000 1500,1190 1280,1236 860,1236 800,1290 700,1380 560,1320 480,1200 380,1090 195,1090' }, base);
    ROADS.forEach((pl) => el('polyline', { class: 'm-road', points: ptsAttr(pl) }, base));

    // корпуса
    const bg = el('g', {}, svg);
    BUILDINGS.forEach((b) => {
      const g = el('g', { class: 'm-bld', 'data-b': b.id, style: `--c:${b.color}`, tabindex: 0, role: 'button', 'aria-label': b.name }, bg);
      el('polygon', { points: ptsAttr(b.pts) }, g);
      (b.legs || []).forEach(([x, y, w, h]) => el('rect', { x, y, width: w, height: h }, g));
      g.addEventListener('click', (e) => { e.stopPropagation(); if (!stage.classList.contains('dragged')) onBuilding(b.id); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') onBuilding(b.id); });
    });

    // вещевые ряды
    const rg = el('g', {}, svg);
    ROWS.forEach((r) => {
      const g = el('g', { class: 'm-rowg', 'data-cat': r.cat, style: `--h:${CATS[r.cat].hue}` }, rg);
      el('line', { class: 'm-rowline', x1: r.x, y1: r.top + 6, x2: r.x, y2: r.bottom - 6 }, g);
      el('text', { class: 'm-rown', x: r.x, y: 776, 'text-anchor': 'middle' }, g).textContent = r.n;
      el('text', { class: 'm-rowl', x: r.x + 4, y: 690, transform: `rotate(-90 ${r.x + 4} 690)` }, g).textContent = r.label;
    });
    [['СТ-5', 812, 597], ['СТ-3 / СТ-4', 1030, 801], ['СТ-6 / СТ-7', 1010, 424], ['СТ-6 / СТ-7', 650, 508], ['СТ-8', 1320, 506], ['СТ-9', 1320, 366]]
      .forEach(([t, x, y]) => { el('text', { class: 'm-pass', x, y, 'text-anchor': 'middle' }, rg).textContent = t; });

    // подписи корпусов
    const lg = el('g', {}, svg);
    BUILDINGS.forEach((b) => {
      const attrs = { class: 'm-bl', x: b.lx, y: b.ly, 'text-anchor': b.anchor || 'middle', style: `--c:${b.color};font-size:${b.size}px` };
      if (b.vertical) attrs.transform = `rotate(-90 ${b.lx} ${b.ly})`;
      el('text', attrs, lg).textContent = b.short;
    });

    gRoute = el('g', {}, svg);

    // удобства
    const pg = el('g', {}, svg);
    POI.forEach((p) => {
      const g = el('g', { class: 'm-poi m-poi-' + p.type, 'data-type': p.type }, pg);
      el('title', {}, g).textContent = p.name || POI_META[p.type].name;
      el('circle', { cx: p.x, cy: p.y, r: p.type === 'park' ? 16 : 11 }, g);
      el('text', { x: p.x, y: p.y + 0.5 }, g).textContent = p.type === 'park' ? (p.name || 'P').replace('Парковка ', '') : POI_META[p.type].label;
    });

    // входы
    const eg = el('g', {}, svg);
    ENTRANCES.forEach((e) => {
      const g = el('g', { class: 'm-ent' + (e.stop ? ' stop' : ''), 'data-ent': e.id }, eg);
      el('title', {}, g).textContent = e.name;
      el('rect', { x: e.x - 17, y: e.y - 17, width: 34, height: 34, rx: e.stop ? 17 : 9 }, g);
      el('text', { x: e.x, y: e.y + 1 }, g).textContent = e.short;
    });

    // магазины
    const sg = el('g', {}, svg);
    STORES.forEach((s) => {
      const top = s.promo && s.promo.tier === 'top';
      const g = el('g', { class: 'm-pin' + (top ? ' top' : ''), 'data-id': s.id, tabindex: 0, role: 'button', 'aria-label': `${s.name}, ${s.code}`, style: `--h:${CATS[s.cat].hue}` }, sg);
      if (top) el('circle', { class: 'halo', cx: s.x, cy: s.y, r: 9 }, g);
      el('circle', { class: 'c', cx: s.x, cy: s.y, r: 7 }, g);
      el('text', { x: s.x + 13, y: s.y + 4 }, g).textContent = s.name;
      g.addEventListener('click', (ev) => { ev.stopPropagation(); if (!stage.classList.contains('dragged')) onPin(s.id); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') onPin(s.id); });
    });
    applyState();
  }

  function applyState() {
    if (!svg) return;
    svg.querySelectorAll('.m-rowg').forEach((g) => g.classList.toggle('dim', hiddenCats.has(g.dataset.cat)));
    svg.querySelectorAll('.m-bld').forEach((g) => {
      const b = BUILDINGS.find((x) => x.id === g.dataset.b);
      g.classList.toggle('dim', !!(b.cat && hiddenCats.has(b.cat)));
    });
    svg.querySelectorAll('.m-pin').forEach((g) => {
      const s = STORES.find((x) => x.id === g.dataset.id);
      g.classList.toggle('dim', hiddenCats.has(s.cat));
      g.classList.toggle('sel', selected === s.id);
      g.classList.toggle('inroute', inRoute.has(s.id));
    });
    svg.querySelectorAll('.m-poi').forEach((g) => g.classList.toggle('hide', hiddenPoi.has(g.dataset.type)));
    svg.querySelectorAll('.m-ent').forEach((g) => g.classList.toggle('cur', g.dataset.ent === entrance));
  }

  /* ---------- перемещение и масштаб ---------- */
  function setVB() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const r = svg.getBoundingClientRect();
    const scale = r.width ? Math.min(r.width / vb.w, r.height / vb.h) : 0;
    svg.classList.toggle('zoomed', scale > 1.1);
    svg.classList.toggle('mid', scale > 0.7);
  }
  function toSvg(cx, cy) {
    const r = svg.getBoundingClientRect();
    const s = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width * s - vb.w) / 2, oy = (r.height * s - vb.h) / 2;
    return { x: vb.x - ox + (cx - r.left) * s, y: vb.y - oy + (cy - r.top) * s, s };
  }
  const clampW = (w) => Math.min(FULL.w * 1.3, Math.max(220, w));
  function zoomAt(cx, cy, k) {
    const p = toSvg(cx, cy);
    const nw = clampW(vb.w * k), f = nw / vb.w;
    vb = { x: p.x - (p.x - vb.x) * f, y: p.y - (p.y - vb.y) * f, w: nw, h: vb.h * f };
    setVB();
  }
  let anim = 0;
  function animateTo(target, dur = 700) {
    cancelAnimationFrame(anim);
    if (window.FX.reduced) { vb = { ...target }; return setVB(); }
    const from = { ...vb }, t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur), e = ease(t);
      vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      setVB();
      if (t < 1) anim = requestAnimationFrame(step);
    })(t0);
  }
  function fitBox(minX, minY, maxX, maxY, pad = 80, instant = false) {
    const w = Math.max(360, maxX - minX + pad * 2), h = Math.max(280, maxY - minY + pad * 2);
    const r = stage.getBoundingClientRect();
    const ar = r.width && r.height ? r.width / r.height : w / h;
    let W = w, Hh = h;
    if (W / Hh < ar) W = Hh * ar; else Hh = W / ar;
    const t = { x: (minX + maxX) / 2 - W / 2, y: (minY + maxY) / 2 - Hh / 2, w: W, h: Hh };
    if (instant) { vb = t; setVB(); } else animateTo(t);
  }

  function bindPan() {
    const ptrs = new Map();
    let last = null, pinch = 0, moved = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.map-search, .map-tools')) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = { x: e.clientX, y: e.clientY }; moved = 0;
      stage.classList.remove('dragged');
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
        pinch = d; moved += 10; stage.classList.add('dragged'); return;
      }
      const s = toSvg(0, 0).s;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) { stage.classList.add('drag', 'dragged'); if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId); }
      vb.x -= dx * s; vb.y -= dy * s; last = { x: e.clientX, y: e.clientY };
      cancelAnimationFrame(anim); setVB();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); pinch = 0; stage.classList.remove('drag');
      if (ptrs.size === 1) last = { ...[...ptrs.values()][0] };
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); cancelAnimationFrame(anim); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
  }

  /* ---------- маршрут ---------- */
  function plan(ids) {
    const start = ENTRANCES.find((e) => e.id === entrance).node;
    const left = ids.map((id) => STORES.find((s) => s.id === id)).filter(Boolean);
    const legs = [];
    let cur = start, total = 0;
    while (left.length) {
      const { dist, prev } = dijkstra(cur);
      let bi = 0;
      left.forEach((s, i) => { if ((dist.get(s.node) ?? Infinity) < (dist.get(left[bi].node) ?? Infinity)) bi = i; });
      const s = left.splice(bi, 1)[0];
      const d = dist.get(s.node) || 0;
      legs.push({ store: s, pts: pathTo(prev, cur, s.node), d, m: Math.round(d * M_PER_UNIT) });
      total += d; cur = s.node;
    }
    return { legs, meters: Math.round(total * M_PER_UNIT), minutes: Math.max(1, Math.round((total * M_PER_UNIT) / M_PER_MIN)) };
  }

  let walkerRaf = 0;
  function drawRoute(p) {
    cancelAnimationFrame(walkerRaf);
    gRoute.innerHTML = '';
    if (!p || !p.legs.length) return;
    const pts = p.legs.flatMap((l, i) => (i ? l.pts.slice(1) : l.pts));
    const dAttr = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join(' ');
    el('path', { class: 'm-route-ghost', d: dAttr }, gRoute);
    const path = el('path', { class: 'm-route', d: dAttr }, gRoute);
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.getBoundingClientRect();
    path.style.transition = window.FX.reduced ? 'none' : `stroke-dashoffset ${Math.min(2.6, 0.9 + len / 1800)}s cubic-bezier(.16,1,.3,1)`;
    path.style.strokeDashoffset = 0;
    p.legs.forEach((l, i) => {
      const g = el('g', { class: 'm-step' }, gRoute);
      el('circle', { cx: l.store.x, cy: l.store.y - 26, r: 13 }, g);
      el('text', { x: l.store.x, y: l.store.y - 25 }, g).textContent = i + 1;
    });
    if (!window.FX.reduced) {
      const walker = el('circle', { class: 'm-walker', r: 8 }, gRoute);
      const t0 = performance.now() + 900, dur = Math.max(5000, len * 5);
      (function go(now) {
        if (!walker.isConnected) return;
        const t = ((now - t0) % dur + dur) % dur / dur;
        const q = path.getPointAtLength(t * len);
        walker.setAttribute('cx', q.x); walker.setAttribute('cy', q.y);
        walkerRaf = requestAnimationFrame(go);
      })(performance.now());
    }
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    fitBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 70);
  }

  return {
    init(svgEl, stageEl, opts = {}) {
      svg = svgEl; stage = stageEl; onPin = opts.onPin || onPin; onBuilding = opts.onBuilding || onBuilding;
      if (!nodes.size) buildGraph();
      render(); setVB(); bindPan();
    },
    zoom(dir) {
      if (dir === 'reset') return this.fit();
      const r = stage.getBoundingClientRect();
      cancelAnimationFrame(anim);
      const p = toSvg(r.left + r.width / 2, r.top + r.height / 2);
      const nw = clampW(vb.w * (dir === 'in' ? 0.65 : 1.5)), f = nw / vb.w;
      animateTo({ x: p.x - (p.x - vb.x) * f, y: p.y - (p.y - vb.y) * f, w: nw, h: vb.h * f }, 450);
    },
    fit(instant) { fitBox(LAND.x, LAND.y, LAND.x + LAND.w, LAND.y + LAND.h, 20, instant); },
    select(id) { selected = id; applyState(); },
    flyTo(id) {
      const s = STORES.find((x) => x.id === id); if (!s) return;
      selected = id; applyState();
      fitBox(s.x - 90, s.y - 90, s.x + 90, s.y + 90, 30);
    },
    toggleCat(cat) { hiddenCats.has(cat) ? hiddenCats.delete(cat) : hiddenCats.add(cat); applyState(); return !hiddenCats.has(cat); },
    togglePoi(t) { hiddenPoi.has(t) ? hiddenPoi.delete(t) : hiddenPoi.add(t); applyState(); return !hiddenPoi.has(t); },
    isPoiOn(t) { return !hiddenPoi.has(t); },
    setEntrance(id) { entrance = id; applyState(); },
    get entrance() { return entrance; },
    route(ids) {
      inRoute = new Set(ids);
      const p = ids.length ? plan(ids) : null;
      applyState(); drawRoute(p);
      return p;
    },
    clearRoute() { inRoute = new Set(); cancelAnimationFrame(walkerRaf); if (gRoute) gRoute.innerHTML = ''; applyState(); },
    distFromEntrance() {
      if (!nodes.size) buildGraph();
      const { dist } = dijkstra(ENTRANCES.find((e) => e.id === entrance).node);
      return Object.fromEntries(STORES.map((s) => [s.id, Math.round((dist.get(s.node) ?? 1e9) * M_PER_UNIT)]));
    },
  };
})();
