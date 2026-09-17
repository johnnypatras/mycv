#!/usr/bin/env node
/**
 * Post-build sanity check. Runs in CI before anything is deployed.
 *  - every internal href/src resolves to a file that exists in dist/
 *  - both languages expose the same set of section anchors
 *  - required SEO tags are present on every page
 *  - external links are syntactically valid https URLs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const errors = [];
const warn = [];

if (!existsSync(DIST)) {
  console.error('dist/ does not exist — run `npm run build` first.');
  process.exit(1);
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const rel = (p) => p.slice(DIST.length) || '/';

/* ------------------------------------------------ internal link resolution */
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);

  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) {
      if (ref.startsWith('http:')) warn.push(`${rel(page)} → plain http link: ${ref}`);
      continue;
    }
    const target = ref.startsWith('/')
      ? join(DIST, ref)
      : resolve(dirname(page), ref);
    const candidates = [target, join(target, 'index.html')];
    if (!candidates.some(existsSync)) {
      errors.push(`${rel(page)} → broken internal link: ${ref}`);
    }
  }

  /* -------------------------------------------------- required meta tags */
  const needs = page.includes('404') ? [] : ['rel="canonical"', 'og:title', 'og:image'];
  for (const tag of needs) {
    if (!html.includes(tag)) errors.push(`${rel(page)} → missing ${tag}`);
  }
  if (!/<html lang="[a-z-]+"/.test(html)) errors.push(`${rel(page)} → missing <html lang>`);
  if (!page.includes('404') && !html.includes('hreflang="x-default"')) {
    errors.push(`${rel(page)} → missing hreflang x-default`);
  }
}

/* ------------------------------------------------- anchors match per lang */
const anchorsOf = (lang) => {
  const html = readFileSync(join(DIST, lang, 'index.html'), 'utf8');
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]).sort().join(',');
};
try {
  const en = anchorsOf('en');
  const el = anchorsOf('el');
  if (en !== el) errors.push(`section anchors differ:\n    en: ${en}\n    el: ${el}`);
} catch (e) {
  errors.push('could not compare language pages: ' + e.message);
}

/* ------------------------------------------------------- expected assets */
for (const must of ['index.html', 'en/index.html', 'el/index.html', 'sitemap.xml',
                    'robots.txt', 'favicon.svg', 'CNAME', 'assets/site.css', 'assets/app.js']) {
  if (!existsSync(join(DIST, must))) errors.push(`missing required file: ${must}`);
}
for (const opt of ['cv-en.pdf', 'cv-el.pdf', 'og.png']) {
  if (!existsSync(join(DIST, opt))) warn.push(`not built: ${opt}`);
}

/* --------------------------------------------------------------- report */
warn.forEach((w) => console.log(`  warn  ${w}`));
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  errors.forEach((e) => console.error(`  FAIL  ${e}`));
  process.exit(1);
}
console.log(`\nchecked ${pages.length} pages, ${files.length} files — all good`);
