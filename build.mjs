#!/usr/bin/env node
/**
 * Static build for ialexopoulos.org
 * ---------------------------------
 * Reads data/cv.json (the single source of truth for ALL content, both
 * languages) and emits a fully-rendered page per language into dist/,
 * plus the two PDF CVs and the social preview image from the same data.
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
/* "A · B · C" lists: keep each separator with the word before it, so a
 * wrapped line never starts with a dot. */
const list = (s) => esc(s).replace(/ · /g, '&nbsp;· ');
const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, '');

/* QR code as inline SVG (vector, so it prints sharp). Filled in by
 * renderBinaries(), which loads the qrcode package only when PDFs are built. */
let QR = null;
function qrSvg(text, sizeMm) {
  const { modules } = QR.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size, q = 2;             // 2-module quiet zone
  let path = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (modules.get(y, x)) path += `M${x + q} ${y + q}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" width="${sizeMm}mm" height="${sizeMm}mm" shape-rendering="crispEdges" role="img" aria-label="${text}"><path d="${path}" fill="#1A1A18"/></svg>`;
}

const out = (rel, content) => {
  const p = join(DIST, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
};

/* ---------------------------------------------------------------- fonts -- */
/* Source Serif 4 (headings), IBM Plex Sans (text) and JetBrains Mono (dates,
 * labels) all have native Greek, so both languages use the same three
 * families. Each subset is a separate file, fetched only when the page
 * contains characters in its unicode-range. */
const RANGE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  latinExt: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF'
};

const FAMILIES = [
  // [family, npm package, file stem, axis file, weight range]
  ['Source Serif 4', '@fontsource-variable/source-serif-4', 'source-serif-4', 'opsz', '200 900', 'serif'],
  ['IBM Plex Sans', '@fontsource-variable/ibm-plex-sans', 'ibm-plex-sans', 'wght', '100 700', 'plex'],
  ['JetBrains Mono', '@fontsource-variable/jetbrains-mono', 'jetbrains-mono', 'wght', '100 800', 'mono']
];
const SUBSETS = [['latin', RANGE.latin], ['latin-ext', RANGE.latinExt], ['greek', RANGE.greek]];

const FONT_FILES = FAMILIES.flatMap(([, pkg, stem, axis, , short]) =>
  SUBSETS.map(([sub]) => [`${pkg}/files/${stem}-${sub}-${axis}-normal.woff2`, `${short}-${sub}.woff2`]));

const FONT_CSS = [
  '/* Self-hosted. No third-party font requests leave the visitor’s browser. */',
  ...FAMILIES.flatMap(([family, , , , weight, short]) => SUBSETS.map(([sub, range]) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
    `src:url('../fonts/${short}-${sub}.woff2') format('woff2-variations');unicode-range:${range};}`))
].join('\n');

/* ----------------------------------------------------------------- page -- */
const urlFor = (lang) => `${site.origin}/${lang}/`;
const SECTIONS = ['about', 'experience', 'skills', 'education'];

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
    jobTitle: d.role,
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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(m.pageTitle)}</title>
  <meta name="description" content="${esc(m.description)}">
  <meta name="author" content="${esc(m.name)}">
  <link rel="canonical" href="${urlFor(lang)}">
  ${alt}
  <link rel="alternate" hreflang="x-default" href="${site.origin}/">
  <meta name="theme-color" content="#F7F6F2" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15161A" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">

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
  <meta property="og:image:alt" content="${esc(m.name)} — ${esc(d.role)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(m.pageTitle)}">
  <meta name="twitter:description" content="${esc(m.description)}">
  <meta name="twitter:image" content="${site.origin}/og.png">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" as="font" type="font/woff2" href="/fonts/plex-latin.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="/fonts/serif-latin.woff2" crossorigin>
  ${lang === 'el' ? '<link rel="preload" as="font" type="font/woff2" href="/fonts/plex-greek.woff2" crossorigin>' : ''}
  <link rel="stylesheet" href="/assets/site.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>`;
}

