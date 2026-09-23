#!/usr/bin/env node
/**
 * Static build for ialexopoulos.org
 * ---------------------------------
 * Reads data/cv.json (the single source of truth for ALL content, both
 * languages) and emits a fully-rendered page per language into dist/.
 *
 *   node build.mjs            build everything, including PDFs
 *   node build.mjs --no-pdf   skip PDF/OG rendering (no Chromium needed)
 *
 * Nothing here is a framework. Zero runtime dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const data = JSON.parse(readFileSync(join(ROOT, 'data', 'cv.json'), 'utf8'));
const { site, shared } = data;
const WITH_PDF = !process.argv.includes('--no-pdf');
const YEAR = new Date().getFullYear();

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const out = (rel, content) => {
  const p = join(DIST, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
};

/* ---------------------------------------------------------------- icons -- */
const ICON = {
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${ICON[name]}</svg>`;

/* ---------------------------------------------------------------- fonts -- */
/* Libre Baskerville and Karla contain NO Greek glyphs. Literata and
 * Commissioner are layered in behind them, scoped by unicode-range so they
 * are fetched only when Greek characters are actually on the page. Latin
 * typography is therefore byte-for-byte what it was before. */
const RANGE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  latinExt: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
  greekExt: 'U+1F00-1FFF'
};

const FONT_FILES = [
  ['@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2', 'baskerville-latin-400.woff2'],
  ['@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2', 'baskerville-latin-700.woff2'],
  ['@fontsource/libre-baskerville/files/libre-baskerville-latin-ext-400-normal.woff2', 'baskerville-latinext-400.woff2'],
  ['@fontsource/libre-baskerville/files/libre-baskerville-latin-ext-700-normal.woff2', 'baskerville-latinext-700.woff2'],
  ['@fontsource-variable/karla/files/karla-latin-wght-normal.woff2', 'karla-latin.woff2'],
  ['@fontsource-variable/karla/files/karla-latin-ext-wght-normal.woff2', 'karla-latinext.woff2'],
  ['@fontsource-variable/literata/files/literata-greek-wght-normal.woff2', 'literata-greek.woff2'],
  ['@fontsource-variable/literata/files/literata-greek-ext-wght-normal.woff2', 'literata-greekext.woff2'],
  ['@fontsource-variable/commissioner/files/commissioner-greek-wght-normal.woff2', 'commissioner-greek.woff2']
];

const face = (family, file, range, { weight = '400', variable = false } = {}) =>
`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
`src:url('../fonts/${file}') format('woff2${variable ? '-variations' : ''}');unicode-range:${range};}`;

const FONT_CSS = [
  '/* Self-hosted. No third-party font requests leave the visitor’s browser. */',
  face('Libre Baskerville', 'baskerville-latin-400.woff2', RANGE.latin, { weight: '400' }),
  face('Libre Baskerville', 'baskerville-latin-700.woff2', RANGE.latin, { weight: '700' }),
  face('Libre Baskerville', 'baskerville-latinext-400.woff2', RANGE.latinExt, { weight: '400' }),
  face('Libre Baskerville', 'baskerville-latinext-700.woff2', RANGE.latinExt, { weight: '700' }),
  face('Karla', 'karla-latin.woff2', RANGE.latin, { weight: '200 800', variable: true }),
  face('Karla', 'karla-latinext.woff2', RANGE.latinExt, { weight: '200 800', variable: true }),
  '/* Greek companions — downloaded only when Greek text is present. */',
  face('Literata', 'literata-greek.woff2', RANGE.greek, { weight: '200 900', variable: true }),
  face('Literata', 'literata-greekext.woff2', RANGE.greekExt, { weight: '200 900', variable: true }),
  face('Commissioner', 'commissioner-greek.woff2', RANGE.greek, { weight: '100 900', variable: true })
].join('\n');

/* ----------------------------------------------------------------- page -- */
const urlFor = (lang) => `${site.origin}/${lang}/`;

function head(lang) {
  const d = data[lang], m = d.meta;
  const other = site.languages.find((l) => l !== lang);
  const alt = site.languages
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}">`)
    .join('\n  ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: m.name,
    alternateName: lang === 'en' ? data.el.meta.name : data.en.meta.name,
    jobTitle: d.hero.role,
    description: m.description,
    url: urlFor(lang),
    email: `mailto:${shared.email}`,
    telephone: shared.phoneDisplay,
    image: `${site.origin}/og.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: shared.addressLocality,
      addressCountry: shared.addressCountry
    },
    ...(shared.employer ? { worksFor: { '@type': 'Organization', name: shared.employer } } : {}),
    alumniOf: { '@type': 'CollegeOrUniversity', name: shared.alumniOf },
    knowsLanguage: ['el', 'en', 'de'],
    sameAs: [shared.linkedin, shared.github]
  };

  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(m.pageTitle)}</title>
  <meta name="description" content="${esc(m.description)}">
  <meta name="author" content="${esc(m.name)}">
  <link rel="canonical" href="${urlFor(lang)}">
  ${alt}
  <link rel="alternate" hreflang="x-default" href="${site.origin}/">
  <meta name="theme-color" content="${site.themeColor}">

  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${esc(m.name)}">
  <meta property="og:locale" content="${m.locale}">
  <meta property="og:locale:alternate" content="${data[other].meta.locale}">
  <meta property="og:url" content="${urlFor(lang)}">
  <meta property="og:title" content="${esc(m.pageTitle)}">
  <meta property="og:description" content="${esc(m.description)}">
  <meta property="og:image" content="${site.origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(m.name)} — ${esc(d.hero.role)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(m.pageTitle)}">
  <meta name="twitter:description" content="${esc(m.description)}">
  <meta name="twitter:image" content="${site.origin}/og.png">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" as="font" type="font/woff2" href="/fonts/karla-latin.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="/fonts/baskerville-latin-700.woff2" crossorigin>
  <link rel="stylesheet" href="/assets/site.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script>(function(){try{var s=localStorage.getItem('theme');var t=s||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;
}

function body(lang) {
  const d = data[lang], m = d.meta;
  const other = site.languages.find((l) => l !== lang);

  const navLinks = ['about', 'experience', 'skills', 'education', 'contact']
    .map((k, i) => `<a href="#${k}"${i === 0 ? ' class="active"' : ''}>${esc(d.nav[k])}</a>`)
    .join('\n          ');

  const expItems = d.experience.items.map((j, i) => `
        <article class="experience-item animate animate-delay-${Math.min(i + 1, 4)}">
          <div class="exp-date">${esc(j.date)}</div>
          <div class="exp-content">
            <h3>${esc(j.title)}</h3>
            <p class="exp-company">${esc(j.company)}</p>
            <p>${esc(j.desc)}</p>
            <div class="exp-tags">${j.tags.map((t) => `<span class="exp-tag">${esc(t)}</span>`).join('')}</div>
          </div>
        </article>`).join('');

  const skillGroups = d.skills.groups.map((g) => `
          <div class="skill-group">
            <h3>${esc(g.title)}</h3>
            <div class="skill-list">${g.items.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
          </div>`).join('');

  const eduItems = d.education.items.map((e, i) => `
        <article class="experience-item animate animate-delay-${i + 1}">
          <div class="exp-date">${esc(e.date)}</div>
          <div class="exp-content">
            <h3>${esc(e.title)}</h3>
            <p class="exp-company">${esc(e.company)}</p>
            <p>${esc(e.desc)}</p>
          </div>
        </article>`).join('');

  return `<a href="#main" class="skip-link">${esc(d.ui.skipToContent)}</a>
    <header>
      <div class="header-inner">
        <a href="#" class="logo" aria-label="${esc(m.name)}">I<span>.</span>A</a>
        <button class="menu-toggle" type="button" aria-label="${esc(d.ui.menuLabel)}" aria-expanded="false" aria-controls="nav" id="menuBtn">
          <span></span><span></span><span></span>
        </button>
        <nav id="nav" aria-label="${esc(d.nav.about)}">
          ${navLinks}
        </nav>
        <button class="theme-btn" type="button" aria-label="${esc(d.ui.themeLabel)}" id="themeBtn">☀️</button>
        <a class="theme-btn lang-btn" href="/${other}/" hreflang="${other}" lang="${other}" title="${esc(m.switchTitle)}">${esc(m.switchLabel)}</a>
      </div>
    </header>

    <main id="main">
      <section id="about">
        <div class="intro animate">
          <div class="avatar" aria-hidden="true">${shared.initials}</div>
          <div class="intro-text">
            <h1>${esc(m.name)}</h1>
            <p class="role">${esc(d.hero.role)}</p>
            <p>${esc(d.hero.summary)}</p>
            <div class="intro-links">
              <a href="mailto:${shared.email}">${svg('mail')}<span>${esc(d.ui.email)}</span></a>
              <a href="${shared.linkedin}" target="_blank" rel="noopener">${svg('linkedin')}<span>LinkedIn</span></a>
              <a href="${shared.github}" target="_blank" rel="noopener">${svg('github')}<span>GitHub</span></a>
              <a href="tel:${shared.phoneHref}">${svg('phone')}<span>${esc(d.ui.phone)}</span></a>
              <a href="/cv-${lang}.pdf" download hreflang="${lang}" type="application/pdf">${svg('download')}<span>${esc(d.ui.downloadCV)}</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="experience">
        <h2 class="section-title animate">${esc(d.experience.title)}</h2>${expItems}
      </section>

      <section id="skills">
        <h2 class="section-title animate">${esc(d.skills.title)}</h2>
        <div class="skills-grid animate animate-delay-1">${skillGroups}
        </div>
      </section>

      <section id="education">
        <h2 class="section-title animate">${esc(d.education.title)}</h2>${eduItems}
      </section>

      <section id="contact">
        <h2 class="section-title animate">${esc(d.contact.title)}</h2>
        <div class="contact-grid animate animate-delay-1">
          <a href="mailto:${shared.email}" class="contact-item">${svg('mail')}<span>${shared.email}</span></a>
          <a href="${shared.linkedin}" target="_blank" rel="noopener" class="contact-item">${svg('linkedin')}<span>LinkedIn</span></a>
          <a href="${shared.github}" target="_blank" rel="noopener" class="contact-item">${svg('github')}<span>GitHub</span></a>
          <a href="tel:${shared.phoneHref}" class="contact-item">${svg('phone')}<span>${esc(shared.phoneDisplay)}</span></a>
          <div class="contact-item" style="cursor:default">${svg('location')}<span>${esc(d.ui.location)}</span></div>
        </div>
      </section>
    </main>

    <footer>
      <p>© ${YEAR} ${esc(m.name)}</p>
    </footer>
    <script src="/assets/app.js" defer></script>`;
}

const page = (lang) =>
`<!DOCTYPE html>
<html lang="${lang}">
<head>
  ${head(lang)}
</head>
<body>
    ${body(lang)}
</body>
</html>
`;

/* --------------------------------------------------- root language router -- */
/* "/" is the x-default entry point: it offers both languages as real,
 * crawlable links and forwards a first-time human to their own language. */
function routerPage() {
  const alt = site.languages
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${urlFor(l)}">`).join('\n  ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(shared.name)} — ${esc(shared.jobTitleEn)}</title>
  <meta name="description" content="${esc(data.en.meta.description)}">
  <link rel="canonical" href="${site.origin}/">
  ${alt}
  <link rel="alternate" hreflang="x-default" href="${site.origin}/">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${site.origin}/">
  <meta property="og:title" content="${esc(shared.name)} — ${esc(shared.jobTitleEn)}">
  <meta property="og:description" content="${esc(data.en.meta.description)}">
  <meta property="og:image" content="${site.origin}/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="${site.themeColor}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css">
  <script>(function(){try{
    var saved=localStorage.getItem('lang');
    var pick=saved||((navigator.languages||[navigator.language||'en']).some(function(l){return /^el\\b/i.test(l);})?'el':'en');
    location.replace('/'+pick+'/');
  }catch(e){location.replace('/en/');}})();</script>
</head>
<body class="router">
  <main class="router-card">
    <p class="avatar" aria-hidden="true">${shared.initials}</p>
    <h1>${esc(shared.name)}</h1>
    <p class="role">${esc(shared.jobTitleEn)}</p>
    <nav class="router-links" aria-label="Language">
      <a href="/en/" hreflang="en" lang="en">English</a>
      <a href="/el/" hreflang="el" lang="el">Ελληνικά</a>
    </nav>
  </main>
</body>
</html>
`;
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found — ${esc(shared.name)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body class="router">
  <main class="router-card">
    <h1>404</h1>
    <p class="role">This page does not exist.</p>
    <nav class="router-links">
      <a href="/en/" hreflang="en">English</a>
      <a href="/el/" hreflang="el" lang="el">Ελληνικά</a>
    </nav>
  </main>
</body>
</html>
`;
}

/* ------------------------------------------------------- print / PDF page -- */
function printPage(lang) {
  const d = data[lang], m = d.meta;
  const row = (it, tags) => `
    <div class="entry">
      <div class="entry-date">${esc(it.date)}</div>
      <div class="entry-body">
        <h3>${esc(it.title)}</h3>
        <p class="org">${esc(it.company)}</p>
        <p>${esc(it.desc)}</p>
        ${tags && it.tags ? `<p class="tags">${it.tags.map(esc).join(' · ')}</p>` : ''}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${esc(m.name)} — CV</title>
<style>
${FONT_CSS.replace(/\.\.\/fonts\//g, 'fonts/')}
@page { size: A4; margin: 11mm 14mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Karla','Commissioner',sans-serif; font-size:9.1pt; line-height:1.42; color:#2D2A26; }
h1 { font-family:'Libre Baskerville','Literata',Georgia,serif; font-size:17pt; line-height:1.15; margin-bottom:1.6mm; }
.role { color:#C45D3A; font-size:10.2pt; font-weight:600; margin-bottom:2mm; }
.contact { color:#5C5650; font-size:8.4pt; margin-bottom:3.8mm; }
.contact span { white-space:nowrap; }
.contact span + span::before { content:' · '; color:#B9B2AC; }
h2 { font-family:'Libre Baskerville','Literata',Georgia,serif; font-size:10.5pt; color:#C45D3A;
     border-bottom:0.6pt solid #E0DAD3; padding-bottom:1.1mm; margin:3.6mm 0 2.2mm; letter-spacing:.02em; }
.summary { margin-bottom:1mm; text-align:justify; }
.entry { display:grid; grid-template-columns:26mm 1fr; gap:4mm; margin-bottom:2.3mm; page-break-inside:avoid; }
.entry-date { color:#8A847E; font-size:8.4pt; padding-top:0.6mm; font-variant-numeric:tabular-nums; }
.entry-body h3 { font-size:10pt; font-weight:700; }
.entry-body .org { color:#5C5650; font-size:8.8pt; margin-bottom:1mm; }
.tags { color:#8A847E; font-size:8pt; margin-top:1mm; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm 8mm; page-break-inside:avoid; }
.grp h3 { page-break-inside:avoid; break-inside:avoid; font-size:8.4pt; text-transform:uppercase; letter-spacing:.07em; color:#8A847E; margin-bottom:1.2mm; }
.grp p { font-size:8.9pt; }
.grp { page-break-inside:avoid; break-inside:avoid; }
footer { margin-top:3.2mm; padding-top:1.6mm; border-top:0.6pt solid #E0DAD3;
         color:#9A9490; font-size:7.6pt; display:flex; justify-content:space-between; }
</style>
</head>
<body>
  <h1>${esc(m.name)}</h1>
  <p class="role">${esc(d.hero.role)}</p>
  <p class="contact"><span>${shared.email}</span><span>${esc(shared.phoneDisplay)}</span><span>linkedin.com/in/ialexop</span><span>github.com/johnnypatras</span><span>${esc(d.ui.location)}</span></p>

  <h2>${esc(d.nav.about)}</h2>
  <p class="summary">${esc(d.hero.summary)}</p>

  <h2>${esc(d.experience.title)}</h2>
  ${d.experience.items.map((j) => row(j, true)).join('')}

  <h2>${esc(d.education.title)}</h2>
  ${d.education.items.map((e) => row(e, false)).join('')}

  <h2>${esc(d.skills.title)}</h2>
  <div class="grid">
    ${d.skills.groups.map((g) => `<div class="grp"><h3>${esc(g.title)}</h3><p>${g.items.map(esc).join(' · ')}</p></div>`).join('')}
  </div>

  <footer><span>${esc(m.name)}</span><span>${site.origin.replace('https://', '')}/${lang}/</span></footer>
</body>
</html>
`;
}

function ogPage() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><style>
${FONT_CSS.replace(/\.\.\/fonts\//g, 'fonts/')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#FFFCF9;display:flex;align-items:center;
     padding:0 96px;font-family:'Karla',sans-serif;color:#2D2A26;position:relative;overflow:hidden}
.bar{position:absolute;left:0;top:0;bottom:0;width:18px;background:#C45D3A}
.blob{position:absolute;right:-140px;top:-140px;width:520px;height:520px;border-radius:50%;
      background:radial-gradient(circle at 30% 30%,#E8D5CE,#FFFCF9 70%)}
.wrap{position:relative;z-index:1}
.avatar{width:104px;height:104px;border-radius:50%;background:#C45D3A;color:#fff;
        font-family:'Libre Baskerville',serif;font-size:40px;font-weight:700;
        display:flex;align-items:center;justify-content:center;margin-bottom:34px;letter-spacing:.04em}
h1{font-family:'Libre Baskerville',serif;font-size:66px;line-height:1.08;margin-bottom:18px}
.role{font-size:31px;font-weight:600;color:#C45D3A;margin-bottom:26px}
.meta{font-size:23px;color:#5C5650;letter-spacing:.01em}
</style></head>
<body>
  <div class="bar"></div><div class="blob"></div>
  <div class="wrap">
    <div class="avatar">${shared.initials}</div>
    <h1>${esc(shared.name)}</h1>
    <p class="role">${esc(shared.jobTitleEn)}</p>
    <p class="meta">15+ years leading teams · Computer Engineering · Patras, Greece</p>
  </div>
</body></html>
`;
}

/* -------------------------------------------------------------- assets --- */
function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${site.themeColor}"/>
  <text x="32" y="43" text-anchor="middle" font-family="Georgia,'Times New Roman',serif"
        font-size="30" font-weight="700" fill="#FFFCF9" letter-spacing="1">IA</text>
</svg>
`;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [site.origin + '/', ...site.languages.map(urlFor)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.w3.org/1999/xhtml/sitemap" xmlns:xhtml="http://www.w3.org/1999/xhtml">
</urlset>`.replace(
    /<urlset[^>]*>\n<\/urlset>/,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
${site.languages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.origin}/"/>
    <changefreq>monthly</changefreq>
    <priority>${u === site.origin + '/' ? '1.0' : '0.9'}</priority>
  </url>`).join('\n')}
</urlset>`
  ) + '\n';
}

const robots = () =>
`User-agent: *
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`;

/* ---------------------------------------------------------------- build --- */
function copyFonts() {
  let copied = 0;
  for (const [from, to] of FONT_FILES) {
    const src = join(ROOT, 'node_modules', from);
    if (!existsSync(src)) {
      console.error(`  ! missing font: ${from} — run: npm install`);
      continue;
    }
    mkdirSync(join(DIST, 'fonts'), { recursive: true });
    copyFileSync(src, join(DIST, 'fonts', to));
    copied++;
  }
  return copied;
}

function buildCss() {
  const base = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');
  const extra = existsSync(join(ROOT, 'src', 'additions.css'))
    ? readFileSync(join(ROOT, 'src', 'additions.css'), 'utf8') : '';
  return `${FONT_CSS}\n\n${base}\n\n${extra}\n`;
}

async function renderBinaries() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('  – playwright not installed, skipping PDF/OG (run: npm i -D playwright)');
    return false;
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  for (const lang of site.languages) {
    const tmp = `.print-${lang}.html`;
    out(tmp, printPage(lang));
    const p = await ctx.newPage();
    await p.goto('file://' + join(DIST, tmp), { waitUntil: 'networkidle' });
    await p.emulateMedia({ media: 'print' });
    await p.pdf({
      path: join(DIST, `cv-${lang}.pdf`),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
    await p.close();
    rmSync(join(DIST, tmp));
    console.log(`  ✓ cv-${lang}.pdf`);
  }

  const ogTmp = '.og.html';
  out(ogTmp, ogPage());
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1200, height: 630 });
  await p.goto('file://' + join(DIST, ogTmp), { waitUntil: 'networkidle' });
  await p.screenshot({ path: join(DIST, 'og.png') });
  await p.setViewportSize({ width: 180, height: 180 });
  await p.setContent(favicon().replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="180" height="180"'));
  await p.screenshot({ path: join(DIST, 'apple-touch-icon.png'), omitBackground: false });
  await p.close();
  rmSync(join(DIST, ogTmp));
  console.log('  ✓ og.png, apple-touch-icon.png');

  await browser.close();
  return true;
}

async function main() {
  console.log('building ialexopoulos.org\n');
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  for (const lang of site.languages) {
    out(`${lang}/index.html`, page(lang));
    console.log(`  ✓ /${lang}/`);
  }
  out('index.html', routerPage());
  out('404.html', notFoundPage());
  out('assets/site.css', buildCss());
  copyFileSync(join(ROOT, 'src', 'app.js'), join(DIST, 'assets', 'app.js'));
  out('favicon.svg', favicon());
  out('sitemap.xml', sitemap());
  out('robots.txt', robots());
  if (existsSync(join(ROOT, 'CNAME'))) copyFileSync(join(ROOT, 'CNAME'), join(DIST, 'CNAME'));
  console.log(`  ✓ ${copyFonts()} font files`);
  console.log('  ✓ css, js, icons, sitemap, robots, 404');

  if (WITH_PDF) await renderBinaries();
  console.log('\ndone → dist/');
}

main().catch((err) => { console.error(err); process.exit(1); });
