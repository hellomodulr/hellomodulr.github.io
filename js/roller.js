// The rolling word of the KI title, built from the same points as the field behind the page.
// Each word is set in Geist, sampled on a square grid and handed to the point field as a flat
// layer ("wort"). The old word rises and dissolves into the star field, the new word condenses
// out of it.
// The real text stays in the DOM for screen readers and search engines (one static sentence,
// no live region); the visible word is drawn by the canvas only while this module runs.
(function () {
  'use strict';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // the sampling is shared with the static point type of the page (js/punkttype.js)
  const sample = window.PointType.sample;

  function Roller(pf, el, opt = {}) {
    const words = [];
    el.querySelectorAll('.roll-w').forEach(item => { const w = item.textContent.trim(); if (w && !words.includes(w)) words.push(w); });
    let i = 0, active = false, timer = 0, ready = false, cache = new Map(), metrics = null;
    const HOLD = opt.hold || 2700;

    function measure() {
      const cs = getComputedStyle(el.closest('.huge') || el), fs = parseFloat(cs.fontSize);
      const ls = parseFloat(cs.letterSpacing) || 0;
      const item = el.querySelector('.roll-w'), lineH = item ? item.getBoundingClientRect().height || fs * 1.2 : fs * 1.2;
      // the grid follows the size of the type: about 21 dots on the em, a whole number of device
      // pixels per cell, exactly as the static point type (js/punkttype.js) that the word replaces
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const step = Math.max(2, Math.round(clamp(fs / 21, 2.2, 6) * dpr)) / dpr;
      return { fontSize: fs, letterSpacing: ls, lineHeight: lineH, step, dot: .74, weight: cs.fontWeight || 700, family: 'Geist, ' + (cs.fontFamily || 'sans-serif') };
    }
    function pointsFor(w) {
      const key = w + '|' + JSON.stringify(metrics);
      if (!cache.has(key)) cache.set(key, sample(w, metrics));
      return cache.get(key);
    }
    function show(w, first) {
      const pts = pointsFor(w);
      // the old word rises into the field, the new one condenses out of the stars
      pf.setLayer('wort', pts, { el, fresh: true, wait: first ? 260 : 160, dur: first ? 700 : 520, durPx: .65, durMax: 1400, ampMax: 12, drift: { vx: 50, vy: -35, spread: 50 }, fadeMs: 520 });
      // the static DOM word stays until the points have nearly arrived on it, then it fades out
      if (first) setTimeout(() => document.documentElement.classList.add('roll-points'), 900);
    }
    function next() {
      clearTimeout(timer);
      if (!active) return;
      if (document.hidden) { timer = setTimeout(next, 600); return; }
      i = (i + 1) % words.length;
      show(words[i], false);
      timer = setTimeout(next, HOLD + 900);
    }
    function start(delay) {
      if (!ready || active) return;
      active = true;
      clearTimeout(timer);
      timer = setTimeout(() => { if (!active) return; show(words[i], true); timer = setTimeout(next, HOLD + 1400); }, delay || 0);
    }
    function stop(opts = {}) {
      clearTimeout(timer);
      if (!active) return;
      active = false;
      // the word dissolves where it is, with the speed of the page
      pf.setLayer('wort', [], { drift: opts.drift || { vy: -30, spread: 40 }, fadeMs: 800 });
    }
    function refresh() {
      if (!ready) return;
      const m = measure();
      if (JSON.stringify(m) === JSON.stringify(metrics)) return;
      metrics = m;
      if (active) pf.setLayer('wort', pointsFor(words[i]), { el, quick: true });
    }
    // until the points take over, the first word stands still as text (no css rolling)
    document.documentElement.classList.add('roll-wait');
    const api = { words, start, stop, refresh, get active() { return active; }, get ready() { return ready; }, onReady: null };
    // sampling needs the real font, never the fallback
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => document.fonts && document.fonts.load ? document.fonts.load('700 64px Geist') : null).catch(() => null).then(() => {
      metrics = measure(); ready = true;
      if (api.onReady) api.onReady();
    });
    return api;
  }

  window.Roller = Roller;
})();
