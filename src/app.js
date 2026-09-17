/* ialexopoulos.org — progressive enhancement only.
 * Every word of content is already in the HTML; this file adds theme,
 * menu, scroll-spy and reveal animations. The page works without it. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* -- remember which language this visitor chose, for the "/" router ----- */
  try { localStorage.setItem('lang', root.lang || 'en'); } catch (e) {}

  /* -- theme -------------------------------------------------------------- */
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var btn = document.getElementById('themeBtn');

  function paint(theme) {
    root.setAttribute('data-theme', theme);
    if (btn) {
      btn.textContent = theme === 'dark' ? '🌙' : '☀️';
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }
  function stored() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }

  paint(stored() || (media.matches ? 'dark' : 'light'));

  if (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch (e) {}
      paint(next);
    });
  }
  media.addEventListener('change', function (e) {
    if (!stored()) paint(e.matches ? 'dark' : 'light');
  });

  /* -- mobile menu -------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var menuBtn = document.getElementById('menuBtn');

  function setMenu(open) {
    if (!nav || !menuBtn) return;
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      setMenu(!nav.classList.contains('open'));
    });
  }
  if (nav) {
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  /* -- active section in the nav ------------------------------------------ */
  var links = Array.prototype.slice.call(document.querySelectorAll('nav a[href^="#"]'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();
