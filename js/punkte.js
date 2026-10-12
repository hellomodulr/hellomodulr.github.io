// Point matter: one field of square points that re-forms into figures, floats in real 3D,
// evades the pointer and springs back.
// Language taken from the elective presentation "KI in der Architektur": square points,
// damped springs, depth layers, one accent only for what is decided.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const DIFF = 2.4; // seconds over which released points drift apart (option `diffuse`)
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // seeded random, so every visitor sees the same figures
  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ---------- figure builders (local coordinates, origin at the centre of the box, px) ----------
  const F = {};

  // dotted straight line
  F.line = (a, b, step, extra) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)), n = Math.max(1, Math.round(L / step)), out = [];
    for (let k = 0; k <= n; k++) { const t = k / n; out.push({ x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), z: lerp(a[2] || 0, b[2] || 0, t), ...extra }); }
    return out;
  };
  F.ring = (cx, cy, r, step, z = 0, extra) => {
    const n = Math.max(8, Math.round(TAU * r / step)), out = [];
    for (let k = 0; k < n; k++) out.push({ x: cx + Math.cos(k / n * TAU) * r, y: cy + Math.sin(k / n * TAU) * r, z, ...extra });
    return out;
  };
  // axonometric block: front face, top face and right side, rows from the base upwards
  F.box = (x, y, w, h, dp, step, extra) => {
    const OBX = .5, OBY = .32, base = y + h, out = [];
    for (let yy = base; yy >= y - .01; yy -= step) for (let xx = x; xx <= x + w + .01; xx += step) out.push({ x: xx, y: yy, z: 0, ...extra });
    const topY = base - Math.floor(h / step + .01) * step;
    for (let dd = step; dd < dp; dd += step) {
      for (let xx = x; xx <= x + w + .01; xx += step) out.push({ x: xx + dd * OBX, y: topY - dd * OBY, z: 0, ...extra });
      for (let yy = base; yy >= topY; yy -= step) out.push({ x: x + w + dd * OBX, y: yy - dd * OBY, z: 0, ...extra });
    }
    return out;
  };

  // Achsraster: a planning grid of axes with irregular bays, axis bubbles at the ends,
  // drawn on the ground plane (x, y) and seen from above at an angle via the camera pitch.
  // Some points hover above the plane as loose stars and settle into the axes over time.
  F.raster = (w, h, o = {}) => {
    const R = rng(o.seed || 11), out = [];
    const bx = o.bays || [5, 7.5, 5, 7.5, 5], by = o.baysY || [6, 4.5, 6, 4.5];
    const sx = bx.reduce((a, b) => a + b, 0), sy = by.reduce((a, b) => a + b, 0);
    const k = Math.min(w * (o.fit || .82) / sx, h * (o.fit || .82) / (sy * (o.squash || 1))), step = o.step || 3.6;
    const X = [0], Y = [0]; bx.forEach(b => X.push(X[X.length - 1] + b * k)); by.forEach(b => Y.push(Y[Y.length - 1] + b * k));
    const ox = -X[X.length - 1] / 2, oy = -Y[Y.length - 1] / 2, over = 3.2 * k, br = Math.max(7, .9 * k);
    const hover = o.hover == null ? .45 : o.hover;
    // `hzk` scales how high the loose points hover, so a small box keeps them inside
    const hzk = o.hzk || 1;
    const add = (p, axis) => { const up = R() < hover; out.push({ ...p, z: 0, hz: up ? (60 + R() * 420) * hzk : 0, ph: R(), axis }); };
    // lines along y are foreshortened by the camera pitch: wider dot spacing there keeps the
    // projected dots apart, so the axes read as dotted lines and never beat into a moire
    const stepY = step * (o.stepYk || 1.6);
    X.forEach((x, i) => {
      F.line([ox + x, oy - over + br], [ox + x, oy + Y[Y.length - 1] + over - br], stepY).forEach(p => add(p, 'x' + i));
      F.ring(ox + x, oy - over, br, step * .8).forEach(p => add(p, 'bx' + i));
    });
    Y.forEach((y, j) => {
      F.line([ox - over + br, oy + y], [ox + X[X.length - 1] + over - br, oy + y], step).forEach(p => add(p, 'y' + j));
      F.ring(ox - over, oy + y, br, step * .8).forEach(p => add(p, 'by' + j));
    });
    // each bay carries a faint paper grid, so the order reads as a field and not as wire
    if (o.fill !== 0) {
      const fs = o.fill || Math.max(9, k * .9);
      for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Y.length - 1; j++) {
        for (let x = X[i] + fs; x < X[i + 1] - fs * .5; x += fs) for (let y = Y[j] + fs; y < Y[j + 1] - fs * .5; y += fs) {
          const up = R() < hover * .6;
          out.push({ x: ox + x, y: oy + y, z: 0, dim: 1, hz: up ? (80 + R() * 380) * hzk : 0, ph: R() });
        }
      }
    }
    // the one decided point: a small cross on one intersection
    if (o.mark) {
      const [i, j] = o.mark, cx = ox + X[i], cy = oy + Y[j], s = 3.8;
      for (let d = -3; d <= 3; d++) { out.push({ x: cx + d * s, y: cy, z: 0, acc: 1, hz: 0, ph: 0 }); if (d) out.push({ x: cx, y: cy + d * s, z: 0, acc: 1, hz: 0, ph: 0 }); }
    }
    out.meta = { X: X.map(x => ox + x), Y: Y.map(y => oy + y), k };
    return out;
  };

  // knowledge in few heads: three dense clusters, a thin cloud drifting towards them
  F.koepfe = (w, h, o = {}) => {
    const R = rng(o.seed || 23), out = [], r = Math.min(w, h) * .13;
    const C = [[-.27, -.12, 0], [.18, -.26, 60], [.06, .22, -40]].map(([u, v, z]) => [u * w, v * h, z]);
    C.forEach(([cx, cy, cz], ci) => {
      for (let k = 0; k < (o.n || 520); k++) {
        const u = R() * 2 - 1, th = R() * TAU, rr = r * Math.cbrt(R()), q = Math.sqrt(1 - u * u);
        // `acc` (KI page): the heads are where the knowledge sits and where it is decided, in rust
        out.push({ x: cx + Math.cos(th) * q * rr, y: cy + u * rr, z: cz + Math.sin(th) * q * rr, c: ci, acc: o.acc ? 1 : 0, r: o.r });
      }
    });
    for (let k = 0; k < (o.cloud || 700); k++) out.push({ x: (R() - .5) * w * 1.05, y: (R() - .5) * h * 1.05, z: (R() - .5) * 300, flow: R(), c: (R() * 3) | 0 });
    out.meta = { C };
    return out;
  };

  // four blocks rising as stairs, the last one is the goal
  // `rows` (phones, one column): a flat strip above each of the four steps, growing from left to
  // right, so every step and its text share one place; the values are the local top of each strip
  F.treppe = (w, h, o = {}) => {
    const n = o.n || 4, step = o.step || 7.5, out = [];
    if (o.rows) {
      const bh = o.band || 12, dp = o.depth || 14;
      o.rows.forEach((y, i) => {
        const bw = Math.max(step * 3, (w - dp * .5 - 2) * (i + 1) / n);
        F.box(-w / 2 + 1, y, bw, bh, dp, step, { acc: i === n - 1 ? 1 : 0, g: i }).forEach(p => out.push(p));
      });
      return out;
    }
    const gap = o.gap == null ? w * .04 : o.gap, colW = (w - gap * (n - 1)) / n;
    const bw = colW * .78, dp = colW * .3, base = h / 2 - 4;
    for (let i = 0; i < n; i++) {
      const hh = h * (.16 + i * .2), x = -w / 2 + i * (colW + gap);
      F.box(x, base - hh, bw, hh, dp, step, { acc: i === n - 1 ? 1 : 0, g: i }).forEach(p => out.push(p));
    }
    return out;
  };

  // hours of information work: the returned half leads in rust, flush left above its number; the
  // whole stands beside it in ink. Width grows with the team, height with the hours; both blocks
  // stand on the lower edge of the box, so the numbers below read as their labels.
  F.stunden = (w, h, o = {}) => {
    const P = o.people || 8, H = o.hours || 18, out = [];
    const step = o.step || Math.max(5, Math.min(7.5, w / 70));
    const dp0 = Math.min(w * .1, h * .16), maxCols = Math.floor((w * .44 - dp0 * .5) / step), maxRows = Math.floor((h - dp0 * .34 - 4) / step);
    const cols = Math.max(4, Math.round(lerp(maxCols * .3, maxCols, Math.sqrt((P - 1) / 99))));
    const rows = Math.max(4, Math.round(maxRows * Math.pow(H / 35, .6))), half = Math.max(2, Math.round(rows / 2));
    const bw = (cols - 1) * step, dp = Math.min(dp0, bw * .5), base = h / 2 - 2;
    const x0 = -w / 2 + 1;
    F.box(x0, base - (half - 1) * step, bw, (half - 1) * step, dp, step, { acc: 1 }).forEach(p => out.push(p));
    const x1 = x0 + bw + dp * .5 + Math.max(28, w * .07);
    F.box(x1, base - (rows - 1) * step, bw, (rows - 1) * step, dp, step).forEach(p => out.push(p));
    out.meta = { x0, bw };
    return out;
  };

  // ---------- the close ----------
  // Gespräch: two heads face each other (the few heads of the beginning, now two), and between them
  // the exchange runs as a loop: over the top from one head to the other, below it back again
  F.gespraech = (w, h, o = {}) => {
    const R = rng(o.seed || 61), out = [], r = Math.min(w * .17, h * .24);
    const C = [[-w * .31, 0, 0], [w * .31, 0, 0]];
    C.forEach(([cx, cy, cz]) => {
      for (let k = 0; k < (o.n || 480); k++) {
        const u = R() * 2 - 1, th = R() * TAU, rr = r * Math.cbrt(R()), q = Math.sqrt(1 - u * u);
        out.push({ x: cx + Math.cos(th) * q * rr, y: cy + u * rr, z: cz + Math.sin(th) * q * rr });
      }
    });
    const per = o.per || 90;
    for (let row = 0; row < 2; row++) for (let k = 0; k < per; k++) out.push({ x: 0, y: 0, z: 0, talk: row, u: k / per, ph: R() });
    out.meta = { xa: C[0][0] + r * .55, xb: C[1][0] - r * .55, amp: Math.min(h * .16, r * .9) };
    return out;
  };
  function gespraechFlow(form) {
    const m = form.meta, span = m.xb - m.xa;
    return t => {
      for (const q of form) {
        if (q.talk == null) continue;
        const u = ((q.u + t * .045) % 1 + 1) % 1, s = q.talk ? 1 - u : u;
        q.x = m.xa + s * span + (q.ph - .5) * 3; q.y = (q.talk ? 1 : -1) * Math.sin(Math.PI * s) * m.amp + (q.ph - .5) * 3; q.z = 0;
        q.vis = Math.min(1, u / .1, (1 - u) / .1);
      }
    };
  }
  // ---------- the streams: one person steers, many tasks run in order ----------
  // Ströme: loose single tasks drift in from the left, line up into three ordered streams, and
  // one rust point above the point where order begins holds the reins of all three.
  F.stroeme = (w, h, o = {}) => {
    const R = rng(o.seed || 41), out = [], lanes = o.lanes || 3, per = o.per || 70;
    const x0 = -w * .48, x1 = w * .47, xm = -w * .06, gap = h * .2;
    const ys = Array.from({ length: lanes }, (_, i) => (i - (lanes - 1) / 2) * gap + h * .1);
    const ry = -h * .4, step = o.step || 4.2;
    // the decided point: a solid square of rust, `mark` points on a side at `markS` px
    const mn = o.mark || 3, ms = o.markS || 2.6, mh = (mn - 1) / 2;
    for (let i = -mh; i <= mh; i++) for (let j = -mh; j <= mh; j++) out.push({ x: xm + i * ms, y: ry + j * ms, z: 0, acc: 1 });
    // the line where order begins hangs from the decided point and crosses all three streams
    F.line([xm, ry + mh * ms + 5.4], [xm, ys[lanes - 1] + 14], step * 1.5).forEach(p => out.push({ ...p, dim: 1 }));
    // streams: two rows each; a point runs along u, loose before xm and ordered after it
    ys.forEach((y, li) => {
      for (let row = 0; row < 2; row++) for (let k = 0; k < per; k++) {
        out.push({ x: 0, y: 0, z: 0, lane: li, row, u: k / per, sy: (R() - .5) * h * .95, sz: (R() - .5) * 220, ph: R() });
      }
    });
    out.meta = { x0, x1, xm, ys };
    return out;
  };
  function stroemeFlow(form) {
    const m = form.meta, span = m.x1 - m.x0, um = (m.xm - m.x0) / span;
    return t => {
      for (const q of form) {
        if (q.lane == null) continue;
        const u = ((q.u + t * .028) % 1 + 1) % 1;
        const x = m.x0 + u * span, k = clamp(u / um), e = k * k * (3 - 2 * k);
        const ly = m.ys[q.lane] + (q.row ? 4.5 : -4.5);
        // loose: wandering a little; ordered: on the line
        const wob = (1 - e) * Math.sin(t * .7 + q.ph * 20) * 10;
        q.x = x; q.y = lerp(q.sy + wob, ly, e); q.z = q.sz * (1 - e);
        q.vis = Math.min(1, u / .06, (1 - u) / .05);
      }
    };
  }
  // ---------- the pointer rule of the KI page (option `uniform`) ----------
  // One rule for every point of the page: stars, figure points, the rolling word and the point type
  // (js/punkttype.js) all yield to the pointer with the same damped spring, in screen space, within
  // the same radius. Rust points are decided: they keep their place better and show half of the
  // offset (EV.ACC), the same factor wherever they are. The spring is integrated in steps of 1/60 s,
  // so a 120 Hz screen moves the points exactly as a 60 Hz screen does. The camera does not tilt
  // with the pointer. Reduced motion: nothing yields.
  const EV = { F: 6, K: 1.6, D: .8, ACC: .5 };
  const evRadius = () => (Math.min(innerWidth, innerHeight) < 600 ? 70 : 110);
  // the pointer in client pixels, shared by the field and the point type
  const PTR = { x: -1e4, y: -1e4, on: false };
  // one step for one point q { ox, oy, ovx, ovy, k }: X, Y is where it stands without the pointer,
  // s the length of the step in 1/60 s; returns whether the point is still moving
  function evade(q, X, Y, s, RR, mx, my, on) {
    let fx = 0, fy = 0;
    if (on) {
      const vx = X + q.ox - mx, vy = Y + q.oy - my, d2 = vx * vx + vy * vy;
      if (d2 < RR * RR) { const dd = Math.sqrt(d2) || 1, f = 1 - dd / RR, ff = f * f * EV.F; fx = vx / dd * ff; fy = vy / dd * ff; }
    }
    const damp = Math.pow(EV.D, s);
    q.ovx = (q.ovx + (fx - q.ox * q.k * EV.K) * s) * damp; q.ovy = (q.ovy + (fy - q.oy * q.k * EV.K) * s) * damp;
    q.ox += q.ovx * s; q.oy += q.ovy * s;
    if (!fx && !fy && Math.abs(q.ox) + Math.abs(q.oy) + Math.abs(q.ovx) + Math.abs(q.ovy) < .02) { q.ox = q.oy = q.ovx = q.ovy = 0; return false; }
    return true;
  }

  // ---------- the field ----------
  // Motion model:
  // 1. A point is either a star (free, screen space) or a figure point (box space, projected).
  // 2. Every change of role is a timed, eased path without overshoot. Springs only carry the
  //    small pointer offset, so nothing can swing past its target.
  // 3. When a figure changes, the points closest to the new box are chosen, and old and new
  //    positions are paired by a monotone quantile mapping (columns, then rows). Neighbours stay
  //    neighbours, so paths never cross through each other.
  // 4. Points that are no longer needed dissolve where they are: they keep the speed of the page
  //    for a moment, spread a little, and fade to the brightness of a star.
  // 5. Colours and alpha follow the colour scheme of the operating system, live.
  // 6. Several figures can live at the same time, each on its own layer: the main layer is the 3D
  //    figure of the section, further layers are flat and screen aligned (the rolling word of the
  //    KI title). A point belongs to one layer at a time; layers never take points from each other.
  // 7. A screen layer (option `screen`, not used on this page) gets its targets in screen pixels
  //    from the page, every frame, as a pure function of the scroll position. Its targets can be gated: a target that is
  //    switched off lets its point sink into the drawing (it fades on its target) and the point
  //    returns to the field as a star somewhere in the drawing area, fading in. Switched on again,
  //    the point travels from wherever it is as a star to its target on a timed, eased path.
  const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeO2 = t => 1 - (1 - t) * (1 - t);
  const mod = (a, n) => ((a % n) + n) % n;

  // brightness per colour scheme: fine graphite on paper, stars at night
  const THEME = {
    dark: { star: .22, starB: .5, far: .42, near: .95, dim: .4, acc: 1, sz: 1, low: 1 },
    light: { star: .2, starB: .36, far: .34, near: .82, dim: .28, acc: 1, sz: .9, low: .7 },
  };

  // pair sources with targets so that relative positions are kept (both arrays of {x, y, i})
  function pairMonotone(src, dst) {
    const M = Math.min(src.length, dst.length), out = new Array(M);
    if (!M) return out;
    const K = Math.max(1, Math.round(Math.sqrt(M))), per = M / K;
    src.sort((a, b) => a.x - b.x); dst.sort((a, b) => a.x - b.x);
    for (let k = 0; k < K; k++) {
      const a = Math.round(k * per), b = Math.round((k + 1) * per);
      const S1 = src.slice(a, b).sort((u, v) => u.y - v.y), D1 = dst.slice(a, b).sort((u, v) => u.y - v.y);
      for (let j = 0; j < S1.length; j++) out[a + j] = [S1[j].i, D1[j].i];
    }
    return out;
  }

  function create(canvas, opt = {}) {
    const ctx = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || !!opt.still;
    const uni = !!opt.uniform; // the pointer rule of the KI page
    const mqDark = matchMedia('(prefers-color-scheme: dark)');
    const small = Math.min(innerWidth, innerHeight) < 600;
    const N = opt.count || (small ? 1700 : 3400);
    const R = rng(opt.seed || 7);
    const P = [];
    for (let i = 0; i < N; i++) {
      P.push({
        a: R(), b: R(), c: R(), k: .022 + R() * .024, hz: R(),
        m: 0, n: null,            // role: 0 star, 1 figure; n is the figure target
        bx: 0, by: 0, vx: 0, vy: 0, // star: base position and drift velocity (px/s)
        tr: 0, t0: 0, dur: 1, cap: 0, fx: 0, fy: 0, f0: 0, amp: 0, // timed transition
        look: 0,                  // 0 looks like a star, 1 like a figure point
        ox: 0, oy: 0, ovx: 0, ovy: 0, dox: 0, doy: 0, kf: 1, // pointer offset, and as drawn
        sx: 0, sy: 0, ss: 1, acc: 0, dim: 0, L: 'main',
        park: 0, fa: 1, out: 0, sa: 1, // screen layers: parked as a star, figure alpha, leaving, star alpha
      });
    }
    const S = { W: 0, H: 0, WH: 0, dpr: 1, box: null, boxEl: null, form: [], dyn: null, cam: { yaw: 0, pitch: 0, float: 1 }, camT: { yaw: 0, pitch: 0, float: 1 },
      mx: -1e4, my: -1e4, mOn: false, running: true, t0: performance.now(), visible: true, fade: 1, zoom: 1, scrollY: 0, scrollV: 0,
      stars: opt.stars == null ? 1 : opt.stars, lowA: 1, lowCut: opt.lowCut || .4, tiltX: 0, tiltY: 0, first: true, layers: {} };
    let col = { ink: '241,239,232', acc: '222,123,89', a: 1 }, A = THEME.dark;

    // colours come from css custom properties, which follow prefers-color-scheme
    function readTheme() {
      const cs = getComputedStyle(document.documentElement);
      const ink = cs.getPropertyValue('--net-b').trim(), acc = cs.getPropertyValue('--net-c').trim();
      const dark = cs.getPropertyValue('--net-mode').trim() ? cs.getPropertyValue('--net-mode').trim() === 'dark' : mqDark.matches;
      if (ink) col.ink = ink; if (acc) col.acc = acc;
      A = dark ? THEME.dark : THEME.light;
    }
    readTheme();
    const onScheme = () => { readTheme(); draw(performance.now()); if (S.redraw) S.redraw(); };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onScheme); else if (mqDark.addListener) mqDark.addListener(onScheme);
    const setColors = c => { col = { ...col, ...c }; if (reduced) draw(performance.now()); };

    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (Math.abs(r.width - S.W) < .5 && Math.abs(r.height - S.H) < .5 && dpr === S.dpr) return false;
      const sxr = S.W ? r.width / S.W : 1;
      if (S.W) for (const p of P) { p.bx *= sxr; if (p.m === 0) p.sx *= sxr; }
      S.dpr = dpr; S.W = r.width; S.H = r.height;
      // stars wrap on the largest height seen, so a shrinking viewport never makes them jump
      S.WH = Math.max(S.WH, S.H + 400);
      canvas.width = Math.round(S.W * S.dpr); canvas.height = Math.round(S.H * S.dpr);
      return true;
    }
    // the box the figure lives in, in canvas coordinates
    function boxRect() {
      if (S.boxEl) {
        const r = S.boxEl.getBoundingClientRect(), c = canvas.getBoundingClientRect();
        return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
      }
      return S.box || { x: 0, y: 0, w: S.W, h: S.H };
    }
    let B = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
    function rectOf(el, box) {
      if (el) { const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect(); return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }; }
      return box || { x: 0, y: 0, w: S.W, h: S.H };
    }
    function updBox() {
      const r = boxRect(); B = { ...r, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
      for (const k in S.layers) { const L = S.layers[k], q = rectOf(L.el, L.box); L.B = { ...q, cx: q.x + q.w / 2, cy: q.y + q.h / 2 }; }
    }

    // camera: yaw and pitch around the centre of the box, calm float, pointer tilt
    let cyw = 1, syw = 0, cp = 1, sp = 0;
    const FOC = 1500;
    function setCam(t, dt) {
      const c = S.cam, T = S.camT, k = 1 - Math.pow(1 - .04, dt * 60);
      for (const key in T) c[key] = reduced ? T[key] : lerp(c[key], T[key], k);
      const fl = reduced ? 0 : c.float;
      let yaw = c.yaw + Math.sin(t * .11) * .16 * fl, pitch = c.pitch + Math.sin(t * .083 + 1) * .06 * fl;
      // the pointer tilts the camera; the tilt is eased, so a pointer entering or leaving the
      // window never makes the whole figure jump
      const on = S.mOn && !reduced && !uni, kt = 1 - Math.exp(-dt * 3);
      S.tiltX = lerp(S.tiltX, on ? ((S.mx - B.cx) / Math.max(1, S.W)) * .22 : 0, kt);
      S.tiltY = lerp(S.tiltY, on ? ((S.my - B.cy) / Math.max(1, S.H)) * -.12 : 0, kt);
      yaw += S.tiltX * fl; pitch += S.tiltY * fl;
      cyw = Math.cos(yaw); syw = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
    }
    const out = { x: 0, y: 0, s: 1 };
    function project(x, y, z) {
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const s = FOC / (FOC - z2 * S.zoom);
      out.x = B.cx + x1 * s * S.zoom; out.y = B.cy + y2 * s * S.zoom; out.s = s; return out;
    }

    // star position from its base, a slow wobble and the scroll parallax
    const tNow = () => (performance.now() - S.t0) / 1000;
    const par = () => S.scrollY * .06;
    function starX(p, t) { return mod(p.bx + (reduced ? 0 : Math.sin(t * .05 + p.c * 20) * 40) + 40, S.W + 80) - 40; }
    function starY(p, t) { return mod(p.by - par() * (.3 + p.hz), S.WH) - 100 + (reduced ? 0 : Math.cos(t * .045 + p.a * 20) * 30); }
    // turn a point into a star exactly where it is now
    function releaseAt(p, X, Y, t, cx, cy, drift) {
      // left the screen: wait out of sight, spread over the band below the screen, so these points
      // come back one by one with the parallax and never as a row
      if (Y < -60 || Y > S.H + 60 || X < -30 || X > S.W + 30) { Y = S.H + 20 + p.a * (S.WH - S.H - 140); X = p.b * S.W; p.look = 0; }
      const wx = reduced ? 0 : Math.sin(t * .05 + p.c * 20) * 40, wy = reduced ? 0 : Math.cos(t * .045 + p.a * 20) * 30;
      p.bx = X - wx; p.by = Y - wy + 100 + par() * (.3 + p.hz);
      // keep the speed of the page for a moment and spread away from the figure
      const dx = X - cx, dy = Y - cy, d = Math.hypot(dx, dy) || 1, sp0 = 30 + p.b * 70;
      p.vx = reduced ? 0 : dx / d * sp0; p.vy = reduced ? 0 : dy / d * sp0 - clamp(S.scrollV, -500, 500) * .8;
      // `diffuse` (KI page): the released points also drift apart slowly over a few seconds, so a
      // dissolved figure becomes an even sky again and never stays behind as a clump of stars
      // (reduced motion: the points take their spread place at once)
      if (opt.diffuse) {
        const an = Math.atan2(dy, dx) + (p.c - .5) * 1.8, d1 = 150 + p.b * 270;
        if (reduced) { p.bx += Math.cos(an) * d1; p.by += Math.sin(an) * d1; }
        else { p.wx = Math.cos(an) * d1 / DIFF; p.wy = Math.sin(an) * d1 / DIFF; }
      }
      // a layer can give its released points a direction of their own (the word drifts upwards)
      if (drift && !reduced) { p.vx += (drift.vx || 0) * (.6 + p.a * .8) + (p.b - .5) * (drift.spread || 0); p.vy += (drift.vy || 0) * (.6 + p.b * .8) + (p.a - .5) * (drift.spread || 0); }
    }

    // ---------- figures ----------
    // a flat layer, for example the rolling word: its figure is screen aligned in the box of `el`
    function setLayer(name, form, o = {}) {
      const L = S.layers[name] || (S.layers[name] = { name, el: null, box: null, form: [], dyn: null, B: { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 }, screen: false, gate: false, pk: null });
      if (o.el !== undefined) L.el = o.el;
      if (o.box !== undefined) L.box = o.box;
      if (o.screen !== undefined) L.screen = !!o.screen;
      if (o.gate !== undefined) L.gate = !!o.gate;
      return setForm(form, o, name);
    }
    function setForm(form, o = {}, name = 'main') {
      const now = performance.now(), t = tNow(), main = name === 'main', L = main ? null : S.layers[name];
      if (main && o.el !== undefined) S.boxEl = o.el;
      if (main && o.box !== undefined) S.box = o.box;
      const prevBox = main ? { ...B } : { ...L.B };
      updBox();
      const Bx = main ? B : L.B;
      const scr = !main && L.screen;
      const FORM = form || [];
      if (main) { S.form = FORM; S.dyn = o.dyn || null; } else { L.form = FORM; L.dyn = o.dyn || null; }
      if (main && o.cam) S.camT = { yaw: 0, pitch: 0, float: 1, ...o.cam };
      if (o.dyn) o.dyn(reduced ? 1e4 : t, FORM, Bx);
      const quick = o.quick || o.stagger === 0; // same box, small change (calculator, resize)
      // choose the points closest to the new box; members of the current figure are preferred a
      // little (or not at all, `fresh`), points of other layers are never taken, except from the
      // layer named in `prefer`, which hands its points over first
      const bx0 = Bx.x, by0 = Bx.y, bx1 = Bx.x + Bx.w, by1 = Bx.y + Bx.h;
      const cost = new Float32Array(N), idx = new Array(N);
      for (let i = 0; i < N; i++) {
        const p = P[i], ddx = Math.max(bx0 - p.sx, 0, p.sx - bx1), ddy = Math.max(by0 - p.sy, 0, p.sy - by1);
        let k = p.m ? .8 : 1;
        if (p.m && p.L !== name) k = o.prefer === p.L ? .05 : Infinity;
        // a point that is still sinking into its old figure is not free yet
        if (p.out) k = Infinity;
        cost[i] = Math.hypot(ddx, ddy) * k + p.c * 20; idx[i] = i;
        if (k === Infinity) cost[i] = Infinity;
        // a fresh figure takes its own old points only if the stars run out
        else if (p.m && o.fresh && p.L === name) cost[i] = 1e9 + p.c;
      }
      idx.sort((u, v) => cost[u] - cost[v]);
      const chosen = new Uint8Array(N);
      // `keep`: points whose target is part of the new figure as well stay exactly where they are
      let todo = null;
      if (o.keep && !main) {
        const inForm = new Set(FORM), kept = new Set();
        for (let i = 0; i < N; i++) { const p = P[i]; if (p.m === 1 && p.L === name && !p.out && inForm.has(p.n) && !kept.has(p.n)) { chosen[i] = 1; kept.add(p.n); } }
        todo = []; for (let k = 0; k < FORM.length; k++) if (!kept.has(FORM[k])) todo.push(k);
      }
      // `fade` targets (small runs of points along a drawing) do not fly in: they take a resting,
      // invisible star and appear in place
      if (scr && S.lowA < .05) {
        let fk = null;
        for (let k = 0; k < FORM.length; k++) if (FORM[k].fade && (!todo || todo.includes(k))) (fk || (fk = [])).push(k);
        if (fk) {
          let j = 0;
          for (const k of fk) {
            const q = FORM[k];
            if (P.some((p, i) => chosen[i] && p.n === q)) continue;
            while (j < N && (chosen[idx[j]] || cost[idx[j]] === Infinity || P[idx[j]].m !== 0 || P[idx[j]].hz >= S.lowCut)) j++;
            if (j >= N) break;
            const p = P[idx[j]]; chosen[idx[j]] = 1;
            p.m = 1; p.n = q; p.L = name; p.tr = 0; p.look = 1; p.park = q.on === false ? 1 : 0; p.fa = 0; p.out = 0;
          }
          const fs = new Set(fk.map(k => FORM[k]));
          todo = (todo || FORM.map((_, k) => k)).filter(k => !fs.has(FORM[k]));
        }
      }
      const nTodo = todo ? todo.length : FORM.length;
      // targets on screen as the camera will see them (without float)
      const keep = { cyw, syw, cp, sp };
      const T = S.camT; cyw = Math.cos(T.yaw); syw = Math.sin(T.yaw); cp = Math.cos(T.pitch); sp = Math.sin(T.pitch);
      const src = [], dst = [];
      for (let k = 0, j = 0; k < nTodo && j < N; j++) {
        const i = idx[j]; if (cost[i] === Infinity) break;
        if (chosen[i]) continue;
        chosen[i] = 1; src.push({ x: P[i].sx, y: P[i].sy, i });
        const fk = todo ? todo[k] : k, q = FORM[fk];
        if (main) { project(q.x, q.y, (q.z || 0) + (q.hz || 0)); dst.push({ x: out.x, y: out.y, i: fk, tx: out.x, ty: out.y }); }
        else if (scr) dst.push({ x: q.x, y: q.y, i: fk, tx: q.x, ty: q.y });
        else dst.push({ x: Bx.x + q.x, y: Bx.y + q.y, i: fk, tx: Bx.x + q.x, ty: Bx.y + q.y });
        k++;
      }
      const M = dst.length;
      ({ cyw, syw, cp, sp } = keep);
      const tx = new Float32Array(FORM.length), ty = new Float32Array(FORM.length);
      for (const d of dst) { tx[d.i] = d.tx; ty[d.i] = d.ty; }
      const pairs = pairMonotone(src, dst);
      for (const [pi, k] of pairs) {
        const p = P[pi], q = FORM[k], wasFig = p.m === 1 && !p.park;
        if (wasFig && p.n === q) continue;
        // a gated target that is switched off takes its point as a reserve: the point stays (or
        // turns into) a star until the target is switched on
        if (scr && L.gate && q.on === false) {
          if (wasFig && !reduced) { releaseAt(p, p.sx, p.sy, t, Bx.cx, Bx.cy, o.drift); p.tr = 1; p.t0 = now; p.dur = 700 + p.c * 500; p.f0 = p.look; }
          else if (wasFig) { p.look = 0; p.tr = 0; }
          p.m = 1; p.n = q; p.L = name; p.park = 1; p.fa = 1; p.cap = 0;
          continue;
        }
        const dist = Math.hypot(tx[k] - p.sx, ty[k] - p.sy);
        p.m = 1; p.n = q; p.tr = 1; p.cap = 1; p.f0 = p.look; p.L = name; p.park = 0; p.fa = 1;
        if (quick) { p.t0 = now; p.dur = 450 + p.c * 250; p.amp = 0; }
        else {
          // stars wait a little, at most 0.22 s, so the figure condenses rather than snaps; a figure
          // with a drawing order (`waitKey`) is drawn along its key instead
          const wait = o.wait == null ? (o.stagger == null ? 220 : Math.min(220, o.stagger * .22)) : o.wait;
          p.t0 = now + (o.waitKey && q.k != null ? q.k * o.waitKey + p.c * 60 : wasFig ? (o.waitFig || 0) * p.c : p.c * wait);
          p.dur = Math.min(o.durMax || 1250, (o.dur || 650) + dist * (o.durPx == null ? .55 : o.durPx)) * (S.first && main ? 1.5 : 1);
          p.amp = Math.min(o.ampMax == null ? 22 : o.ampMax, dist * .05);
        }
        if (reduced) { p.tr = 0; p.look = 1; }
      }
      // everything not chosen dissolves into the star field where it is
      if (M && main) S.first = false;
      const ccx = prevBox.w ? prevBox.cx : Bx.cx, ccy = prevBox.w ? prevBox.cy : Bx.cy;
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (chosen[i] || p.m === 0 || p.L !== name || p.out) continue;
        // a reserve point is a star already
        if (p.park) { p.m = 0; p.n = null; p.park = 0; p.L = 'main'; continue; }
        // `sink`: the point fades on its old target (the page keeps that target moving for a moment)
        // and returns to the field as a star elsewhere in the drawing area
        if (o.release === 'sink' && scr && !reduced) { p.out = 1; continue; }
        releaseAt(p, p.sx, p.sy, t, ccx, ccy, o.drift);
        p.m = 0; p.n = null; p.tr = 1; p.cap = 0; p.t0 = now; p.dur = (o.fadeMs || 700) + p.c * 500; p.f0 = p.look; p.L = 'main'; p.park = 0; p.fa = 1;
        if (reduced) { p.tr = 0; p.look = 0; }
      }
      return M;
    }
    // a star placed exactly at screen position X, Y; it fades in from nothing
    function placeStar(p, X, Y, t) {
      const wx = reduced ? 0 : Math.sin(t * .05 + p.c * 20) * 40, wy = reduced ? 0 : Math.cos(t * .045 + p.a * 20) * 30;
      p.bx = X - wx; p.by = Y - wy + 100 + par() * (.3 + p.hz);
      p.vx = p.vy = 0; p.wx = p.wy = 0; p.look = 0; p.tr = 0; p.sa = reduced ? 1 : 0; p.fa = 1;
    }
    // a point has sunk into its drawing: it becomes a star somewhere in the drawing area of its layer
    function sunk(p, Lf, t) {
      const b = Lf.B, X = b.x + Math.random() * b.w, Y = b.y + Math.random() * b.h;
      placeStar(p, X, Y, t);
      if (p.out) { p.m = 0; p.n = null; p.L = 'main'; p.out = 0; p.park = 0; }
      else p.park = 1;
    }
    function project2screen(p) { project(p.x, p.y, p.z); return [out.x, out.y]; }

    function pointer(x, y, on = true) { const c = canvas.getBoundingClientRect(); S.mx = x - c.left; S.my = y - c.top; S.mOn = on; if (uni) { PTR.x = x; PTR.y = y; PTR.on = on; } }
    function leave() { S.mOn = false; S.mx = S.my = -1e4; if (uni) { PTR.on = false; PTR.x = PTR.y = -1e4; } }

    // ---------- frame ----------
    let lastDraw = 0, raf = 0, lastNow = 0, lastScroll = 0;
    const NB = 8, NL = 6; // depth buckets and transition buckets
    const paths = () => Array.from({ length: NB }, () => new Path2D());
    const NQ = 24; // alpha levels of the screen layers and of stars that fade in
    function draw(now) {
      const t = (now - S.t0) / 1000;
      const dt = lastNow ? clamp((now - lastNow) / 1000, 0, .05) : 1 / 60; lastNow = now;
      updBox(); setCam(t, dt);
      // page speed, smoothed, so released points can inherit it
      const jump = S.scrollY - lastScroll;
      // a jump of the page (anchor without smooth scrolling, restored position) moves no star
      if (Math.abs(jump) > S.H * .8) { for (const p of P) p.by += jump * .06 * (.3 + p.hz); lastScroll = S.scrollY; }
      const sv = dt > 0 ? (S.scrollY - lastScroll) / dt : 0; lastScroll = S.scrollY;
      S.scrollV = lerp(S.scrollV, clamp(sv, -4000, 4000), .25);
      if (S.dyn) S.dyn(reduced ? 1e4 : t, S.form, B);
      for (const k in S.layers) { const L = S.layers[k]; if (L.dyn) L.dyn(reduced ? 1e4 : t, L.form, L.B); }
      // the faint half of the stars only belongs to the Achsraster; it fades, it never pops
      const lowT = clamp((S.stars - .6) / .4) * A.low;
      S.lowA = reduced ? lowT : lerp(S.lowA, lowT, 1 - Math.exp(-dt * 2.2));
      const d = S.dpr, snap = d >= 1.5; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const starLo = new Path2D(), starHi = new Path2D(), starB = new Path2D();
      const fig = paths(), dimP = new Path2D(), acc = new Path2D();
      const mixP = Array.from({ length: NL }, () => new Path2D()), mixA = Array.from({ length: 3 }, () => new Path2D()), mixI = Array.from({ length: 3 }, () => new Path2D());
      // screen layers and fading stars: one path per alpha level, ink and rust
      let qI = null, qA = null;
      const qPaths = () => { qI = Array.from({ length: NQ + 1 }, () => new Path2D()); qA = Array.from({ length: NQ + 1 }, () => new Path2D()); };
      const RR = uni ? evRadius() : small ? 70 : 110, R2 = RR * RR, sz = A.sz, s60 = dt * 60;
      // opt-in measurement for the test scripts: points per frame that move faster than 12 px
      const stats = window.__pfStats ? { t: now, fast: 0, max: 0, dx: B.cx - (window.__pfB || B).cx, dy: B.cy - (window.__pfB || B).cy } : null; if (stats) window.__pfB = { cx: B.cx, cy: B.cy };
      const decay = Math.exp(-dt / .8), decayW = Math.exp(-dt / DIFF);
      const rect = (path, X, Y, r) => {
        if (snap) { const rr = Math.max(1, Math.round(r)); path.rect(Math.round(X * d - rr / 2), Math.round(Y * d - rr / 2), rr, rr); }
        else path.rect(X * d - r / 2, Y * d - r / 2, r, r);
      };
      const qadd = (arr, X, Y, r, a) => { if (a < .012) return; if (!qI) qPaths(); rect(arr === 1 ? qA[Math.min(NQ, Math.round(a * NQ))] : qI[Math.min(NQ, Math.max(1, Math.round(a * NQ)))], X, Y, r); };
      const sinkRate = reduced ? 1e9 : dt / .45, starIn = reduced ? 1e9 : dt / 1.4;
      for (let i = 0; i < N; i++) {
        const p = P[i];
        const Lf = p.m === 1 && p.L !== 'main' ? S.layers[p.L] : null, scr = !!(Lf && Lf.screen);
        // screen layers: switch a point between its target and the field (see 7. above)
        if (scr) {
          const q = p.n, want = !p.out && (!Lf.gate || q.on !== false);
          if (!p.park) {
            if (!want) { p.fa -= sinkRate; if (p.fa <= 0) sunk(p, Lf, t); }
            else if (p.fa < 1) p.fa = Math.min(1, p.fa + sinkRate);
          } else if (want && q.fade) { p.park = 0; p.fa = 0; p.tr = 0; p.look = 1; }
          else if (want) {
            // from wherever the star is, a timed path to the target
            const dist = Math.hypot(q.x - p.sx, q.y - p.sy);
            p.park = 0; p.fa = 1; p.tr = 1; p.cap = 1; p.f0 = p.look; p.t0 = now + p.c * 140;
            p.dur = Math.min(1250, 600 + dist * .55); p.amp = Math.min(18, dist * .05);
            if (reduced) { p.tr = 0; p.look = 1; }
          }
        }
        const asStar = p.m === 0 || p.park;
        // pointer offset: a small damped spring in screen space; a layer can yield less
        // (the KI page uses the pointer rule above instead, applied where the point is placed)
        if (!uni) {
          let fx = 0, fy = 0;
          if (S.mOn && !reduced) {
            const dx = p.sx - S.mx, dy = p.sy - S.my, d2 = dx * dx + dy * dy;
            if (d2 < R2) { const dd = Math.sqrt(d2) || 1, f = 1 - dd / RR, ff = f * f * 6 * (scr && !asStar && Lf.pk != null ? Lf.pk : 1); fx = dx / dd * ff; fy = dy / dd * ff; }
          }
          if (!reduced) { p.ovx = (p.ovx + fx - p.ox * p.k * 1.6) * .8; p.ovy = (p.ovy + fy - p.oy * p.k * 1.6) * .8; p.ox += p.ovx; p.oy += p.ovy; }
        }
        let X, Y, s = 1, look, still = false;
        if (!asStar) {
          const q = p.n, Bc = Lf ? Lf.B : B;
          if (scr) { X = q.x; Y = q.y; s = q.s || 1; }
          else if (Lf) { X = Bc.x + q.x; Y = Bc.y + q.y; s = 1; }
          else {
            let jx = 0, jy = 0;
            if (!reduced) { const j = S.camT.float * .6; jx = Math.sin(t * 1.1 + p.c * 30) * j; jy = Math.cos(t * .9 + p.a * 30) * j; }
            project(q.x + jx, q.y + jy, (q.z || 0) + (q.hz || 0));
            X = out.x; Y = out.y; s = out.s;
          }
          look = 1; still = !p.tr;
          p.acc = q.acc || 0; p.dim = q.dim || 0;
          if (p.tr) {
            if (now < p.t0) { X = p.sx - (uni ? p.dox : p.ox); Y = p.sy - (uni ? p.doy : p.oy); s = p.ss; look = p.look; if (!p.f0) { X = starX(p, t); Y = starY(p, t); } }
            else {
              // the start of the path is held relative to the box, so a morph rides along with the
              // page while it scrolls and is never smeared between screen and content
              // (screen layers: relative to the own target, so a path rides with the drawing as the
              // camera of the drawing moves)
              const ax = scr ? X : Bc.cx, ay = scr ? Y : Bc.cy;
              if (p.cap) { p.fx = p.sx - (uni ? p.dox : p.ox) - ax; p.fy = p.sy - (uni ? p.doy : p.oy) - ay; p.fs = p.ss; p.cap = 0; }
              const k = (now - p.t0) / p.dur;
              if (k >= 1) p.tr = 0;
              else {
                const e = easeIO(k), loose = Math.sin(Math.PI * e) * p.amp;
                X = lerp(ax + p.fx, X, e) + (p.a - .5) * 2 * loose; Y = lerp(ay + p.fy, Y, e) + (p.b - .5) * 2 * loose;
                s = lerp(p.fs || 1, s, e); look = lerp(p.f0, 1, e);
              }
            }
          }
        } else {
          if (!reduced) {
            p.bx += p.vx * dt; p.by += p.vy * dt; p.vx *= decay; p.vy *= decay;
            if (p.wx || p.wy) { p.bx += p.wx * dt; p.by += p.wy * dt; p.wx *= decayW; p.wy *= decayW; if (Math.abs(p.wx) + Math.abs(p.wy) < .5) p.wx = p.wy = 0; }
          }
          X = starX(p, t); Y = starY(p, t); look = 0;
          if (p.tr) { const k = (now - p.t0) / p.dur; if (k >= 1) p.tr = 0; else look = p.f0 * (1 - easeO2(k)); }
          if (p.sa < 1) p.sa = Math.min(1, p.sa + starIn);
        }
        p.look = look;
        if (uni) {
          // the pointer rule: the same spring for every point, rust points show half of the offset
          if (!reduced) {
            const kt = !asStar && p.n && p.n.acc ? EV.ACC : 1;
            p.kf += (kt - p.kf) * Math.min(1, s60 * .12);
            evade(p, X, Y, s60, RR, S.mx, S.my, S.mOn);
          }
          p.dox = p.ox * p.kf; p.doy = p.oy * p.kf;
          X += p.dox; Y += p.doy;
        } else { X += p.ox; Y += p.oy; }
        // invisible points are not measured: a star placed anew (alpha 0) or a target that is hidden
        const unseen = (asStar && p.sa < .05) || (scr && !asStar && (p.n.a == null ? 1 : p.n.a) * p.fa < .03);
        if (stats && !unseen && X > 0 && Y > 0 && X < S.W && Y < S.H && !(p.m === 1 && !asStar && p.n.vis < .04)) {
          let v;
          if (scr && !asStar && still) v = 0; // on its target: it moves exactly with the drawing
          // on its way: measured against its target, which moves with the drawing (as the KI page
          // measures against its box)
          else if (scr && !asStar && p.n.lx != null && !(p.tr && now < p.t0)) v = Math.hypot(X - p.sx - (p.n.x - p.n.lx), Y - p.sy - (p.n.y - p.n.ly)) / Math.max(1, dt * 60);
          else v = Math.min(Math.hypot(X - p.sx, Y - p.sy), Math.hypot(X - p.sx - stats.dx, Y - p.sy - stats.dy)) / Math.max(1, dt * 60);
          if (v > 12) { stats.fast++; if (window.__pfDbg && window.__pfDbg.length < 4000) window.__pfDbg.push([i, p.m, p.park, p.tr ? 1 : 0, scr ? 1 : 0, Math.round(v), Math.round(S.scrollY)]); } if (v > stats.max) stats.max = v;
        }
        p.sx = X; p.sy = Y; p.ss = s;
        if (stats && scr && !asStar) { p.n.lx = p.n.x; p.n.ly = p.n.y; }
        if (X < -10 || Y < -10 || X > S.W + 10 || Y > S.H + 10) continue;
        // the sky lies behind what is built: a page can hide the stars behind a solid
        if (asStar && S.starHide && S.starHide(X, Y)) continue;
        // ---- screen layers and fading stars: alpha levels ----
        if (scr || (asStar && p.sa < 1)) {
          const big = p.hz > .86, r0 = (big ? 1.7 : 1.15) * d * sz;
          const a0 = big ? A.starB : p.hz < S.lowCut ? A.star * S.lowA : A.star;
          if (asStar || look <= .001) { qadd(0, X, Y, r0, a0 * (asStar ? p.sa : 1)); continue; }
          const q = p.n, qa = (q.a == null ? 1 : q.a) * p.fa;
          const lvl = q.dim ? A.dim : lerp(A.far, A.near, clamp(Math.round((s - .85) / .3 * (NB - 1)), 0, NB - 1) / (NB - 1));
          const rf = (q.r || (small ? 1.8 : 2.1)) * s * d * sz, r = lerp(r0, rf, look);
          const c = (q.acc || 0) * look;
          qadd(0, X, Y, r, lerp(a0, lvl * qa, look) * (1 - c));
          if (c > 0) qadd(1, X, Y, r, A.acc * qa * c);
          continue;
        }
        if (look <= .001) {
          const big = p.hz > .86, r = (big ? 1.7 : 1.15) * d * sz;
          rect(big ? starB : (p.hz < S.lowCut ? starLo : starHi), X, Y, r);
          continue;
        }
        // flows (Köpfe, Netz) fade a point out before it starts its loop again
        if (p.m === 1 && p.n.vis != null && p.n.vis < 1) { if (p.n.vis < .04) continue; look = Math.min(look, p.n.vis * .999); }
        const rf = (p.m === 1 && p.n.r ? p.n.r : p.acc ? 2.7 : p.dim ? 1.5 : small ? 1.8 : 2.1) * s * d * (p.m === 1 && p.n.r ? 1 : sz);
        if (look < .999) {
          const r0 = (p.hz > .86 ? 1.7 : 1.15) * d * sz, r = lerp(r0, p.m === 1 ? rf : (p.rf || rf), look);
          // rust fades into ink and back, it never switches colour in one frame
          if (p.acc) { const kk = Math.min(2, Math.floor(look * 3)); rect(mixA[kk], X, Y, r); rect(mixI[kk], X, Y, r); }
          else rect(mixP[Math.min(NL - 1, Math.floor(look * NL))], X, Y, r);
          continue;
        }
        p.rf = rf;
        if (p.acc) rect(acc, X, Y, rf);
        else if (p.dim) rect(dimP, X, Y, rf);
        else rect(fig[clamp(Math.round((s - .85) / .3 * (NB - 1)), 0, NB - 1)], X, Y, rf);
      }
      const f = S.fade * col.a;
      ctx.fillStyle = `rgb(${col.ink})`;
      ctx.globalAlpha = A.star * S.lowA * f; ctx.fill(starLo);
      ctx.globalAlpha = A.star * f; ctx.fill(starHi);
      ctx.globalAlpha = A.starB * f; ctx.fill(starB);
      const mid = lerp(A.far, A.near, .45);
      for (let k = 0; k < NL; k++) { ctx.globalAlpha = lerp(A.star, mid, (k + .5) / NL) * f; ctx.fill(mixP[k]); }
      ctx.globalAlpha = A.dim * f; ctx.fill(dimP);
      for (let k = 0; k < NB; k++) { ctx.globalAlpha = lerp(A.far, A.near, k / (NB - 1)) * f; ctx.fill(fig[k]); }
      for (let k = 0; k < 3; k++) { ctx.globalAlpha = (1 - (k + .5) / 3) * lerp(A.star, mid, .5) * f; ctx.fill(mixI[k]); }
      if (qI) for (let k = 1; k <= NQ; k++) { ctx.globalAlpha = k / NQ * f; ctx.fill(qI[k]); }
      ctx.fillStyle = `rgb(${col.acc})`;
      for (let k = 0; k < 3; k++) { ctx.globalAlpha = (k + .5) / 3 * A.acc * f; ctx.fill(mixA[k]); }
      ctx.globalAlpha = A.acc * f; ctx.fill(acc);
      if (qA) for (let k = 1; k <= NQ; k++) { ctx.globalAlpha = k / NQ * f; ctx.fill(qA[k]); }
      ctx.globalAlpha = 1;
      if (stats) { stats.y = Math.round(S.scrollY); window.__pfStats.push(stats); }
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!S.visible || !S.running) { lastNow = 0; return; }
      if (opt.fps30 && now - lastDraw < 32) return;
      lastDraw = now; draw(now);
    }
    size();
    for (const p of P) { p.bx = R() * S.W; p.by = R() * S.WH; p.sx = starX(p, 0); p.sy = starY(p, 0); }
    if (!opt.manual) {
      if (reduced) { // settle instantly, redraw only when something changes
        const once = () => { for (let k = 0; k < 2; k++) draw(performance.now()); };
        S.redraw = once; requestAnimationFrame(once);
      } else raf = requestAnimationFrame(loop);
    }
    addEventListener('resize', () => { if (size() && S.redraw) S.redraw(); });
    return {
      S, P, setForm, setLayer, setColors, pointer, leave, draw, size, reduced, small,
      redraw() { if (S.redraw) S.redraw(); },
      stop() { cancelAnimationFrame(raf); }, project2screen,
      // settle a figure instantly (still images)
      settle(n = 60) { const now = performance.now(); for (const p of P) { p.tr = 0; p.look = p.m && !p.park ? 1 : 0; p.sa = 1; if (p.out) { p.out = 0; p.m = 0; p.n = null; p.L = 'main'; } } for (let k = 0; k < n; k++) draw(now + k * 16); }
    };
  }


  // ---------- motion helpers for figures ----------
  // hovering stars of a raster sink into the axes one after another, a few lift again later
  // (time counts from the moment the figure is formed, so the raster settles each time it forms;
  // reduced motion hands in a far time and gets the settled state)
  function rasterSettle(form, { start = 0, span = 9 } = {}) {
    let t0 = null;
    return t1 => {
      if (t0 == null) t0 = t1 >= 1e4 ? 0 : t1;
      const t = t1 >= 1e4 ? t1 : t1 - t0;
      for (const q of form) {
        if (!q.hz0) q.hz0 = q.hz || 0;
        if (!q.hz0) continue;
        const local = t - start - q.ph * span;
        const k = clamp(local / 2.6);
        // a few points never quite land: they rise and sink slowly, information in the air
        const air = q.ph < .2 && local > 2.6 ? Math.pow(.5 - .5 * Math.cos((local - 2.6) * (.16 + q.ph * .5)), 2) * .7 : 0;
        q.hz = q.hz0 * (1 - easeOut(k) + air);
      }
    };
  }
  function koepfeFlow(form) {
    const C = form.meta.C;
    return t => {
      for (const q of form) {
        if (q.flow == null) continue;
        if (q.x0 == null) { q.x0 = q.x; q.y0 = q.y; q.z0 = q.z; }
        const k = ((q.flow + t * .05) % 1), e = k * k * (3 - 2 * k), c = C[q.c];
        q.vis = Math.min(1, k / .12, (1 - k) / .1);
        q.x = lerp(q.x0, c[0], e * .92); q.y = lerp(q.y0, c[1], e * .92); q.z = lerp(q.z0, c[2], e * .92);
      }
    };
  }

  window.Punkte = { create, F, evade, evRadius, EV, PTR, rasterSettle, koepfeFlow, stroemeFlow, gespraechFlow, rng };
})();