const pts = (a) => `<ul class="pts">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

function position(j, u, showOrg) {
  const scope = j.scope ? `
        <details class="more"><summary><span class="chev" aria-hidden="true"></span>${esc(u.more)}</summary>
          <div class="scope">${j.scope.map((g) => `<div><h4>${esc(g.h)}</h4>${pts(g.items)}</div>`).join('')}</div></details>` : '';
  return `<div class="row pos">
      <div class="rail"><span class="yr">${esc(j.date)}</span></div>
      <div class="col"><h3>${esc(j.title)}</h3>${showOrg ? `<p class="org">${esc(j.org)}</p>` : ''}${pts(j.pts)}${scope}
      </div></div>`;
}

const sectionHead = (t) =>
  `<div class="head"><div class="rail"></div><div class="col"><h2 class="sh">${esc(t)}</h2></div></div><hr>`;

function body(lang) {
  const d = data[lang], m = d.meta, u = d.ui;
  const other = site.languages.find((l) => l !== lang);

  const nav = SECTIONS
    .map((k) => `<a href="#${k}" data-sec="${k}">${esc(u.nav[k])}</a>`).join('\n      ');

  const jobs = d.jobs.map((j) => j.roles
    ? `<div class="item co-grp"><div class="row"><div class="rail"></div>
        <div class="col"><p class="co"><strong>${esc(j.co)}</strong> · ${esc(j.meta)}</p></div></div>
        ${j.roles.map((r) => position(r, u, false)).join('\n        ')}</div>`
    : `<div class="item">${position(j, u, true)}</div>`).join('\n    ');

  return `<a class="skip" href="#main">${esc(u.skip)}</a>
<header class="bar">
  <div class="bar-in">
    <a class="mark" href="#top" aria-label="${esc(m.name)}">I<span>.</span>A</a>
    <nav id="nav" aria-label="${esc(u.menu)}">
      ${nav}
    </nav>
    <div class="tools">
      <button class="tool" id="themeBtn" type="button" data-dark="${esc(u.dark)}" data-light="${esc(u.light)}">${esc(u.dark)}</button>
      <a class="tool" href="/${other}/" hreflang="${other}" lang="${other}" title="${esc(m.switchTitle)}">${esc(m.switchLabel)}</a>
    </div>
  </div>
</header>

<main class="wrap" id="main">
  <span id="top"></span>
  <section class="hero" id="about"><div class="row">
    <div class="rail"><span class="lbl">${esc(u.place)}</span></div>
    <div class="col">
      <h1>${esc(m.name)}</h1>
      <p class="role">${esc(d.role)}${d.roleAt ? ` <span class="at">· ${esc(d.roleAt)}</span>` : ''}</p>
      <p class="intro">${esc(d.intro)}</p>
      <div class="card">
        <div class="links">
          <a class="pri" href="mailto:${shared.email}">${shared.email}</a>
          <a href="tel:${shared.phoneHref}">${esc(shared.phoneDisplay)}</a>
          <a href="${shared.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
          <a href="${shared.github}" target="_blank" rel="noopener">GitHub</a>
        </div>
        <a class="pdf" href="/cv-${lang}.pdf" download hreflang="${lang}" type="application/pdf">${esc(u.cv)}</a>
      </div>
    </div></div></section>

  <section id="experience">${sectionHead(d.h.exp)}
    ${jobs}
  </section>

  <section id="skills">${sectionHead(d.h.skills)}
    <div class="row"><div class="rail"></div><div class="col"><div class="grid">
      ${d.skills.map((t) => `<div class="grp${t.wide ? ' wide' : ''}"><span class="lbl">${esc(t.h)}</span>
        <p${t.mono ? ' class="code"' : ''}>${list(t.text)}${t.sub ? `<span class="sub">${esc(t.sub)}</span>` : ''}</p></div>`).join('\n      ')}
    </div></div></div>
  </section>

  <section id="education">${sectionHead(d.h.edu)}
    ${d.edu.map((e) => `<div class="item"><div class="row">
      <div class="rail"><span class="yr">${esc(e.date)}</span></div>
      <div class="col"><h3>${esc(e.title)}</h3><p class="org">${esc(e.org)}</p>${e.note ? `<p class="desc">${esc(e.note)}</p>` : ''}</div>
    </div></div>`).join('\n    ')}
  </section>

  <section id="seminars">${sectionHead(d.h.sem)}
    ${d.sem.map((s) => `<div class="item tight"><div class="row">
      <div class="rail"><span class="yr">${esc(s.date)}</span></div>
      <div class="col"><h3 class="sm">${esc(s.title)}</h3><p class="org">${esc(s.org)}</p></div>
    </div></div>`).join('\n    ')}
  </section>

  <section id="languages">${sectionHead(d.h.lang)}
    ${d.languages.map((g) => `<div class="item tight lang"><div class="row">
      <div class="rail"><span class="yr">${esc(g.lvl)}</span></div>
      <div class="col"><h3 class="sm">${esc(g.name)}</h3>${g.cert ? `<p class="org">${esc(g.cert)}</p>` : ''}</div>
    </div></div>`).join('\n    ')}
  </section>

  <footer><span>© ${YEAR} ${esc(m.name)}</span><span>${bare(site.origin).replace(/^www\./, '')}</span></footer>
