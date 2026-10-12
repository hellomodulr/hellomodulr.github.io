// KI-Beratung: reading units and their snap stops, the point field that re-forms per unit,
// accordion, hour calculator, tracking.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const body = document.body, root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const bar = $('#bar');
  // frames: one screen each below the header (a section, or one half of a long section, css/ki.css)
  const secs = $$('main .frame');

  // No smooth scroll library on this page: the browser scrolls and snaps natively (see "snapping").
  const scrollPos = () => scrollY;

  // ---------- the two display sentences rise when they appear ----------
  // the nodes move into the wrapper (never re-parsed), so point type inside keeps its canvas
  $$('.kin .line').forEach(l => { const w = document.createElement('span'); w.className = 'li'; while (l.firstChild) w.appendChild(l.firstChild); l.appendChild(w); });
  // once risen, the lines stop clipping, so the points of a word in them can yield to the pointer
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const el = e.target; el.classList.add('in'); io.unobserve(el); setTimeout(() => el.classList.add('done'), reduced ? 0 : 1400); } }), { threshold: 0.2 });
  $$('.kin').forEach(el => io.observe(el));

  // ---------- reading units: a snap always shows one of them whole ----------
  // Atoms are the blocks that must never be cut: a heading, a paragraph, a table row, a figure.
  // Atoms side by side form one band. The bands of a section are packed into as few units as fit
  // between the header and the lower edge of the smallest viewport, balanced in height and never
  // ending on a lone heading. Each unit has one snap stop: where it sits whole on the screen,
  // centred if possible, with nothing of its neighbours cut at the top.
  // Lists and tables are one atom each (.keep): a stop never shows half a list. Where a list does
  // not fit a phone, the page has a compact version of it (the offer, the questions).
  const KEEP = '.tasks-block, .tr-fig, .roles, .case-list, .weg-body, .k1-list, .acc';
  const ATOMS = 'h1, h2, h3, p, li, thead, tr, .field, .about-photo, .cta-row, .cta-final, .tctrl, .tr-row, .acc-item, .k1-row, .btn, .qhint, ' + KEEP;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  body.appendChild(probe);
  const viewH = () => Math.min(innerHeight, probe.offsetHeight || innerHeight);
  let units = [];
  const G = { H: 0, bar: 0, m: 0, fit: 0 };
  function atomsOf(scope) {
    const all = $$(ATOMS, scope).filter(el => el.getClientRects().length && el.getBoundingClientRect().height >= 1 && !el.closest('.visually-hidden'));
    return all.filter(el => !all.some(o => o !== el && o.contains(el)));
  }
  function bandsOf(atoms) {
    const y0 = scrollY;
    const rs = atoms.map(el => { const r = el.getBoundingClientRect(); return { top: r.top + y0, bottom: r.bottom + y0, head: /^H[23]$/.test(el.tagName), els: [el] }; })
      .sort((a, b) => a.top - b.top);
    const out = [];
    for (const r of rs) {
      const b = out[out.length - 1];
      if (b && r.top < b.bottom - 1) { b.bottom = Math.max(b.bottom, r.bottom); b.head = b.head && r.head; b.els.push(...r.els); }
      else out.push({ ...r, els: [...r.els] });
    }
    return out;
  }
  function pack(bands, fit) {
    if (!bands.length) return [];
    const greedy = L => {
      const out = [];
      for (let i = 0; i < bands.length;) {
        let j = i;
        while (j + 1 < bands.length && bands[j + 1].bottom - bands[i].top <= L) j++;
        if (j > i && j < bands.length - 1 && bands[j].head) j--;
        out.push([i, j]); i = j + 1;
      }
      return out;
    };
    const g = greedy(fit);
    if (g.length === 1) return g;
    // balance: the smallest height limit that still needs no more units
    let lo = 0, hi = fit;
    for (let it = 0; it < 20; it++) { const mid = (lo + hi) / 2; if (greedy(mid).length <= g.length) hi = mid; else lo = mid; }
    return greedy(hi);
  }
  // Where a section is split into several units and a stop would still show a part of the next
  // unit, the space before that unit is widened just enough: at the stop of a unit the next one
  // begins below the lower edge. (On wide screens the sections fit whole and nothing changes.)
  const gapped = new Map();
  function clearGaps() {
    for (const [el, v] of gapped) { if (v === '' && el.tagName === 'TR' && el.cells[0] && el.cells[0].style.paddingTop) [...el.cells].forEach(c => { c.style.paddingTop = ''; }); else el.style.marginTop = v; }
    gapped.clear();
  }
  function addGap(u, prev, px) {
    const first = u.els.reduce((a, b) => (b.getBoundingClientRect().top < a.getBoundingClientRect().top ? b : a));
    // the outermost block that starts with this unit and holds nothing of the unit before
    let el = first;
    const t0 = first.getBoundingClientRect().top;
    while (el.parentElement && el.parentElement !== u.sec && u.sec.contains(el.parentElement)) {
      const p = el.parentElement;
      if (Math.abs(p.getBoundingClientRect().top - t0) > 1 || prev.els.some(a => p.contains(a))) break;
      el = p;
    }
    // a table row in table layout takes no margin: its cells get the space at the top instead
    if (el.tagName === 'TR' && getComputedStyle(el).display === 'table-row') { gapped.set(el, ''); [...el.cells].forEach(c => { c.style.paddingTop = (parseFloat(getComputedStyle(c).paddingTop) + px) + 'px'; }); }
    else { gapped.set(el, el.style.marginTop); el.style.marginTop = (parseFloat(getComputedStyle(el).marginTop) + px) + 'px'; }
  }
  function groupUnits() {
    const next = [];
    secs.forEach((sec, si) => {
      const atoms = atomsOf(sec);
      const bands = bandsOf(atoms);
      // the title is a screen of its own: one unit, its stop at the top of the page
      const screen = sec.matches('.hero');
      const groups = screen ? [[0, bands.length - 1]] : pack(bands, G.fit);
      // the figure of a unit: a block inside it that asks for one, or the frame itself when the
      // field of the figure is part of the unit; otherwise open sky (the table under the thesis,
      // and on phones the part of a long frame that does not hold the field)
      const own = sec.closest('[data-form]');
      if (!sec._sky) sec._sky = document.createElement('div');
      groups.forEach(([i, j], g) => {
        const els = bands.slice(i, j + 1).flatMap(b => b.els);
        const hosts = els.map(el => el.closest('[data-form]')).filter(h => h && sec.contains(h) && h !== sec && h !== own);
        const field = own && visibleField(own);
        const host = hosts[0] || (own && (!field || els.some(el => el === field || el.contains(field))) ? own : sec._sky);
        next.push({ sec, host, els, screen, first: g === 0, last: g === groups.length - 1 });
      });
    });
    return next;
  }
  function measureUnits(next) {
    for (const u of next) {
      let t = 1e9, b = -1e9;
      for (const el of u.els) { const r = el.getBoundingClientRect(); t = Math.min(t, r.top); b = Math.max(b, r.bottom); }
      u.top = t + scrollY; u.bottom = b + scrollY;
    }
  }
  function placeStops(next) {
    const { H, bar: barH, m } = G;
    const max = Math.max(0, root.scrollHeight - innerHeight);
    // every atom of the page, to see what a stop would cut of the neighbours
    const all = next.flatMap((u, ui) => u.els.map(el => { const r = el.getBoundingClientRect(); return { ui, top: r.top + scrollY, bottom: r.bottom + scrollY, head: /^H[123]$/.test(el.tagName) || !!el.querySelector('h2, h3') }; }));
    next.forEach((u, ui) => {
      u.over = false;
      if (u.screen) { const t = u.sec.getBoundingClientRect().top + scrollY; u.y = Math.round(clamp(t, 0, max)); if (u.bottom - t > H + 1) u.over = true; return; }
      const hi = Math.min(u.top - barH - m, max), lo = Math.max(Math.min(u.bottom + m, root.scrollHeight) - H, 0);
      if (lo > hi) { u.y = Math.round(clamp(u.top - barH - m, 0, max)); u.over = true; return; }
      // Frames abut, so a stop at a frame edge shows nothing of the neighbouring frames: the first
      // unit of a frame stops with the frame top right below the header (a frame that fits the
      // screen has only this one stop), the last unit of a longer frame with the frame bottom on
      // the lower edge of the screen (for the last frame: the end of the page, with the footer).
      const fr = u.sec.getBoundingClientRect(), ft = fr.top + scrollY - barH;
      const fb = u.sec === secs[secs.length - 1] ? max : fr.bottom + scrollY - H;
      if (u.first && ft >= lo - 1 && ft <= hi + 1) { u.y = Math.round(clamp(ft, 0, max)); return; }
      if (u.last && fb >= lo - 1 && fb <= hi + 1) { u.y = Math.round(clamp(fb, 0, max)); return; }
      // Within the range that shows the unit whole, take the position that cuts the fewest
      // neighbouring blocks (a heading counts most, a cut under the header more than one at
      // the lower edge), then the one that shows the fewest whole blocks of the neighbours, and
      // among equals the one closest to the centre.
      const c = (lo + hi) / 2, cand = [lo, hi, c];
      for (const a of all) {
        if (a.ui === ui || a.bottom < lo + barH - H || a.top > hi + H) continue;
        cand.push(a.bottom - barH, a.top - H, a.top - barH - m, a.bottom + m - H);
      }
      let best = c, bestP = Infinity;
      for (const y0 of cand) {
        const y = clamp(y0, lo, hi), t = y + barH, b = y + H;
        let pen = Math.abs(y - c) / H;
        for (const a of all) {
          if (a.ui === ui) continue;
          if (a.top < t - 1 && a.bottom > t + 1) pen += a.head ? 12 : 4;
          else if (a.top < b - 1 && a.bottom > b + 1) pen += a.head ? 10 : 3;
          // a whole block of a neighbour in view is no cut, but a calm stop shows its unit alone
          else if (a.top >= t - 1 && a.bottom <= b + 1) pen += a.top < u.top ? 1.5 : 0.8;
        }
        if (pen < bestP - 1e-6) { bestP = pen; best = y; }
      }
      u.y = Math.round(best);
    });
    if (next.length) next[0].y = 0;
  }
  function layoutUnits() {
    clearGaps();
    // the last frame is shortened by the footer, so both together fill the last screen
    root.style.setProperty('--foot-h', $('.site-footer').offsetHeight + 'px');
    const H = viewH(), barH = bar.offsetHeight, m = Math.round(clamp(H * 0.026, 12, 24));
    Object.assign(G, { H, bar: barH, m, fit: H - barH - 2 * m });
    const next = groupUnits();
    measureUnits(next); placeStops(next);
    let widened = false;
    for (let i = 0; i + 1 < next.length; i++) {
      const a = next[i], b = next[i + 1];
      if (a.sec !== b.sec) continue;
      const peeks = a.y + H > b.top + 1 || b.y + barH < a.bottom - 1;
      // enough space that neither unit shows the other: a at the top of the screen, b at its foot
      const g = b.top - a.bottom, mb = i + 2 === next.length ? 0 : m; // the last unit rests on the lower edge
      const need = Math.ceil(Math.max((H - barH - m) - (a.bottom - a.top), (H - barH - mb) - (b.bottom - b.top)) - g) + 2;
      if (peeks && need > 0) { addGap(b, a, need); widened = true; measureUnits(next); }
    }
    if (widened) placeStops(next);
    const max = Math.max(0, root.scrollHeight - innerHeight);
    // stops closer than a few pixels are one stop
    units = next.filter((u, i) => !i || Math.abs(u.y - next[i - 1].y) > 4);
    if (units.length && units[units.length - 1].y < max - 4 && max - units[units.length - 1].y < 8) units[units.length - 1].y = max;
    placeAnchors();
    sig = signature();
    return units;
  }
  // the stops belong to one size of window and document; any change and they are measured anew
  let sig = '';
  const signature = () => [innerWidth, innerHeight, viewH(), root.scrollHeight].join('|');
  const fresh = () => { if (signature() !== sig) layoutUnits(); };
  const nearest = y => { let k = 0; units.forEach((u, i) => { if (Math.abs(u.y - y) < Math.abs(units[k].y - y)) k = i; }); return k; };

  // the browser snaps natively (mandatory) on invisible anchors at the stops; the anchors are kept
  // and only moved, so after a change of layout the browser stays on the anchor it snapped to
  const anchors = document.createElement('div');
  anchors.className = 'snap-anchors'; anchors.setAttribute('aria-hidden', 'true');
  body.appendChild(anchors);
  function placeAnchors() {
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    while (anchors.children.length > units.length) anchors.lastElementChild.remove();
    while (anchors.children.length < units.length) anchors.appendChild(document.createElement('i'));
    units.forEach((u, k) => { anchors.children[k].style.top = (u.y + pad) + 'px'; });
  }

  // ---------- accordion ----------
  $$('.acc-head').forEach(h => h.addEventListener('click', () => {
    const item = h.closest('.acc-item'); const open = item.classList.toggle('open');
    document.getElementById(h.getAttribute('aria-controls')).inert = !open;
    h.setAttribute('aria-expanded', String(open));
    setTimeout(layoutUnits, 600);
  }));

  // ---------- hour calculator (same formula as before) ----------
  const calc = { P: 8, H: 18 };
  let leader = null, here = null;
  (function () {
    const p = $('#tr-ppl'), h = $('#tr-hrs'); if (!p) return;
    const fill = el => el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
    function u() {
      const P = +p.value, H = +h.value;
      calc.P = P; calc.H = H;
      $('#tr-pplv').textContent = P; $('#tr-hrsv').textContent = H;
      const wk = Math.round(P * H * 0.5), yr = wk * 45, fte = Math.round(yr / 1700 * 10) / 10;
      $('#tr-week').textContent = wk; $('#tr-year').textContent = yr.toLocaleString('de-DE'); $('#tr-fte').textContent = '≈ ' + fte.toLocaleString('de-DE');
      $('#tr-res').innerHTML = 'Das sind <b>' + wk + ' Stunden pro Woche</b>, die frei werden und für Aufgaben genutzt werden können, die KI heute noch nicht abnehmen kann. Über das Jahr entspricht das gut <b>' + fte.toLocaleString('de-DE') + ' Vollzeitstellen</b> an wiedergewonnener Kapazität, ohne eine einzige neue Einstellung.';
      fill(p); fill(h);
      if (leader && leader.dataset.form === 'stunden') formFor(leader, 0);
    }
    p.addEventListener('input', u); h.addEventListener('input', u); u();
  })();

  // ---------- the point field ----------
  const canvas = $('#field');
  const P = window.Punkte;
  // more points than in 06: the rolling word of the title is made of them as well
  const small = Math.min(innerWidth, innerHeight) < 600;
  // `uniform`: one pointer rule for every point of the page (js/punkte.js)
  const pf = P.create(canvas, { count: small ? 3400 : 4800, diffuse: true, uniform: true });
  if (params.has('debug')) window.__pf = pf; // test scripts only
  const fieldWeg = $('.field-weg');
  const visibleField = host => $$('.field', host).find(f => f.offsetWidth > 0 && f.offsetHeight > 0) || null;
  // which figure each unit asks for, built for the size of its field; every figure stays inside
  // its field, so a snap that shows the field whole shows the figure whole
  const FORMS = {
    // the title carries its accent in the rolling word, so the raster has no rust mark of its own
    raster(w, h) { const f = P.F.raster(w, h, { fit: innerHeight < 560 ? 0.72 : 0.84, squash: 0.55, hover: 0.3, hzk: clamp(h / 640, 0.3, 1) }); return { form: f, dyn: P.rasterSettle(f, { start: 0.2, span: 5 }), cam: { pitch: 0.96, yaw: -0.42 } }; },
    // the few heads where the knowledge sits and the result is decided carry the rust of this frame
    koepfe(w, h) { const f = P.F.koepfe(w, h * 0.92, { n: pf.small ? 260 : 460, cloud: pf.small ? 400 : 760, acc: true }); return { form: f, dyn: P.koepfeFlow(f), cam: { pitch: 0.12, yaw: 0 } }; },
    // the streams: one rust point steers, many tasks run in order. The steering point is the accent
    // of this frame: a solid square of 11 by 11 rust points
    netz(w, h) {
      const f = P.F.stroeme(w * 0.94, h * 0.9, { per: pf.small ? 46 : 70, mark: 11, markS: clamp(w / 110, 2.6, 4.4) }); return { form: f, dyn: P.stroemeFlow(f), cam: { pitch: 0.12, yaw: -0.08, float: 0.5 } };
    },
    treppe(w, h) {
      // blocks sit exactly above the four steps of the list below; on phones (one column) a flat
      // strip sits above each step, in the space the step keeps free at its top
      const gap = parseFloat(getComputedStyle(root).getPropertyValue('--gap')) || 24;
      const one = getComputedStyle(fieldWeg).position === 'absolute';
      let step = one ? 4.5 : 7.5, f, rows = null;
      if (one) {
        const fr = fieldWeg.getBoundingClientRect();
        rows = $$('#wegpath .pnode').map(li => { const r = li.getBoundingClientRect(), pad = parseFloat(getComputedStyle(li).paddingTop) || 34; return r.top - fr.top + pad - 26 - h / 2; });
      }
      // never ask for more points than the field has, or the last block stays unfinished
      do { f = P.F.treppe(w, h, one ? { rows, band: 10, depth: 14, step } : { gap, step }); step *= 1.1; } while (f.length > pf.P.length * 0.9);
      return { form: f, cam: { pitch: 0, yaw: 0, float: one ? 0.15 : 0.35 } };
    },
    stunden(w, h) {
      let step = Math.max(4.5, Math.min(6.5, w / 90)), f;
      do { f = P.F.stunden(w, h, { people: calc.P, hours: calc.H, step }); step *= 1.1; } while (f.length > pf.P.length * 0.9);
      return { form: f, cam: { pitch: 0, yaw: 0, float: 0.2 } };
    },
    // the close: two heads in conversation
    schluss(w, h) {
      const f = P.F.gespraech(w, h, { n: pf.small ? 300 : 480, per: pf.small ? 60 : 90 }); return { form: f, dyn: P.gespraechFlow(f), cam: { pitch: 0.12, yaw: 0, float: 0.5 } };
    },
  };
  let lastBox = null;
  function formFor(host, stagger) {
    const name = host && host.dataset.form, el = host && visibleField(host);
    // the reading units without a figure (the person, the offer, the questions) are open sky
    if (!name || !el || !FORMS[name]) { lastBox = null; pf.setForm([], { el: null, stagger: 700 }); pf.S.stars = 0.6; return; }
    const r = el.getBoundingClientRect(), o = FORMS[name](r.width, r.height);
    lastBox = { el, w: r.width, h: r.height };
    pf.S.stars = name.startsWith('raster') ? 1 : 0.6;
    pf.setForm(o.form, { el, dyn: o.dyn || null, cam: o.cam, stagger: stagger == null ? 1000 : stagger });
  }
  // the rolling word of the title lives while the title leads
  const rollEl = $('.hero .roll');
  const roller = !reduced && window.Roller && rollEl ? window.Roller(pf, rollEl) : null;
  if (roller) roller.onReady = () => { if (leader && leader.id === 'ch1') roller.start(params.has('still') ? 0 : 150); };
  // a unit leads the field; its figure host decides the figure
  function lead(u) {
    here = u;
    const host = u.host;
    if (host === leader) return;
    leader = host;
    formFor(host);
    if (roller) { if (host.id === 'ch1') roller.start(400); else roller.stop(); }
  }
  // While the page moves freely (touch, keyboard focus, find in page), the unit whose stop is nearest
  // leads. Two guards keep every frame calm: a band of hysteresis, so a figure never flips back and
  // forth between two stops, and a short settle time, so a fast flick across several units starts
  // one transition at the end instead of one per unit passed. A snap leads its target at once.
  const BAND = 0.06, SETTLE = 120;
  let pending = null, pendingAt = 0, settleTimer = 0, target = null;
  function candidate() {
    if (!units.length) return null;
    const y = scrollPos(), u = units[nearest(y)];
    if (!here || u === here || units.indexOf(here) < 0) return u;
    return Math.abs(u.y - y) + G.H * BAND < Math.abs(here.y - y) ? u : here;
  }
  function pick() {
    bar.classList.toggle('scrolled', scrollPos() > 8);
    pf.S.scrollY = scrollPos();
    choose();
    // reduced motion draws only on change: after the figure is chosen
    if (reduced) pf.redraw();
  }
  function choose() {
    if (target != null) return;
    const u = candidate(); if (!u) return;
    if (!here) lead(u);
    else if (u !== here) {
      if (reduced) lead(u);
      else if (u !== pending) { pending = u; pendingAt = performance.now(); clearTimeout(settleTimer); settleTimer = setTimeout(pick, SETTLE + 20); }
      else if (performance.now() - pendingAt >= SETTLE) { pending = null; lead(u); }
      else { clearTimeout(settleTimer); settleTimer = setTimeout(pick, SETTLE + 20 - (performance.now() - pendingAt)); }
    } else pending = null;
  }
  addEventListener('scroll', pick, { passive: true });

  // ---------- snapping ----------
  // The browser snaps natively: html.snap has scroll-snap-type: y mandatory (css/ki.css) and the
  // anchors above are the only snap positions. Keyboard, touch, scrollbar, find in page and focus
  // all come to rest on a stop that way, whatever the device or the speed of the frames.
  // The wheel is the one exception: Chrome snaps a wheel tick back to the stop it came from when
  // the next stop is far away, so the page would not move. Each wheel gesture (mouse or trackpad)
  // therefore asks the browser for one native smooth scroll to the next stop in its direction.
  // A gesture starts after a pause of the wheel; its tail (trackpad inertia) moves nothing more;
  // a wheel that keeps turning moves on one stop at a time. There is no scroll library and no
  // animation loop of our own: if anything ever leaves the page between stops, the mandatory snap
  // of the browser brings it back to one. Reduced motion does not snap (no handler, no snap type).
  const snapOn = !reduced;
  let settleWatch = 0;
  function go(i, how) {
    fresh();
    if (!units.length) return;
    i = clamp(i, 0, units.length - 1);
    const u = units[i];
    pending = null; lead(u);
    if (Math.abs(u.y - scrollY) < 1) { target = null; return; }
    target = i;
    scrollTo({ top: u.y, behavior: reduced || how === 'instant' ? 'instant' : 'smooth' });
    // the figure follows the page again once it rests
    const done = () => { clearTimeout(settleWatch); removeEventListener('scrollend', done); if (target === i) { target = null; pick(); } };
    addEventListener('scrollend', done);
    clearTimeout(settleWatch); settleWatch = setTimeout(done, 1600);
  }
  function step(dir) {
    fresh();
    if (!units.length) return;
    if (target != null) return go(target + dir);
    const y = scrollY, k = nearest(y);
    if (Math.abs(units[k].y - y) < 4) return go(k + dir);
    // between stops (only while the browser is still settling): the next stop in the direction
    if (dir > 0) { const i = units.findIndex(u => u.y > y + 4); go(i < 0 ? units.length - 1 : i); }
    else { let i = -1; units.forEach((u, j) => { if (u.y < y - 4) i = j; }); go(i < 0 ? 0 : i); }
  }
  if (snapOn) {
    let lastT = 0, armed = true, sum = 0, firedAt = 0;
    addEventListener('wheel', e => {
      if (e.ctrlKey || e.defaultPrevented) return; // pinch zoom and anything that handles its own wheel
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (Math.abs(e.deltaX) > Math.abs(d)) return;
      e.preventDefault();
      const now = performance.now(), gap = now - lastT, a = Math.abs(d); lastT = now;
      // a new gesture after a pause; a wheel that keeps turning hard moves on after a while
      if (gap > 180 || (!armed && now - firedAt > 900 && a >= 20)) { armed = true; sum = 0; }
      if (!armed) return;
      sum += d;
      if (Math.abs(sum) >= 4) { armed = false; firedAt = now; step(Math.sign(sum)); }
    }, { passive: false });
  }

  // anchors and the skip link land on the stop of their section
  function goToEl(el) {
    if (!el) return;
    const i = units.findIndex(u => u.sec === el || el.contains(u.els[0]) || u.els.some(a => el.contains(a)));
    if (i >= 0) return go(i);
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1); const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault(); goToEl(el);
    const f = el.querySelector('a.go, .acc-head, a, button');
    if (a.classList.contains('skip') && f) setTimeout(() => f.focus({ preventScroll: true }), reduced ? 30 : 1400);
  }));

  // Rebuild the units on every real change of the layout; a figure is rebuilt only when the box
  // of the figure really changed size (phones fire resize when the address bar shows or hides,
  // and that must not shake the figure). A resize keeps the unit in view on its stop.
  let rzTimer = 0, lastW = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      const keep = here && target == null ? here : null;
      layoutUnits();
      if (leader) {
        const el = visibleField(leader), r = el && el.getBoundingClientRect();
        const changed = !lastBox || !el || el !== lastBox.el || Math.abs(r.width - lastBox.w) > 2 || Math.abs(r.height - lastBox.h) > 2;
        if (changed) formFor(leader, 0);
      }
      if (roller) roller.refresh();
      if (keep && innerWidth !== lastW) {
        const i = units.findIndex(u => u.sec === keep.sec && u.host === keep.host);
        if (i >= 0) scrollTo({ top: units[i].y, behavior: 'instant' });
      }
      lastW = innerWidth;
      here = null; pick();
    }, 150);
  });
  layoutUnits(); pick();
  // web fonts change line breaks: measure again once they are in
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutUnits(); pick(); });
  addEventListener('load', () => { layoutUnits(); pick(); });
  if (params.has('still')) pf.settle(60);
  if (params.has('debug')) window.__ki = { get units() { fresh(); return units; }, G, layoutUnits, go, step, get target() { return target; }, anchors, get leader() { return leader && (leader.id || leader.className); } };

  // ---------- the pointer: one rule for every point of the page ----------
  // A mouse or a pen moves the pointer, and every point near it yields and springs back: the stars,
  // every figure, the rolling word and the point type (js/punkte.js, js/punkttype.js). A finger
  // sends one ripple per tap: the points around the tap yield for a moment and spring back. A finger
  // that scrolls or drags moves no point. Reduced motion: no point yields, no ripple.
  const RIPPLE = 260;
  let tap = null, rippleT = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') { if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null; return; }
    pf.pointer(e.clientX, e.clientY, true);
  }, { passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') tap = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  addEventListener('pointercancel', e => { if (e.pointerType === 'touch') tap = null; });
  addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const t = tap; tap = null;
    if (!t || reduced || performance.now() - t.t > 500) return;
    pf.pointer(t.x, t.y, true);
    clearTimeout(rippleT); rippleT = setTimeout(() => pf.leave(), RIPPLE);
  }, { passive: true });
  // a lifted finger leaves the page as well; the ripple ends on its own
  root.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') pf.leave(); });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) pf.leave(); });
  addEventListener('blur', () => pf.leave());
  document.addEventListener('visibilitychange', () => { pf.S.running = !document.hidden; });

  // the way: pointing at a step (or tapping it) brings its block forward and its text with it, the
  // others step back; a second tap, or a tap elsewhere, lets all four stand again
  const wegPath = $('#wegpath');
  let picked = -1;
  function pickStep(g) {
    picked = g;
    $$('.pnode', wegPath).forEach(li => li.classList.toggle('on', +li.dataset.g === g));
    wegPath.classList.toggle('picked', g >= 0);
    for (const q of pf.S.form) if (q.g != null) q.dim = g >= 0 && leader && leader.id === 'ch5' && q.g !== g ? 1 : 0;
    if (reduced) pf.redraw();
  }
  $$('.pnode', wegPath).forEach(li => {
    const g = +li.dataset.g;
    li.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') pickStep(g); });
    li.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pickStep(-1); });
    li.addEventListener('click', e => { if (e.pointerType !== 'mouse') pickStep(picked === g ? -1 : g); });
  });
  document.addEventListener('click', e => { if (picked >= 0 && !wegPath.contains(e.target)) pickStep(-1); });

  // ---------- the offer on small screens: four names, one description open at a time ----------
  const offer = $('#ch9'), compactMQ = matchMedia('(max-width: 760px), (max-height: 520px) and (orientation: landscape)');
  const plus = '<svg class="ai" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v16"/></svg>';
  function openOffer(row) {
    $$('.k1-row', offer).forEach(r => {
      const on = r === row; r.classList.toggle('open', on);
      const b = $('.k1-head', r); if (b) b.setAttribute('aria-expanded', String(on));
    });
  }
  function setupOffer() {
    const compact = compactMQ.matches;
    offer.classList.toggle('k1-compact', compact);
    $$('.k1-row', offer).forEach((row, i) => {
      const h3 = $('h3', row), c = $('.k1-c', row), name = h3.textContent.trim();
      c.id = c.id || 'k1c' + (i + 1);
      if (compact && !$('.k1-head', h3)) h3.innerHTML = `<button class="k1-head" type="button" aria-expanded="false" aria-controls="${c.id}"><span>${name}</span>${plus}</button>`;
      if (!compact && $('.k1-head', h3)) h3.textContent = name;
    });
    if (compact && !$('.k1-row.open', offer)) openOffer($('.k1-row', offer));
    if (!compact) $$('.k1-row', offer).forEach(r => r.classList.remove('open'));
  }
  offer.addEventListener('click', e => {
    const n = e.target.closest('.k1-n'); if (!n || !offer.classList.contains('k1-compact')) return;
    const row = n.closest('.k1-row'); openOffer(row.classList.contains('open') ? null : row);
    layoutUnits();
  });
  setupOffer(); layoutUnits(); pick();
  if (compactMQ.addEventListener) compactMQ.addEventListener('change', () => { setupOffer(); layoutUnits(); });

  // ---------- tracking events (fire once Plausible is active, otherwise no-op) ----------
  (function () {
    function track(ev, props) { try { if (window.plausible) window.plausible(ev, { props: props || {} }); } catch (e) { /* ignore */ } }
    $$('#tcta, .hero-cta, .tool-cta, #ch10 .go').forEach(a => a.addEventListener('click', () => {
      track('Erstgespraech', { quelle: (a.id || (a.className || '').split(' ').pop() || 'cta') });
    }));
    $$('a[href^="tel:"]').forEach(t => t.addEventListener('click', () => track('Anruf')));
    let tdone = false;
    $$('#tr-ppl, #tr-hrs').forEach(s => s.addEventListener('input', () => { if (!tdone) { tdone = true; track('Tool-genutzt'); } }));
  })();

  // on arrival the curtain lifts while the stars settle
  requestAnimationFrame(() => body.classList.add('ready'));

  console.log('%cKein Softwareentwickler. Und doch ist diese Seite allein mit KI entstanden. Genau darum geht es hier. Lukas, MODULR', 'font:13px/1.6 monospace;color:#c2553a;padding:6px 0');
})();
