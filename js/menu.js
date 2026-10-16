// The menu: a button in the header opens a full screen panel (css/menu.css).
// While it is open the page underneath holds still: wheel, touch and scroll keys are held back
// (the page keeps its scroll position and its snap stop, and nothing in the layout changes),
// focus stays inside button and panel, Esc closes and focus returns to the button.
// A link in the panel closes the menu first; links to a section of the same page then go on to
// the in-page handler of the page (js/ki.js, js/fallstudie.js), which snaps to that section.
// This script must load before those page scripts, so its click handler runs first.
(() => {
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  if (!btn || !menu) return;
  const root = document.documentElement;
  const away = [...document.querySelectorAll('body > :not(.bar):not(#menu):not(script)')];
  let open = false, keepY = 0;
  const focusables = () => [btn, ...menu.querySelectorAll('a[href], button:not([disabled])')].filter(el => el.offsetParent !== null || el === btn);

  function setOpen(on, returnFocus = true) {
    if (on === open) return;
    open = on;
    if (on) keepY = scrollY;
    if (on) addEventListener('touchmove', holdTouch, { capture: true, passive: false });
    else removeEventListener('touchmove', holdTouch, { capture: true });
    root.classList.toggle('menu-open', on);
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Menü schließen' : 'Menü öffnen');
    menu.inert = !on;
    menu.setAttribute('aria-hidden', String(!on));
    // the page under the menu is out of reach for focus and assistive technology
    away.forEach(el => { el.inert = on; });
    if (on) { const first = menu.querySelector('a[href]'); if (first) setTimeout(() => first.focus({ preventScroll: true }), 30); }
    else {
      if (Math.abs(scrollY - keepY) > 1) scrollTo({ top: keepY, behavior: 'instant' });
      if (returnFocus) btn.focus({ preventScroll: true });
    }
  }
  menu.inert = true;
  btn.addEventListener('click', () => setOpen(!open));

  // links: close first; the browser or the page script takes over from there
  menu.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (a && open) setOpen(false, false); });

  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'Tab') {
      const f = focusables(); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    // scroll keys move the panel at most, never the page
    if ([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(e.key) && !menu.contains(document.activeElement)) e.preventDefault();
  }, true);
  // the wheel and touch: the page handlers never see them while the menu is open
  const holdWheel = e => {
    if (!open) return;
    e.stopImmediatePropagation();
    const scrollable = menu.scrollHeight > menu.clientHeight + 1;
    if (!scrollable || !menu.contains(e.target)) e.preventDefault();
  };
  addEventListener('wheel', holdWheel, { capture: true, passive: false });
  // the touch listener can cancel scrolling, so it is only attached while the menu is open: a page
  // with a blocking touch listener would make the browser wait for script on every swipe
  const holdTouch = e => {
    if (!open) return;
    const scrollable = menu.scrollHeight > menu.clientHeight + 1;
    if (!scrollable || !menu.contains(e.target)) e.preventDefault();
  };
  // a page scroll that slips through anyway is put back
  addEventListener('scroll', () => { if (open && Math.abs(scrollY - keepY) > 1) scrollTo({ top: keepY, behavior: 'instant' }); }, { passive: true });
  // test scripts
  window.__menu = { setOpen, get open() { return open; } };
})();
