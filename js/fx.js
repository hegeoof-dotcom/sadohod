/*
  Эффекты. Язык анимаций взят из Поток Медиа и DMT:
  - полутоновое слово из точек, которое расступается под курсором и светится (подвал Поток Медиа);
  - плавные «потоки» линий, расходящиеся вокруг курсора (hero Поток Медиа);
  - появление блоков волной на одной кривой cubic-bezier(.16,1,.3,1) (DMT);
  - счётчики, магнитные кнопки, бегущая строка (DMT).
*/
window.FX = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const pointer = { x: -1e5, y: -1e5 };

  /* ---------- появление при прокрутке ---------- */
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  function reveal(root = document) {
    const els = [...root.querySelectorAll('.reveal:not(.in)')];
    els.forEach((el, i) => { el.style.setProperty('--d', `${Math.min(i, 8) * 0.06}s`); io.observe(el); });
  }

  /* ---------- счётчики ---------- */
  function counter(el, to, dur = 1100) {
    if (reduced) { el.textContent = to; return; }
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    (function tick(now) {
      const t = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- магнитные кнопки ---------- */
  function magnetic(root = document) {
    if (reduced || !matchMedia('(pointer: fine)').matches) return;
    root.querySelectorAll('.magnetic:not([data-mag])').forEach((b) => {
      b.dataset.mag = 1;
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${dx * 0.22}px, ${dy * 0.3}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- полутоновое слово в hero ---------- */
  function halftone(canvas, word) {
    const ctx = canvas.getContext('2d');
    const host = canvas.parentElement;
    let w = 0, h = 0, dpr = 1, gap = 7, dots = new Float32Array(0), n = 0, raf = 0, visible = true;
    let ink = '#000', acc = '#0a0', lx = -1e5, ly = -1e5, ring = { x: 0, y: 0, t: -1 };

    function colors() { ink = css('--ink'); acc = css('--accent'); wake(); }

    function layout() {
      const r = host.getBoundingClientRect();
      w = r.width; h = r.height;
      if (!w) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gap = w < 600 ? 5 : w < 1100 ? 6 : 7;
      const m = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      m.canvas.width = w; m.canvas.height = h;
      m.font = '700 100px Unbounded, sans-serif';
      const size = Math.min((w * 0.96) / m.measureText(word).width * 100, h * 0.62);
      m.font = `700 ${size}px Unbounded, sans-serif`;
      m.textBaseline = 'alphabetic';
      const tw = m.measureText(word).width;
      m.fillText(word, (w - tw) / 2, h - size * 0.04);
      const img = m.getImageData(0, 0, w, h).data;
      const arr = [];
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          let s = 0;
          for (let k = 0; k < 4; k++) {
            const sx = Math.min(w - 1, Math.floor(x + (k % 2 ? 1 : -1) * gap * 0.25));
            const sy = Math.min(h - 1, Math.floor(y + (k < 2 ? -1 : 1) * gap * 0.25));
            s += img[(sy * w + sx) * 4 + 3];
          }
          const cov = s / (4 * 255);
          if (cov > 0.08) arr.push(x, y, x, y, 0, 0, Math.sqrt(cov) * gap * 0.46);
        }
      }
      dots = new Float32Array(arr); n = arr.length / 7;
      wake();
    }

    function draw(now) {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const r = canvas.getBoundingClientRect();
      const px = pointer.x - r.left, py = pointer.y - r.top;
      if (pointer.x > -1e4) { lx += (px - lx) * 0.14; ly += (py - ly) * 0.14; }
      const R = 110, R2 = R * R;
      const rt = ring.t < 0 ? -1 : (now - ring.t) / 900;
      let moving = false;
      const dim = [], buckets = [[], [], [], [], [], [], [], []];
      const sweep = (((now / 4200) % 1) * 1.8 - 0.4) * w; // полоса света раз в ~4 с
      const waveAmp = reduced ? 0 : 1.6;
      for (let i = 0; i < n; i++) {
        const o = i * 7;
        let x = dots[o], y = dots[o + 1];
        const hx = dots[o + 2], hy = dots[o + 3];
        let vx = dots[o + 4], vy = dots[o + 5];
        const dx = x - lx, dy = y - ly, d2 = dx * dx + dy * dy;
        if (!reduced && d2 < R2) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 1.6;
          vx += (dx / d) * f; vy += (dy / d) * f;
        }
        if (rt >= 0 && rt < 1 && !reduced) {
          const rx = hx - ring.x, ry = hy - ring.y, rd = Math.sqrt(rx * rx + ry * ry) || 1;
          const front = rt * Math.max(w, h) * 0.9;
          if (Math.abs(rd - front) < 26) { vx += (rx / rd) * 2.2 * (1 - rt); vy += (ry / rd) * 2.2 * (1 - rt); }
        }
        vx += (hx - x) * 0.06; vy += (hy - y) * 0.06;
        vx *= 0.82; vy *= 0.82;
        x += vx; y += vy;
        dots[o] = x; dots[o + 1] = y; dots[o + 4] = vx; dots[o + 5] = vy;
        if (Math.abs(vx) + Math.abs(vy) > 0.02) moving = true;
        const near = d2 < (R * 1.8) ** 2 ? 1 - Math.sqrt(d2) / (R * 1.8) : 0;
        // постоянная жизнь: по слову бежит полоса света и лёгкая волна — работает и без мыши (телефон, Telegram)
        const band = x - sweep + (y - h) * 0.35;
        const shine = Math.exp(-(band * band) / (2 * 70 * 70)) * 0.75;
        const wy = y + Math.sin(hx * 0.018 + now * 0.0022) * waveAmp;
        const glow = Math.max(near, shine);
        const rr = dots[o + 6] * (1 + glow * 0.35);
        if (glow > 0.03) { const b = Math.min(7, (glow * 8) | 0); buckets[b].push(x, wy, rr); } else dim.push(x, wy, rr);
      }
      ctx.fillStyle = ink; ctx.globalAlpha = 0.1;
      ctx.beginPath();
      for (let i = 0; i < dim.length; i += 3) { ctx.moveTo(dim[i] + dim[i + 2], dim[i + 1]); ctx.arc(dim[i], dim[i + 1], dim[i + 2], 0, 6.283); }
      ctx.fill();
      ctx.fillStyle = acc;
      buckets.forEach((bk, b) => {
        if (!bk.length) return;
        ctx.globalAlpha = 0.12 + ((b + 0.5) / 8) * 0.85;
        ctx.beginPath();
        for (let i = 0; i < bk.length; i += 3) { ctx.moveTo(bk[i] + bk[i + 2], bk[i + 1]); ctx.arc(bk[i], bk[i + 1], bk[i + 2], 0, 6.283); }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (visible) raf = requestAnimationFrame(draw);
    }
    function wake() { if (!raf && visible) raf = requestAnimationFrame(draw); }

    host.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      ring = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
      wake();
    });
    addEventListener('pointermove', wake, { passive: true });
    // палец на телефоне: точки расступаются там, где касаешься, и гаснут после отпускания
    const touch = (e) => { const t = e.touches[0]; if (t) { pointer.x = t.clientX; pointer.y = t.clientY; } };
    host.addEventListener('touchstart', touch, { passive: true });
    host.addEventListener('touchmove', touch, { passive: true });
    host.addEventListener('touchend', () => setTimeout(() => { pointer.x = pointer.y = -1e5; lx = ly = -1e5; }, 450), { passive: true });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(host);
    new ResizeObserver(layout).observe(host);
    document.fonts && document.fonts.ready.then(layout);
    return { colors, layout };
  }

  /* ---------- потоки линий (страница продавцов) ---------- */
  function flow(canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, t = 0, raf = 0, visible = false, color = '#0a0';
    const LINES = 22;
    let mx = -1e5, my = -1e5;
    function size() {
      const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    function frame() {
      raf = 0;
      if (!visible) return;
      t += reduced ? 0 : 0.004;
      const r = canvas.getBoundingClientRect();
      mx += ((pointer.x - r.left) - mx) * 0.08; my += ((pointer.y - r.top) - my) * 0.08;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      for (let i = 0; i < LINES; i++) {
        const k = i / (LINES - 1);
        ctx.globalAlpha = 0.08 + Math.sin(k * Math.PI) * 0.22;
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 12) {
          const u = x / w;
          let y = h * (0.22 + k * 0.62) + Math.sin(u * 5 + t * 6 + k * 2.4) * 22 * (0.4 + k) + Math.sin(u * 2 - t * 3) * 30;
          const dx = x - mx, dy = y - my, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 160) y += (dy / (d || 1)) * (160 - d) * 0.35;
          x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    function colors() { color = css('--accent'); if (visible && !raf) raf = requestAnimationFrame(frame); }
    new ResizeObserver(() => { size(); colors(); }).observe(canvas);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(canvas);
    return { colors };
  }

  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e5; });

  /* ---------- смена темы с кругом из кнопки ---------- */
  function themeToggle(btn, onChange) {
    btn.addEventListener('click', (e) => {
      const root = document.documentElement;
      const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem('sg-theme', next); } catch (err) {}
        document.querySelector('meta[name="theme-color"]').content = next === 'dark' ? '#0c0e0c' : '#f5f4ef';
        onChange && onChange();
      };
      if (!document.startViewTransition || reduced) return apply();
      const x = e.clientX || innerWidth - 40, y = e.clientY || 30;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(apply).ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
        );
      }).catch(() => {});
    });
  }

  return { reveal, counter, magnetic, halftone, flow, themeToggle, reduced };
})();
