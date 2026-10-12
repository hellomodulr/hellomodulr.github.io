// Point type: the accent idiom of the KI page. A word or a number is set in Geist, sampled on a
// square grid and drawn as rust points, the same way the rolling word of the title is built.
// The real text stays in the DOM (transparent, selectable, read by screen readers and search
// engines); a canvas inside the element draws the points over it. Crisp on every screen: the grid
// step is a whole number of device pixels, and so is every offset. Light and dark follow the colour
// scheme live (the rust comes from --acc).
// The points obey the pointer rule of the page (js/punkte.js, `evade`): they yield to the pointer
// with the same spring as every point of the field and, being rust, show half of the offset, the
// same factor as the rust points of the figures. The canvas reaches beyond the word by PAD, so a
// yielding point is never cut. Reduced motion: the points stand still.
// Markup: <span class="pt">Gespräch</span>. Optional data-pt-em: grid cells per em (default 21).
(function () {
  'use strict';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // sample a word into grid points, coordinates relative to the top left of the word box
  // (shared with js/roller.js, which hands these points to the point field)
  function sample(text, o) {
    const fs = o.fontSize, ls = o.letterSpacing, step = o.step, lineH = o.lineHeight;
    const SS = 3; // supersampling of the offscreen raster
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    const font = `${o.weight} ${fs * SS}px ${o.family}`;
    x.font = font;
    const hasLS = 'letterSpacing' in x;
    if (hasLS) x.letterSpacing = `${ls * SS}px`;
    const m = x.measureText(text);
    const asc = m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent / SS : fs * .93;
    const desc = m.fontBoundingBoxDescent != null ? m.fontBoundingBoxDescent / SS : fs * .24;
    // same baseline as the DOM line: half leading above the font box
    const base = (lineH - (asc + desc)) / 2 + asc;
    let width = 0;
    if (hasLS) width = m.width / SS;
    else for (const ch of text) width += x.measureText(ch).width / SS + ls;
    c.width = Math.max(1, Math.ceil((width + fs * .2) * SS)); c.height = Math.max(1, Math.ceil(lineH * SS));
    x.font = font; if (hasLS) x.letterSpacing = `${ls * SS}px`;
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    if (hasLS) x.fillText(text, 0, base * SS);
    else { let px = 0; for (const ch of text) { x.fillText(ch, px * SS, base * SS); px += x.measureText(ch).width / SS + ls; } }
    const img = x.getImageData(0, 0, c.width, c.height).data, W = c.width;
    const at = (gx, gy) => { const ix = Math.round(gx * SS), iy = Math.round(gy * SS); if (ix < 0 || iy < 0 || ix >= W || iy >= c.height) return 0; return img[(iy * W + ix) * 4 + 3]; };
    const out = [], r = step * o.dot;
    for (let gy = step / 2; gy < lineH; gy += step) {
      for (let gx = step / 2; gx < width + fs * .1; gx += step) {
        // coverage of the cell from five samples, so thin strokes still get their dots
        const h = step * .28;
        const cov = (at(gx, gy) * 2 + at(gx - h, gy) + at(gx + h, gy) + at(gx, gy - h) + at(gx, gy + h)) / (6 * 255);
        if (cov > .42) out.push({ x: gx, y: gy, z: 0, acc: 1, r });
      }
    }
    out.meta = { width, base };
    return out;
  }

  const items = new Map();
  let fontsOk = false;
  const root = document.documentElement;
  const PF = window.Punkte;
  const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  // room around the word for the points that yield (the largest offset of a rust point is about a
  // quarter of the radius)
  const pad = () => Math.ceil((PF ? PF.evRadius() : 110) * .4);
  // the spring of each point varies a little, drawn from the same range as the points of the field
  const hash = i => { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

  function metrics(el) {
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const em = parseFloat(el.dataset.ptEm) || 21;
    // a whole number of device pixels per grid cell keeps every point the same size and distance
    const step = Math.max(2, Math.round(clamp(fs / em, 2.2, 6) * dpr)) / dpr;
    return {
      text: el.textContent.trim(), fontSize: fs, letterSpacing: parseFloat(cs.letterSpacing) || 0,
      lineHeight: el.offsetHeight || fs * 1.2, step, dot: .74, dpr,
      weight: cs.fontWeight || 700, family: 'Geist, ' + (cs.fontFamily || 'sans-serif'),
      color: cs.getPropertyValue('--acc').trim() || '#c2553a', w: el.offsetWidth, pad: pad(),
    };
  }
  function draw(el) {
    const it = items.get(el); if (!it || !fontsOk || !el.isConnected) return;
    const m = metrics(el), key = JSON.stringify(m);
    if (!(m.fontSize > 0) || !m.text) return;
    if (key === it.key) return;
    it.key = key;
    const pts = sample(m.text, m), d = m.dpr, cv = it.cv, P0 = m.pad;
    const cw = Math.ceil(Math.max(m.w, pts.meta.width) + m.fontSize * .2), ch = Math.ceil(m.lineHeight);
    cv.width = Math.round((cw + 2 * P0) * d); cv.height = Math.round((ch + 2 * P0) * d);
    cv.style.width = (cw + 2 * P0) + 'px'; cv.style.height = (ch + 2 * P0) + 'px';
    cv.style.left = cv.style.top = -P0 + 'px';
    const s = Math.max(1, Math.round(m.step * m.dot * d)), st = Math.round(m.step * d), pd = Math.round(P0 * d);
    // keep the offsets of a word that is drawn anew (a live number, a resize)
    const old = new Map((it.dots || []).map(q => [q.ix + ',' + q.iy, q]));
    it.dots = pts.map(p => {
      // points sit on the device pixel grid: column and row index times a whole step
      const ix = Math.round((p.x - m.step / 2) / m.step), iy = Math.round((p.y - m.step / 2) / m.step);
      const px = pd + ix * st + Math.round((st - s) / 2), py = pd + iy * st + Math.round((st - s) / 2);
      const was = old.get(ix + ',' + iy);
      return { ix, iy, px, py, cx: (px + s / 2) / d, cy: (py + s / 2) / d, k: .022 + hash(ix * 7919 + iy * 104729) * .024, ox: was ? was.ox : 0, oy: was ? was.oy : 0, ovx: was ? was.ovx : 0, ovy: was ? was.ovy : 0 };
    });
    Object.assign(it, { s, d, color: m.color });
    render(it);
    el.classList.add('pt-drawn');
  }
  // the dots, each at its place plus its offset as drawn, rounded to whole device pixels
  function render(it) {
    const x = it.cv.getContext('2d'), d = it.d, s = it.s, kf = PF ? PF.EV.ACC : .5;
    x.clearRect(0, 0, it.cv.width, it.cv.height);
    x.fillStyle = it.color;
    for (const q of it.dots) x.fillRect(q.px + Math.round(q.ox * kf * d), q.py + Math.round(q.oy * kf * d), s, s);
  }

  // ---------- the pointer ----------
  // one loop for all words; it runs only while the pointer is near a word or a point still moves
  let raf = 0, last = 0;
  const hidden = el => !el.offsetHeight || (el.closest('.roll') && root.classList.contains('roll-points'));
  function tick(now) {
    raf = 0;
    const s = last ? Math.min(3, Math.max(0, (now - last) / 1000 * 60)) : 1; last = now;
    const ptr = PF.PTR, RR = PF.evRadius();
    let again = false;
    for (const [el, it] of items) {
      if (!it.dots || !it.dots.length) continue;
      const r = it.cv.getBoundingClientRect();
      const near = ptr.on && ptr.x > r.left - RR && ptr.x < r.right + RR && ptr.y > r.top - RR && ptr.y < r.bottom + RR;
      if (!near && !it.moving) continue;
      if (hidden(el)) continue;
      let mv = false;
      for (const q of it.dots) if (PF.evade(q, r.left + q.cx, r.top + q.cy, s, RR, ptr.x, ptr.y, ptr.on)) mv = true;
      it.moving = mv;
      render(it);
      if (mv || near) again = true;
    }
    if (again) raf = requestAnimationFrame(tick); else last = 0;
  }
  function wake() { if (!raf && PF && !reducedMQ.matches) raf = requestAnimationFrame(tick); }
  ['pointermove', 'pointerdown', 'pointerup'].forEach(t => addEventListener(t, wake, { passive: true }));
  // test scripts: every dot in view with its place and its offset as drawn (client px)
  function debug() {
    const out = [], kf = PF ? PF.EV.ACC : .5;
    for (const [el, it] of items) {
      if (!it.dots || hidden(el)) continue;
      const r = it.cv.getBoundingClientRect();
      for (const q of it.dots) out.push({ bx: r.left + q.cx, by: r.top + q.cy, ox: Math.round(q.ox * kf * it.d) / it.d, oy: Math.round(q.oy * kf * it.d) / it.d, text: el.textContent.trim() });
    }
    return out;
  }
  function add(el) {
    if (items.has(el)) return;
    const cv = document.createElement('canvas');
    cv.className = 'pt-c'; cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    const it = { cv, key: '' };
    items.set(el, it);
    // a live number (the calculator) or a new size draws anew
    new MutationObserver(() => { if (!el.contains(cv)) el.appendChild(cv); it.key = ''; draw(el); }).observe(el, { childList: true, characterData: true, subtree: true });
    if (window.ResizeObserver) new ResizeObserver(() => draw(el)).observe(el);
    draw(el);
  }
  function redrawAll() { for (const el of items.keys()) { items.get(el).key = ''; draw(el); } }
  function init(scope) { (scope || document).querySelectorAll('.pt').forEach(add); }

  // the text is transparent only while points can be drawn (no canvas, no script: plain ink type)
  root.classList.add('pt-on');
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => document.fonts && document.fonts.load ? document.fonts.load('700 64px Geist') : null).catch(() => null).then(() => { fontsOk = true; redrawAll(); });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => redrawAll();
  if (mq.addEventListener) mq.addEventListener('change', onScheme); else if (mq.addListener) mq.addListener(onScheme);
  addEventListener('resize', () => redrawAll());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();

  window.PointType = { sample, init, redraw: redrawAll, debug };
})();
