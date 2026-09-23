/* ialexopoulos.org — progressive enhancement only.
 * Every word of content is already in the HTML; this adds the theme toggle,
 * the active-section highlight in the nav, and opens the collapsed role
 * details before printing. The page works fully without it. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* -- remember which language this visitor chose, for the "/" router ----- */
  try { localStorage.setItem('lang', root.lang || 'en'); } catch (e) {}

  /* -- theme --------------------------------------------------------------
   * No stored choice: CSS follows the system setting (light when there is
   * none). A click stores an explicit choice, which then wins. */
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var btn = document.getElementById('themeBtn');

  function current() {
    return root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
  }
  function label() {
    if (!btn) return;
    var dark = current() === 'dark';
    btn.textContent = dark ? btn.getAttribute('data-light') : btn.getAttribute('data-dark');
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  if (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
  }
  media.addEventListener('change', label);
  label();

  /* -- active section in the nav ------------------------------------------ */
  var links = Array.prototype.slice.call(document.querySelectorAll('nav a[data-sec]'));
  if ('IntersectionObserver' in window && links.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('data-sec') === entry.target.id;
          a.classList.toggle('on', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute('data-sec'));
      if (s) spy.observe(s);
    });
  }

  /* -- printing from the browser shows the full scope of each role -------- */
  window.addEventListener('beforeprint', function () {
    Array.prototype.forEach.call(document.querySelectorAll('details'), function (d) { d.open = true; });
  });
})();
