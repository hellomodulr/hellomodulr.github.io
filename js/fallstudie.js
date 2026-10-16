// Case study (Fallstudie): reading units and their snap stops (the same rules as js/ki.js), the
// point field with the figures of this page, and the material of the case: the pen that marks the
// sources in rust points, the values that move from the plan into the table, the zoom onto the tree
// and the volume of the Baufenster (three.js, loaded when the page comes close to it).
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body, root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const bar = $('#bar');
  const SCRIPT = document.currentScript ? document.currentScript.src : location.href;
  // frames: one screen each below the header (css/ki.css)
  const secs = $$('main .frame');
  const scrollPos = () => scrollY;
  // Phones (upright, and sideways with little height) get a flowing page: no frames, no stops,
  // no snapping, native momentum scrolling (css/ki.css, "phones: a flowing page"). The reading
  // units stay, one per frame, only to choose the figure of the point field.
  const flowMQ = matchMedia('(max-width: 760px), (max-height: 520px) and (orientation: landscape) and (max-width: 1000px)');
  let flow = flowMQ.matches;
  root.classList.toggle('snap', !flow);

  // ---------- the display sentences rise when they appear ----------
  $$('.kin .line').forEach(l => { const w = document.createElement('span'); w.className = 'li'; while (l.firstChild) w.appendChild(l.firstChild); l.appendChild(w); });
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
  const KEEP = '.steck, .vtab, .checks, .tally, .rq, .kz, .frage blockquote';
  const ATOMS = 'h1, h2, h3, p, li, tr, .field, .plan, .vol, .cta-final, .btn, .dl, ' + KEEP;
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
    Object.assign(G, { H, bar: barH, m, fit: flow ? Infinity : H - barH - 2 * m });
    const next = groupUnits();
    measureUnits(next);
    if (flow) {
      // no stops: each unit knows the field of its figure, if it holds one (see flowScore)
      next.forEach(u => { const f = u.host && u.host.dataset && u.host.dataset.form ? visibleField(u.host) : null; u.field = f && u.els.some(el => el === f || el.contains(f)) ? f : null; u.y = u.top - barH; });
      units = next; placeAnchors(); sig = signature();
      return units;
    }
    placeStops(next);
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
    const n = flow ? 0 : units.length;
    while (anchors.children.length > n) anchors.lastElementChild.remove();
    while (anchors.children.length < n) anchors.appendChild(document.createElement('i'));
    if (n) units.forEach((u, k) => { anchors.children[k].style.top = (u.y + pad) + 'px'; });
  }

  // ---------- the point field ----------
  const canvas = $('#field');
  const P = window.Punkte;
  const small = Math.min(innerWidth, innerHeight) < 600;
  const pf = P.create(canvas, { count: small ? 2800 : 4000, diffuse: true, uniform: true });
  if (params.has('debug')) window.__pf = pf;
  const visibleField = host => $$('.field', host).find(f => f.offsetWidth > 0 && f.offsetHeight > 0) || null;

  // the four Baufenster of the plan (PDF points, from the vector drawing) and their heights over
  // the ground floor (8,0 m and 12,0 m, from the heights of the plan); 1 pt = 0.1764 m
  const M_PER_PT = 0.1763951250801796;
  const BAUFENSTER = [
    { id: 'WR1', h: 8, pts: [[439.3, 658.1], [269.1, 1002.8], [340.2, 1037.9], [510.4, 693.4]] },
    { id: 'WR2', h: 8, pts: [[659.0, 577.1], [626.5, 643.2], [1045.7, 849.8], [1078.3, 783.7]] },
    { id: 'WR3', h: 8, pts: [[645.9, 716.0], [613.3, 782.2], [989.7, 967.6], [1022.2, 901.6]] },
    { id: 'WR4', h: 12, pts: [[1104.2, 833.5], [1074.2, 925.8], [1161.3, 956.7], [1293.2, 993.8], [1437.7, 1016.7], [1449.2, 926.7], [1313.1, 905.1], [1188.8, 869.8]] },
  ];
  // the 38 checks that hold, in the order of the run: s stimmig, h Hinweis, r Rückfrage
  const CHECKS = 'srrrrhshhshsssrhrhrhhhhhrhssshhshsrrhh';
  const inside = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

  const FORMS = {
    // the entry: the four Baufenster as volumes of points, on their real plan and at their real height
    baufenster(w, h) {
      const all = BAUFENSTER.flatMap(b => b.pts), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const k = Math.min(w * .86 / (Math.max(...xs) - Math.min(...xs)), h * 1.3 / (Math.max(...ys) - Math.min(...ys)));
      const step = clamp(w / 120, 3.6, 5.2), out = [];
      for (const b of BAUFENSTER) {
        const poly = b.pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k]), H = b.h / M_PER_PT * k;
        poly.forEach((a, i) => {
          const c = poly[(i + 1) % poly.length];
          P.F.line([a[0], a[1], 0], [c[0], c[1], 0], step).forEach(p => out.push(p));
          P.F.line([a[0], a[1], H], [c[0], c[1], H], step).forEach(p => out.push(p));
          P.F.line([a[0], a[1], 0], [a[0], a[1], H], step * .8).forEach(p => out.push(p));
        });
        // the roof as a faint grid, so each volume reads as a mass
        const fx = poly.map(p => p[0]), fy = poly.map(p => p[1]), g = step * 2.2;
        for (let x = Math.min(...fx) + g / 2; x < Math.max(...fx); x += g) for (let y = Math.min(...fy) + g / 2; y < Math.max(...fy); y += g) if (inside(x, y, poly)) out.push({ x, y, z: H, dim: 1 });
      }
      return { form: out, cam: { pitch: 0.92, yaw: -0.36, float: 0.4 } };
    },
    // every check that holds is one square of points; the questions to the city are the rust of the frame
    pruefungen(w, h) {
      const cols = 10, rows = Math.ceil(CHECKS.length / cols);
      const cell = Math.min(w / cols, h / rows), n = cell > 40 ? 5 : 4, st = cell * .72 / (n - 1 || 1), out = [];
      const x0 = -cols * cell / 2 + cell * .14, y0 = -rows * cell / 2 + cell * .14;
      [...CHECKS].forEach((c, i) => {
        const cx = x0 + (i % cols) * cell, cy = y0 + Math.floor(i / cols) * cell;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) out.push({ x: cx + a * st, y: cy + b * st, z: 0, k: i, acc: c === 'r' ? 1 : 0, dim: c === 'h' ? 1 : 0 });
      });
      return { form: out, cam: { pitch: 0, yaw: 0, float: 0.25 }, waitKey: 38 };
    },
    // the close: two heads and the common ground between them, as on the KI page
    schluss(w, h) {
      const f = P.F.grundlage(w, h, { small: pf.small }); return { form: f, dyn: P.grundlageFlow(f), cam: { pitch: 0.9, yaw: -0.12, float: 0.25 } };
    },
  };
  let lastBox = null, leader = null, here = null;
  function formFor(host, stagger) {
    const name = host && host.dataset.form, el = host && visibleField(host);
    if (!name || !el || !FORMS[name]) { lastBox = null; pf.setForm([], { el: null, stagger: 700 }); pf.S.stars = 0.6; return; }
    const r = el.getBoundingClientRect(), o = FORMS[name](r.width, r.height);
    lastBox = { el, w: r.width, h: r.height };
    pf.S.stars = 0.6;
    pf.setForm(o.form, { el, dyn: o.dyn || null, cam: o.cam, stagger: stagger == null ? 1000 : stagger, waitKey: o.waitKey });
  }
  function lead(u) {
    here = u;
    const host = u.host;
    if (host === leader) return;
    leader = host;
    formFor(host);
  }

  // ---------- the pen: rust points along the marks of a source ----------
  // Each .pen svg is drawn in the coordinates of its source (PDF points); its marks (rect, circle)
  // are geometry only. Rust squares of a fixed screen size are set along them at a fixed spacing,
  // each with its own delay, so a mark is drawn point by point when its frame becomes active.
  const PEN = { step: 6.5, size: 3, pad: 6 };
  function placePen(svg) {
    const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    if (!r.width || !vb || !vb.width) return;
    const sx = r.width / vb.width, sy = r.height / vb.height, NS = 'http://www.w3.org/2000/svg';
    $$('.dot', svg).forEach(d => d.remove());
    const start = parseFloat(svg.dataset.start || '0.15'), gap = parseFloat(svg.dataset.gap || '0.5'), draw = parseFloat(svg.dataset.draw || '0.55');
    $$('.mark', svg).forEach((m, mi) => {
      const pts = [];
      if (m.tagName === 'circle') {
        const cx = (+m.getAttribute('cx') - vb.x) * sx, cy = (+m.getAttribute('cy') - vb.y) * sy, rr = +m.getAttribute('r') * sx;
        const n = Math.max(12, Math.round(2 * Math.PI * rr / PEN.step));
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      } else {
        const x0 = (+m.getAttribute('x') - vb.x) * sx - PEN.pad, y0 = (+m.getAttribute('y') - vb.y) * sy - PEN.pad;
        const x1 = x0 + +m.getAttribute('width') * sx + 2 * PEN.pad, y1 = y0 + +m.getAttribute('height') * sy + 2 * PEN.pad;
        const side = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / PEN.step)); for (let i = 0; i < n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
        side([x0, y0], [x1, y0]); side([x1, y0], [x1, y1]); side([x1, y1], [x0, y1]); side([x0, y1], [x0, y0]);
      }
      pts.forEach(([x, y], i) => {
        const d = document.createElementNS(NS, 'rect');
        d.setAttribute('class', 'dot');
        // whole device pixels keep the squares crisp
        d.setAttribute('x', vb.x + (Math.round(x - PEN.size / 2)) / sx); d.setAttribute('y', vb.y + (Math.round(y - PEN.size / 2)) / sy);
        d.setAttribute('width', PEN.size / sx); d.setAttribute('height', PEN.size / sy);
        d.style.setProperty('--d', (reduced ? 0 : start + mi * gap + i / pts.length * draw).toFixed(3) + 's');
        svg.appendChild(d);
      });
    });
  }
  const pens = $$('svg.pen');
  if (window.ResizeObserver) { const ro = new ResizeObserver(es => es.forEach(e => placePen(e.target))); pens.forEach(s => ro.observe(s)); }
  pens.forEach(placePen);
  // timing of the marks per figure: the four templates follow the values into the table
  const penLesen = $('.plan-lesen .pen'); if (penLesen) Object.assign(penLesen.dataset, { start: '0.2', gap: '0.8', draw: '0.45' });
  $$('.fs-rueck .pen').forEach((s, i) => Object.assign(s.dataset, { start: String(0.3 + i * 0.9), gap: '0.45', draw: '0.5' }));
  $$('.plan-lesen-m .pen').forEach((s, i) => Object.assign(s.dataset, { start: String(0.2 + i * 0.8), gap: '0', draw: '0.45' }));
  const penRing = $('.pen-ring'); if (penRing) Object.assign(penRing.dataset, { start: '0', gap: '0', draw: '0.7' });
  pens.forEach(placePen);

  // ---------- c) the values move from their template into the table ----------
  // positions inside a template where each field sits (share of the box), as in the film
  const SLOT = [[.3, .17], [.78, .22], [.27, .45], [.72, .5], [.22, .74], [.62, .86], [.7, .82]];
  const inView = r => r.bottom > bar.offsetHeight && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  // one row of the table: its values leave the template and land in their cells
  function flyRow(tr, mark) {
    const mr = mark && mark.getBoundingClientRect();
    // the flowing page may move while a value travels: it then travels in page coordinates
    const ox = flow ? scrollX : 0, oy = flow ? scrollY : 0;
    [...tr.cells].forEach((cell, j) => {
      const v = $('.v', cell); if (!v) return;
      const tr_ = v.getBoundingClientRect();
      if (reduced || !mr || !inView(mr) || !inView(tr_)) { setTimeout(() => v.classList.add('in'), reduced ? 0 : j * 60); return; }
      const sx = mr.left + mr.width * SLOT[j][0], sy = mr.top + mr.height * SLOT[j][1];
      const tx = tr_.left + tr_.width / 2, ty = tr_.top + tr_.height / 2;
      const f = document.createElement('span'); f.className = 'fly'; f.textContent = v.textContent; f.setAttribute('aria-hidden', 'true');
      if (flow) f.style.position = 'absolute';
      body.appendChild(f);
      const at = (x, y, s) => `translate(${x + ox}px, ${y + oy}px) translate(-50%, -50%) scale(${s})`;
      const mx = (sx + tx) / 2, my = Math.min(sy, ty) - 40;
      const an = f.animate([
        { transform: at(sx, sy, .7), opacity: 0 },
        { transform: at(sx, sy - 10, 1.05), opacity: 1, offset: .18 },
        { transform: at(mx, my, 1.05), opacity: 1, offset: .58 },
        { transform: at(tx, ty, 1), opacity: 1 },
      ], { duration: 900 + j * 50, delay: j * 70, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'both' });
      an.onfinish = () => { v.classList.add('in'); f.remove(); };
    });
  }
  function fly() {
    const pen = $$('.fs-lesen svg.pen').filter(s => s.getBoundingClientRect().width > 0);
    const rows = $$('#vtab tbody tr'), marks = pen.flatMap(s => $$('.mark', s));
    if (!flow || reduced) {
      rows.forEach((tr, i) => setTimeout(() => flyRow(tr, marks[i]), (reduced ? 0 : 0.2 + i * 0.8 + 0.4) * 1000));
      return;
    }
    // the flowing page starts early, while the figure is still coming in: each row waits until its
    // template and its row of the table are both whole on screen, so every flight is seen from its
    // start to its end (after a few seconds without that, the values simply appear)
    const whole = r => r.top >= bar.offsetHeight - 1 && r.bottom <= innerHeight + 1;
    let i = 0, next = performance.now() + 500, since = 0;
    const tick = now => {
      if (i >= rows.length) return;
      if (now >= next) {
        const mr = marks[i] && marks[i].getBoundingClientRect(), rr = rows[i].getBoundingClientRect();
        if (!since) since = now;
        // the reader has moved on past the frame: the remaining values are simply there
        if (!inView(rr) && !(mr && inView(mr))) { for (; i < rows.length; i++) $$('.v', rows[i]).forEach(v => v.classList.add('in')); return; }
        if ((mr && whole(mr) && whole(rr)) || now - since > 6000) { flyRow(rows[i], marks[i]); i++; next = now + 800; since = 0; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- e) the zoom onto the tree that was missed ----------
  const baum = $('#baum');
  function zoomTree(on) {
    if (!baum) return;
    baum.classList.toggle('zoomed', on);
    clearTimeout(zoomTree.t);
    if (on) zoomTree.t = setTimeout(() => baum.classList.add('ringed'), reduced ? 0 : 2100);
    else baum.classList.remove('ringed');
  }
  if (baum) baum.querySelector('.clip').addEventListener('click', () => zoomTree(!baum.classList.contains('zoomed')));

  // ---------- frames come alive once, when the page rests on them ----------
  const ACT = {
    f3: () => fly(),
    f6: () => setTimeout(() => zoomTree(true), reduced ? 0 : 500),
    f7: () => vol.rise(),
  };
  const done = new Set();
  let actTimer = 0;
  function activate(sec) {
    if (!sec || done.has(sec)) return;
    done.add(sec);
    sec.classList.add('on');
    if (ACT[sec.id]) ACT[sec.id]();
  }
  // the flowing page (phones): the reading frame starts as soon as a quarter of the templates is in
  // view, while the page still moves, so the values travel while the reader arrives
  const lesenM = $('.plan-lesen-m .schab');
  if (lesenM && window.IntersectionObserver) {
    const early = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && flow) { activate($('#f3')); early.disconnect(); } }), { threshold: .25 });
    early.observe(lesenM);
  }
  // the page has come to rest when no scroll event arrives for a moment and no snap is under way
  function queueActivate() {
    clearTimeout(actTimer);
    actTimer = setTimeout(() => { if (target == null && here) activate(here.sec); }, reduced ? 0 : 260);
  }

  // ---------- f) the volume: the four Baufenster on the plan, at their permitted height ----------
  const vol = (() => {
    const fig = $('#vol');
    const api = { rise() {}, };
    if (!fig) return api;
    const cv = $('.vol-c', fig), labs = $('.vol-labels', fig);
    let T = null, st = null, wantRise = false, visible = false, loading = null;
    const css = n => getComputedStyle(body).getPropertyValue(n).trim();
    function load() {
      if (loading) return loading;
      loading = import(new URL('vendor/three.module.min.js', SCRIPT).href).then(mod => { T = mod; build(); if (wantRise) api.rise(); }).catch(err => { console.warn('volume not available', err); });
      return loading;
    }
    function groundTexture(img) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      x.filter = dark ? 'grayscale(1) invert(1) brightness(.72) contrast(1.1)' : 'grayscale(1) contrast(1.05)';
      x.drawImage(img, 0, 0);
      x.filter = 'none';
      // soft edge: the plan fades into the page around the four Baufenster
      x.globalCompositeOperation = 'destination-in';
      const g = x.createRadialGradient(c.width * .54, c.height * .48, c.height * .18, c.width * .54, c.height * .48, c.height * .62);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
      return t;
    }
    function build() {
      const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(30, 1, 1, 4000);
      const m = M_PER_PT;
      // the ground: the plan sheet from 20/330 to 1570/1460 pt
      const G = [20, 330, 1570, 1460];
      const groundMat = new T.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const ground = new T.Mesh(new T.PlaneGeometry((G[2] - G[0]) * m, (G[3] - G[1]) * m), groundMat);
      ground.rotation.x = -Math.PI / 2; ground.position.set((G[0] + G[2]) / 2 * m, 0, (G[1] + G[3]) / 2 * m);
      scene.add(ground);
      const img = new Image(); img.decoding = 'async';
      img.onload = () => { groundMat.map = groundTexture(img); groundMat.needsUpdate = true; draw(); };
      img.src = new URL('img/grund.webp', location.href).href;
      const hemi = new T.HemisphereLight(0xffffff, 0x8a8478, 1.7); scene.add(hemi);
      const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(-120, 220, 90); scene.add(sun);
      const faceMat = new T.MeshLambertMaterial({ color: 0xf7f5ef });
      const edgeMat = new T.LineBasicMaterial({ color: 0x15130e });
      const vols = [];
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      BAUFENSTER.forEach((b, i) => {
        const shape = new T.Shape(b.pts.map(([x, y]) => new T.Vector2(x * m, -y * m)));
        const geom = new T.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false }); geom.rotateX(-Math.PI / 2);
        const g = new T.Group(); g.add(new T.Mesh(geom, faceMat)); g.add(new T.LineSegments(new T.EdgesGeometry(geom, 20), edgeMat));
        g.scale.y = 0.001; scene.add(g);
        const cx = b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length * m, cz = b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length * m;
        b.pts.forEach(([x, y]) => { minX = Math.min(minX, x * m); maxX = Math.max(maxX, x * m); minZ = Math.min(minZ, y * m); maxZ = Math.max(maxZ, y * m); });
        const lab = document.createElement('span'); lab.className = 'vol-lab';
        lab.innerHTML = `<small>${b.id}</small>${b.h.toLocaleString('de-DE', { minimumFractionDigits: 1 })} m`;
        labs.appendChild(lab);
        vols.push({ g, h: b.h, pos: new T.Vector3(cx, b.h, cz), lab, i, t0: 0 });
      });
      const center = new T.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2), extent = Math.hypot(maxX - minX, maxZ - minZ);
      st = { renderer, scene, camera, vols, center, extent, faceMat, edgeMat, groundMat, img, az: -0.5, el: 0.68, drag: null, last: 0, raf: 0, risen: false };
      colors(); size();
      draw();
    }
    function colors() {
      if (!st) return;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      st.faceMat.color.set(dark ? 0x2a2720 : 0xf7f5ef);
      st.edgeMat.color.set(dark ? 0xf1efe8 : 0x15130e);
      if (st.img.complete && st.img.naturalWidth) { st.groundMat.map = groundTexture(st.img); st.groundMat.needsUpdate = true; }
    }
    function size() {
      if (!st) return;
      const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return;
      st.renderer.setSize(r.width, r.height, false);
      st.camera.aspect = r.width / r.height; st.camera.updateProjectionMatrix();
      // distance so that the four volumes fill the width of the figure
      const fovH = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(st.camera.fov / 2)) * st.camera.aspect);
      const fovV = T.MathUtils.degToRad(st.camera.fov);
      st.dist = Math.max(st.extent * .5 / Math.tan(fovH / 2), st.extent * .3 / Math.tan(fovV / 2)) * 1.08;
      draw();
    }
    const spring = p => p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(8.5 * p);
    function draw(now = performance.now()) {
      if (!st) return;
      const { camera, center, vols } = st;
      const dt = st.last ? Math.min(.05, (now - st.last) / 1000) : 0; st.last = now;
      if (!st.drag && visible && !reduced && st.risen) st.az += dt * .045;
      const d = st.dist;
      camera.position.set(center.x + Math.sin(st.az) * Math.cos(st.el) * d, Math.sin(st.el) * d, center.z + Math.cos(st.az) * Math.cos(st.el) * d);
      camera.lookAt(center); camera.updateMatrixWorld();
      let moving = false;
      vols.forEach(v => {
        if (v.t0) { const p = reduced ? 1 : (now - v.t0) / 1300; v.g.scale.y = Math.max(.001, spring(p)); if (p < 1) moving = true; }
      });
      st.renderer.render(st.scene, camera);
      const r = cv.getBoundingClientRect();
      vols.forEach(v => {
        const p = v.pos.clone(); p.y = v.h * v.g.scale.y + 1.5; p.project(camera);
        v.lab.style.left = ((p.x + 1) / 2 * r.width) + 'px'; v.lab.style.top = ((1 - p.y) / 2 * r.height - 6) + 'px';
      });
      cancelAnimationFrame(st.raf);
      if (visible && (moving || (!reduced && st.risen) || st.drag)) st.raf = requestAnimationFrame(draw); else st.last = 0;
    }
    api.rise = () => {
      wantRise = true;
      if (!st) { load(); return; }
      if (st.risen) return;
      const now = performance.now();
      st.vols.forEach((v, i) => { v.t0 = now + (reduced ? 0 : i * 180); });
      st.risen = true;
      setTimeout(() => fig.classList.add('risen'), reduced ? 0 : 1300);
      draw();
    };
    // load the library while the visitor approaches the frame; draw only while it is in view
    const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { load(); near.disconnect(); } }), { rootMargin: '150% 0px' });
    near.observe(fig);
    new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) draw(); })).observe(fig);
    if (window.ResizeObserver) new ResizeObserver(() => size()).observe(cv);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors(); draw(); });
    // drag to turn: a mouse turns freely, a finger turns sideways and leaves the vertical to the page
    cv.addEventListener('pointerdown', e => { if (!st) return; st.drag = { x: e.clientX, y: e.clientY, az: st.az, el: st.el, id: e.pointerId, touch: e.pointerType === 'touch' }; if (!st.drag.touch) cv.setPointerCapture(e.pointerId); draw(); });
    cv.addEventListener('pointermove', e => {
      if (!st || !st.drag || st.drag.id !== e.pointerId) return;
      st.az = st.drag.az - (e.clientX - st.drag.x) * .006;
      if (!st.drag.touch) st.el = clamp(st.drag.el + (e.clientY - st.drag.y) * .004, .22, 1.25);
      draw();
    });
    const end = e => { if (st && st.drag && st.drag.id === e.pointerId) { st.drag = null; draw(); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    return api;
  })();
  // While the page moves freely (touch, keyboard focus, find in page), the unit whose stop is nearest
  // leads. Two guards keep every frame calm: a band of hysteresis, so a figure never flips back and
  // forth between two stops, and a short settle time, so a fast flick across several units starts
  // one transition at the end instead of one per unit passed. A snap leads its target at once.
  const BAND = 0.06, SETTLE = 120;
  let pending = null, pendingAt = 0, settleTimer = 0, target = null;
  // In the flowing page a figure leads while at least half of its field is on screen (the one
  // closest to the middle, if two are); otherwise the unit under the middle of the screen leads.
  function flowScore(u) {
    const y = scrollPos(), top = y + G.bar, bot = y + G.H, mid = (top + bot) / 2;
    if (u.field) {
      const r = u.field.getBoundingClientRect(), a = r.top + y, b = r.bottom + y;
      if (Math.min(b, bot) - Math.max(a, top) >= Math.min(b - a, bot - top) * .5) return -G.H + Math.abs((a + b) / 2 - mid) / 4;
    }
    return mid < u.top ? u.top - mid : mid > u.bottom ? mid - u.bottom : 0;
  }
  function flowCandidate() {
    let best = null, bs = Infinity;
    for (const u of units) { const s = flowScore(u); if (s < bs) { bs = s; best = u; } }
    return here && here !== best && units.indexOf(here) >= 0 && flowScore(here) < bs + G.H * BAND ? here : best;
  }
  function candidate() {
    if (!units.length) return null;
    if (flow) return flowCandidate();
    const y = scrollPos(), u = units[nearest(y)];
    if (!here || u === here || units.indexOf(here) < 0) return u;
    return Math.abs(u.y - y) + G.H * BAND < Math.abs(here.y - y) ? u : here;
  }
  function pick() {
    bar.classList.toggle('scrolled', scrollPos() > 8);
    pf.S.scrollY = scrollPos();
    choose();
    queueActivate();
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
      if (flow || e.ctrlKey || e.defaultPrevented) return; // flowing page, pinch zoom, anything that handles its own wheel
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
    // the flowing page scrolls natively; scroll-margin-top (css/ki.css) sets the heading below the header
    if (flow) { pending = null; el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); return; }
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
      if (keep && innerWidth !== lastW && !flow) {
        const i = units.findIndex(u => u.sec === keep.sec && u.host === keep.host);
        if (i >= 0) scrollTo({ top: units[i].y, behavior: 'instant' });
      }
      lastW = innerWidth;
      here = null; pick();
    }, 150);
  });
  layoutUnits(); pick();
  // turning a phone can cross between the flowing page and the frames
  const onFlow = () => { flow = flowMQ.matches; root.classList.toggle('snap', !flow); layoutUnits(); here = null; pick(); };
  if (flowMQ.addEventListener) flowMQ.addEventListener('change', onFlow); else if (flowMQ.addListener) flowMQ.addListener(onFlow);
  // web fonts change line breaks: measure again once they are in
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layoutUnits(); pick(); });
  addEventListener('load', () => { layoutUnits(); pick(); });
  if (params.has('still')) pf.settle(60);
  if (params.has('debug')) window.__ki = { get units() { fresh(); return units; }, G, layoutUnits, go, step, get target() { return target; }, anchors, get leader() { return leader && (leader.id || leader.className); } };

  // ---------- the pointer: one rule for every point of the page ----------
  // A mouse or a pen moves the pointer, and every point near it yields and springs back: the stars,
  // every figure and the point type (js/punkte.js, js/punkttype.js). A finger
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

  // on arrival the curtain lifts while the stars settle
  requestAnimationFrame(() => body.classList.add('ready'));
})();