</main>
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
  <meta name="color-scheme" content="light dark">
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
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body class="router">
  <main class="router-card">
    <h1>404</h1>
    <p class="role">This page does not exist. <span lang="el">Η σελίδα δεν υπάρχει.</span></p>
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
/* Same content and order as the web page, set for A4. The role details
 * behind "Full scope of the role" stay on the web page; the PDF carries the
 * headline points, like the collapsed view. */
function printPage(lang) {
  const d = data[lang], m = d.meta;

  const entry = (date, title, org, bullets, note) => `
    <div class="entry">
      <div class="date">${esc(date)}</div>
      <div><h3>${esc(title)}</h3>${org ? `<p class="org">${esc(org)}</p>` : ''}${note ? `<p class="note">${esc(note)}</p>` : ''}${bullets ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>
    </div>`;
  const line = (date, title, org) => `
    <div class="line"><span class="date">${esc(date)}</span><span><b>${esc(title)}</b>${org ? ` <span class="org">· ${esc(org)}</span>` : ''}</span></div>`;

  const jobs = d.jobs.map((j) => j.roles
    ? `<div class="group"><p class="co"><strong>${esc(j.co)}</strong> · ${esc(j.meta)}</p>${j.roles.map((r) => entry(r.date, r.title, '', r.pts)).join('')}</div>`
    : entry(j.date, j.title, j.org, j.pts)).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${esc(m.name)} — CV</title>
<style>
${FONT_CSS.replace(/\.\.\/fonts\//g, 'fonts/')}
/* Two A4 pages. Each section moves to the next page whole rather than
   splitting, so the break always falls between sections. */
@page { size: A4; margin: 14mm 16mm 15mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'IBM Plex Sans',sans-serif; font-weight:400; font-size:9.2pt; line-height:1.46; color:#3C3A34; }
h1 { font-family:'Source Serif 4',Georgia,serif; font-weight:400; font-size:24pt; line-height:1.1; letter-spacing:-.014em; color:#1A1A18; }
.role { margin-top:1.8mm; font-size:10.8pt; font-weight:500; color:#1E4B6B; }
.role .at { color:#6B6860; font-weight:400; }
.contact { margin-top:2.2mm; font-size:8.6pt; color:#6B6860; }
.contact span { white-space:nowrap; }
.contact span + span::before { content:'  ·  '; white-space:pre; color:#B5B1A7; }
.intro { margin-top:4mm; font-size:9.4pt; line-height:1.55; }
section { break-inside:avoid; }
h2 { font-family:'Source Serif 4',Georgia,serif; font-weight:400; font-size:13.5pt; color:#1A1A18;
     border-bottom:.6pt solid #E2DFD6; padding-bottom:1.2mm; margin:6.5mm 0 1mm; break-after:avoid; }
.entry { display:grid; grid-template-columns:25mm 1fr; column-gap:5mm; margin-top:3.4mm; break-inside:avoid; }
.date { font-family:'JetBrains Mono',monospace; font-size:8pt; color:#6B6860; padding-top:.9mm; white-space:nowrap; }
h3 { font-family:'Source Serif 4',Georgia,serif; font-weight:600; font-size:10.8pt; line-height:1.3; color:#1A1A18; }
.org, .note { font-size:8.6pt; color:#6B6860; margin-top:.4mm; }
ul { list-style:none; margin-top:1.3mm; }
li { position:relative; padding-left:4mm; margin-top:.7mm; }
li::before { content:''; position:absolute; left:.3mm; top:.74em; width:2mm; border-top:.6pt solid #9A968C; }
.group { margin-top:3.4mm; }
.co { margin-left:30mm; font-size:8.6pt; color:#6B6860; }
.co strong { color:#1A1A18; font-weight:600; letter-spacing:.02em; }
.group .entry:first-of-type { margin-top:1.6mm; }
/* Roles at the same company: a hairline in the date column joins each date to the next. */
.group .entry { position:relative; }
.group .entry:not(:last-of-type)::after { content:''; position:absolute; left:.7mm; top:5mm; bottom:-3mm;
  border-left:.6pt solid #CFCAC0; }
.skills { display:grid; grid-template-columns:1fr 1fr; gap:3.4mm 9mm; margin:3.4mm 0 0 30mm; }
.skills .wide { grid-column:1 / -1; }
.lbl { font-family:'JetBrains Mono',monospace; font-size:7.2pt; letter-spacing:.14em; text-transform:uppercase; color:#747066; }
.skills p { margin-top:.8mm; }
.skills .code { font-family:'JetBrains Mono',monospace; font-size:8.3pt; line-height:1.6; }
.skills .sub { display:block; font-family:'IBM Plex Sans',sans-serif; font-size:8.4pt; color:#6B6860; }
.line { display:grid; grid-template-columns:25mm 1fr; column-gap:5mm; margin-top:2.2mm; }
.line .date { padding-top:.3mm; }
.line b { font-family:'Source Serif 4',Georgia,serif; font-weight:600; font-size:10pt; color:#1A1A18; }
.line .org { display:inline; margin:0; }
.online { margin-top:9mm; display:flex; align-items:center; gap:4mm; break-inside:avoid; }
.online svg { flex-shrink:0; margin-left:29mm; }
.online p { font-size:8.6pt; color:#6B6860; line-height:1.5; }
.online b { display:block; font-family:'JetBrains Mono',monospace; font-weight:400; font-size:8.6pt; color:#1A1A18; }
</style>
</head>
<body>
  <header>
    <h1>${esc(m.name)}</h1>
    <p class="role">${esc(d.role)}${d.roleAt ? ` <span class="at">· ${esc(d.roleAt)}</span>` : ''}</p>
    <p class="contact"><span>${shared.email}</span><span>${esc(shared.phoneDisplay)}</span><span>${esc(bare(shared.linkedin))}</span><span>${esc(bare(shared.github))}</span><span>${esc(d.ui.place)}</span></p>
    <p class="intro">${esc(d.intro)}</p>
  </header>

  <h2>${esc(d.h.exp)}</h2>
  ${jobs}

  <section><h2>${esc(d.h.skills)}</h2>
  <div class="skills">
    ${d.skills.map((t) => `<div class="${t.wide ? 'wide' : ''}"><span class="lbl">${esc(t.h)}</span><p${t.mono ? ' class="code"' : ''}>${list(t.text)}${t.sub ? `<span class="sub">${esc(t.sub)}</span>` : ''}</p></div>`).join('')}
  </div></section>

  <section><h2>${esc(d.h.edu)}</h2>
  ${d.edu.map((e) => entry(e.date, e.title, e.org, null, e.note)).join('')}</section>

  <section><h2>${esc(d.h.sem)}</h2>
  ${d.sem.map((s) => line(s.date, s.title, s.org)).join('')}</section>

  <section><h2>${esc(d.h.lang)}</h2>
  ${d.languages.map((g) => line(g.lvl, g.name, g.cert)).join('')}</section>

  <div class="online">${qrSvg(urlFor(lang), 20)}<p>${esc(d.ui.online)}<b>${bare(urlFor(lang))}</b></p></div>
</body>
</html>
`;
}

/* The running footer on every page: name, address of the page it came from,
 * the build month (so the PDF always says which deploy produced it) and the
 * page number. Chromium renders it outside the document, in system fonts. */
function printFooter(lang) {
  const m = data[lang].meta;
  const month = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date());
  const updated = lang === 'el' ? `Ενημέρωση: ${month}` : `Updated ${month}`;
  return `<div style="width:100%;padding:0 16mm;font-family:'IBM Plex Sans','DejaVu Sans',Helvetica,Arial,sans-serif;font-size:7pt;color:#8A867C;display:flex;justify-content:space-between;">
  <span>${esc(m.name)} · ${bare(site.origin)}/${lang}/ · ${esc(updated)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
}

/* ---------------------------------------------------- social preview image -- */
function ogPage() {
  const en = data.en;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><style>
${FONT_CSS.replace(/\.\.\/fonts\//g, 'fonts/')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#F7F6F2;color:#1A1A18;font-family:'IBM Plex Sans',sans-serif;
     padding:0 112px;display:flex;flex-direction:column;justify-content:center;position:relative}
.lbl{font-family:'JetBrains Mono',monospace;font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#747066}
h1{font-family:'Source Serif 4',serif;font-weight:400;font-size:92px;line-height:1.04;letter-spacing:-.02em;margin-top:30px}
.role{margin-top:26px;font-size:33px;font-weight:500;color:#1E4B6B}
.role span{color:#6B6860;font-weight:400}
.rule{position:absolute;left:112px;right:112px;bottom:92px;border-top:2px solid #E2DFD6;padding-top:22px;
      display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:19px;color:#6B6860}
</style></head>
<body>
  <p class="lbl">${esc(en.ui.place)}</p>
  <h1>${esc(shared.name)}</h1>
  <p class="role">${esc(en.role)}${en.roleAt ? ` <span>· ${esc(en.roleAt)}</span>` : ''}</p>
  <div class="rule"><span>${shared.email}</span><span>${bare(site.origin)}</span></div>
</body></html>
`;
}

/* -------------------------------------------------------------- assets --- */
function favicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${site.themeColor}"/>
  <text x="32" y="42" text-anchor="middle" font-family="Georgia,'Times New Roman',serif"
        font-size="28" fill="#F7F6F2" letter-spacing="1">IA</text>
</svg>
`;
}

function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [site.origin + '/', ...site.languages.map(urlFor)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
${site.languages.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.origin}/"/>
    <changefreq>monthly</changefreq>
    <priority>${u === site.origin + '/' ? '1.0' : '0.9'}</priority>
  </url>`).join('\n')}
</urlset>
`;
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

const buildCss = () => `${FONT_CSS}\n\n${readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8')}`;

async function renderBinaries() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.log('  – playwright not installed, skipping PDF/OG (run: npm i -D playwright)');
    return false;
  }
  ({ default: QR } = await import('qrcode'));
  // CHROMIUM_PATH lets a machine with its own Chromium skip `playwright install`.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext();

  for (const lang of site.languages) {
    const tmp = `.print-${lang}.html`;
    out(tmp, printPage(lang));
    const p = await ctx.newPage();
    await p.goto('file://' + join(DIST, tmp), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({
      path: join(DIST, `cv-${lang}.pdf`),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: printFooter(lang)
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
  await p.evaluate(() => document.fonts.ready);
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
