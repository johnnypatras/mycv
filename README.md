# ialexopoulos.org

Bilingual personal CV site. Static, no framework, no runtime dependencies.
Hosted on GitHub Pages at <https://www.ialexopoulos.org>.

## Updating the CV

**All content lives in one file: [`data/cv.json`](data/cv.json).**
Edit it, commit, push. GitHub Actions rebuilds and deploys within about a minute.

Adding a job means adding one object at the top of `jobs` — in both the `en`
and `el` blocks. `scope` is optional: it becomes the "Full scope of the role"
panel on the web page and is left out of the PDF.

```json
{
  "date": "2026 — Now",
  "title": "Head of Something",
  "org": "Company · Greece",
  "pts": ["Headline point", "Headline point"],
  "scope": [{ "h": "Operations", "items": ["Detail", "Detail"] }]
}
```

Several roles at one company go in a group, shown under one company line:

```json
{ "co": "Company", "meta": "Greece · 2015 — 2025", "roles": [ { …role… }, { …role… } ] }
```

Everything downstream follows automatically: both web pages, both PDFs, the
structured data for search engines and the sitemap.

## Local development

```bash
npm install --include=dev      # NODE_ENV=production is set in this shell,
                              # so --include=dev is required
npx playwright install chromium

npm run build                 # full build → dist/
npm run build:fast            # skip PDF and preview image (no Chromium needed)
npm run check                 # validate links, anchors and meta tags
npm run serve                 # build and serve on http://localhost:4321
```

## LaTeX versions

`npm run latex` writes `latex/cv-en.tex` and `latex/cv-el.tex` from the same
`data/cv.json` — classic moderncv, as in the original CVs — and compiles them
with XeLaTeX when it is installed (MacTeX here). The `.tex` files are committed,
so they also open on Overleaf (set the compiler to XeLaTeX). The compiled PDFs
stay local and are not part of the website build.

## What gets built

| Output | Purpose |
|---|---|
| `/` | Language router — links to both, forwards first-time visitors, `x-default` for search engines |
| `/en/`, `/el/` | Fully rendered pages, each with its own `<html lang>`, canonical URL and `hreflang` pair |
| `/cv-en.pdf`, `/cv-el.pdf` | Two-page A4 PDFs from the same data, rendered by headless Chromium; the footer carries the build month |
| `/og.png` | 1200×630 link preview card for LinkedIn, WhatsApp, Slack |
| `/sitemap.xml`, `/robots.txt` | Search engine discovery |
| `/fonts/*.woff2` | Self-hosted fonts — no request ever leaves for a third party |
| `/404.html` | Not-found page |

## Notes on the two things that are easy to get wrong

**Greek glyphs.** Source Serif 4, IBM Plex Sans and JetBrains Mono all have
native Greek, so both languages use the same three families. Each is split
into Latin, Latin Extended and Greek files scoped with `unicode-range`, so the
English page never downloads the Greek files.

**Greek capitals.** Greek drops accents when set in capitals (ΕΜΠΕΙΡΙΑ, not
ΕΜΠΕΙΡΊΑ). Browsers only apply that rule to `text-transform: uppercase` when
the content language is declared, which is one reason each language has its
own page and its own `<html lang>` rather than a JavaScript toggle.

## Layout

```
data/cv.json              all content, both languages
src/styles.css            the design; colour tokens on :root, dark mode included
src/app.js                theme toggle, scroll-spy — progressive enhancement only
build.mjs                 the generator
check-links.mjs           post-build validation
latex/                    moderncv CVs generated from cv.json
.github/workflows/        build, validate, deploy
```
