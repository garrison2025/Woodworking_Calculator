# Workshop Geometry Tools

**Woodworking Calculator V3 implementation · US English · Cloudflare Pages static site**

A free, browser-only woodworking measurement workspace: **9 P0 + 17 P1** routes, with live measurements, local SVG diagrams, fractional inch display, millimeter conversion, result copy, CSV cut lists, and browser Print / Save as PDF. Five complex P2 intentions are held, not published.

> **Release status: engineering beta, not a production launch.** Core formulas and static routes are under automated test, but actual cross-browser operation, physical cut-template scale and complex construction details require verification. All default deployments are `noindex`.

## What is implemented

- 26 distinct static calculator URLs built from `src/tools.json`. Both unit systems use the same route; no duplicate metric URL.
- Five active categories (Framing & walls, Decks & railings, Roofs & stairs, Interior finish, Woodworking). Materials category remains a P2-only planning category and has **no empty public page**.
- Search-ready prerendered HTML explaining inputs, formulas, examples, caveats and related tools.
- 152 keyword rows, with Semrush estimates and mapped URLs, saved in `research/woodworking-keyword-map-152.csv`. The owner-approved complete V3 specification is saved in `research/WOODWORKING_BUILD_SPEC_V3_20261104.md`.
- Calculators written as pure JavaScript functions (`src/calcs.mjs`). No database, paid API, third-party font or runtime backend.
- Safety policies: no unsupported structural span, official code compliance, physical 1:1 printing scale, or material springback guarantees.

## Local development

Requirements: **Python 3.10+** and **Node.js 18+** for tests.

```powershell
git clone https://github.com/garrison2025/Woodworking_Calculator.git
cd Woodworking_Calculator
python build.py
node --test tests/*.test.mjs
python tests/validate_static.py
python -m http.server 8787 --directory dist
```

Open `http://localhost:8787`.

## Deploy to Cloudflare Pages (preview, free plan)

1. Cloudflare Dashboard → Workers & Pages → Pages → Connect to Git.
2. Select repository `garrison2025/Woodworking_Calculator`, production branch `main`.
3. **Framework preset:** None.
4. **Build command:** `python3 build.py`.
5. **Build output directory:** `dist`.
6. **Environment variables:** none for the preview build. Do **not** enable indexing.
7. Open the generated `*.pages.dev` preview URL. Confirm calculator functions, SVG and CSV, mobile viewport and Chrome printing.

For most Cloudflare Pages Python build environments Python is already available. If a platform build image does not provide Python, configure its version or a supported build image before deploying. Do not claim deployment succeeded until the Pages build log and preview response are checked.

### Production SEO gate (do not activate prematurely)

After the custom domain is registered, attached to Pages and the actual mobile/geometry/print QA is complete, configure the production build:

```text
SITE_URL=https://YOUR-REAL-DOMAIN.com
RELEASE_APPROVED=1
```

`SITE_URL` must be a real owned HTTPS custom domain, **not** a Pages preview URL. Production then generates absolute canonical URLs, sitemap.xml and an allow-crawl robots.txt. The Pages-provided hostname may still serve identical static bytes, so separately validate your hostname/redirect and canonical policy before submitting the site to GSC. There is no mythical fully automatic “verified launch” switch.

## Project structure

```text
build.py                         Static HTML/SEO generator
src/tools.json                   One intent/route registry, defaults, formula descriptions
src/calcs.mjs                    26 browser-only calculation functions
src/app.mjs                      Inputs, SVG drawing, export and print interactions
src/style.css                    Responsive design and printable stylesheet
research/WOODWORKING_BUILD_SPEC_V3_20261104.md
research/woodworking-keyword-map-152.csv
tests/calculators.test.mjs       Independent default fixtures, input errors and invariants
tests/validate_static.py        Static page and crawler-policy checks
.github/workflows/verify.yml    GitHub Actions: build and tests
DESIGN.md, QA-EVIDENCE.md, UI-RELEASE-EVIDENCE.md, SEO-GEO-RELEASE-EVIDENCE.md
```

## Engineering caveats

Some professional tasks are intentionally **not claimed production complete**: framing king/jack illustrations are schematic (no headers/cripples); rafter birdsmouth is a reference geometry, not a verified structural cut pattern; hip roof sheets are an area lower-bound, not true sheet nesting; kerf bending is a trial estimate; compound crown orientations require a scrap cut. The route exists because it performs a useful bounded geometry calculation, **not** because its whole V3 physical workflow has passed acceptance.

## SEO research discipline

Source: user's Blocklayer.com Semrush US top-400 sample as of 2026-11-04. **152 distinct relevant KD≤29** keywords are research evidence, not projected new-site traffic. CPC means estimated paid search price, not AdSense income. Each keyword maps to one intended URL. All approval and release status stays in the evidence documents.

## Reference standard

Project design and QA follow the repository [Website-Starter-Standard](https://github.com/chenmu2024/Website-Starter-Standard), adapted to a high-density industrial calculator instead of a generic SaaS landing page.
