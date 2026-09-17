# ialexopoulos.org

Bilingual personal CV site. Static, no framework, no runtime dependencies.
Hosted on GitHub Pages at <https://www.ialexopoulos.org>.

## Updating the CV

**All content lives in one file: [`data/cv.json`](data/cv.json).**
Edit it, commit, push. GitHub Actions rebuilds and deploys within about a minute.

Adding a job means adding one object under `experience.items` — in both the
`en` and `el` blocks:

```json
{
  "date": "2026 — Now",
  "title": "Head of Something",
  "company": "Company, Greece",
  "desc": "One or two sentences.",
  "tags": ["Tag", "Tag"]
}
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

## What gets built

| Output | Purpose |
|---|---|
| `/` | Language router — links to both, forwards first-time visitors, `x-default` for search engines |
| `/en/`, `/el/` | Fully rendered pages, each with its own `<html lang>`, canonical URL and `hreflang` pair |
| `/cv-en.pdf`, `/cv-el.pdf` | Real A4 PDFs rendered by headless Chromium — identical in every browser |
| `/og.png` | 1200×630 link preview card for LinkedIn, WhatsApp, Slack |
| `/sitemap.xml`, `/robots.txt` | Search engine discovery |
| `/fonts/*.woff2` | Self-hosted fonts — no request ever leaves for a third party |
| `/404.html` | Not-found page |

## Notes on the two things that are easy to get wrong

**Greek glyphs.** Libre Baskerville and Karla have no Greek characters at all.
Literata and Commissioner are layered behind them in the font stack and scoped
with `unicode-range`, so Greek text renders in a real typeface and the Greek
fonts are never downloaded on the English page.

**Greek capitals.** Greek drops accents when set in capitals (ΕΜΠΕΙΡΙΑ, not
ΕΜΠΕΙΡΊΑ). Browsers only apply that rule to `text-transform: uppercase` when
the content language is declared, which is one reason each language has its
own page and its own `<html lang>` rather than a JavaScript toggle.

## Layout

```
data/cv.json              all content, both languages
src/styles.css            the original design, unchanged
src/additions.css         additions layered on top
src/app.js                theme, menu, scroll-spy — progressive enhancement only
build.mjs                 the generator
check-links.mjs           post-build validation
.github/workflows/        build, validate, deploy
```
