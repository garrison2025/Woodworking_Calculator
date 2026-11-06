# Woodworking Calculator — intent / keyword / indexing audit (2026-11-06)

> **Evidence grades:** Uploaded Semrush snapshot from 2026-11-04 for estimated demand only; current GitHub manifest/build rules for implementation; CI/browser and public-preview evidence must be recorded separately. Keyword Volume, KD, CPC and competitor visits are historical third-party estimates, **not current Google rankings, actual traffic, conversion or earnings**. The preview URL remains noindex until domain purchase and explicit launch approval.

## Verified scope and release boundaries

- **26 functional P0/P1 calculator routes** (9 P0 + 17 P1), five real navigation categories; each has distinct, executable HTML form, geometry result, SVG and spreadsheet/print workflow, with Node golden examples and browser QA. This is software-only validation, not certified field measurements.
- **5 P2 tasks remain HOLD** (spiral stair, gambrel roof, lumber prices, fence pickets, staves): no public tool landing or sitemap entry until independent implementation and acceptance.
- **152 user-supplied Semrush KD≤29 keyword rows** remain preserved. Exactly **139** map to the 26 active routes; **13** map to the five P2 held intents. These are research assignments, **not 139 guaranteed ranking keywords**.
- **26 distinct task-aligned SEO titles**, explicit “Typical task / Not covered” boundaries, and **78 human-reviewed next-task internal links** (three per live calculator). Link reasons explain why the linked tool is a *different* job rather than arbitrary same-category recommendations; no P2 links.
- **13 reviewed ambiguous or unsupported query intents** are excluded from on-page alias claims, while their original research rows stay untouched and traceable in `research/keyword-intent-cautions.json`.
- Preview deployment stays `noindex,nofollow,noarchive` and `robots.txt` `Disallow: /`. `RELEASE_APPROVED=1` plus an HTTPS non-`pages.dev` `SITE_URL` is required for indexing. The new offline SEO CI checks **36 intended eventual URLs** (26 tools + five categories + home + four legal/info pages) for unique canonical, `WebApplication`/`WebSite` JSON-LD, a 36-entry sitemap, and P2 isolation; this does not trigger deployment.
- **Release canonical bug found and corrected:** previously five category pages silently used `/` for canonical and schema URLs despite rendering at their category paths. `cat_page()` now passes its actual category path to `page()`; regression is checked by `tests/validate_release.py`.

## Primary keyword and dedicated landing-page titles

| Tier | Canonical task URL | Historical primary keyword | US Volume/mo (estimate) | KD | CPC USD (estimate) | Task-aligned `<title>` before site name |
|---|---|---|---:|---:|---:|---|
| P0 | `/stud-calculator/` | `stud calculator` | 3,600 | 1 | 2.49 | Gable Stud Calculator for Rake Walls |
| P0 | `/framing-calculator/` | `framing calculator` | 2,400 | 3 | 2.75 | Wall Framing Calculator with Doors and Windows |
| P0 | `/deck-board-calculator/` | `deck board calculator` | 6,600 | 12 | 1.67 | Deck Board Calculator with Board Gaps |
| P0 | `/baluster-spacing-calculator/` | `baluster spacing calculator` | 1,000 | 16 | 3.00 | Baluster Spacing Calculator for Deck Railings |
| P0 | `/rafter-calculator/` | `rafter calculator` | 4,400 | 7 | 2.38 | Rafter Calculator with Birdsmouth Geometry |
| P0 | `/crown-molding-calculator/` | `crown molding calculator` | 390 | 9 | 0.00 | Crown Molding Calculator for Miter and Bevel |
| P0 | `/soffit-calculator/` | `soffit calculator` | 1,600 | 1 | 4.28 | Soffit Calculator for Eave Drop and Depth |
| P0 | `/kerf-bending-calculator/` | `kerf calculator` | 210 | 4 | 0.00 | Kerf Calculator for Bending Cut Spacing |
| P0 | `/wainscoting-calculator/` | `wainscoting calculator` | 1,300 | 18 | 3.16 | Wainscoting Calculator for Panel Layout |
| P1 | `/stair-calculator/` | `stair treads calculator` | 1,600 | 18 | 0.00 | Stair Treads Calculator for Straight Stair Rise and Run |
| P1 | `/rise-run-calculator/` | `rise and run` | 1,300 | 20 | 0.00 | Rise and Run Calculator for Slope |
| P1 | `/deck-material-calculator/` | `deck estimator` | 3,600 | 15 | 1.67 | Deck Estimator – Deck Material Calculator |
| P1 | `/segmented-bowl-calculator/` | `segmented bowl calculator` | 260 | 17 | 0.00 | Segmented Bowl Calculator for Ring Cuts |
| P1 | `/roof-pitch-calculator/` | `pitch calculator` | 1,300 | 15 | 0.00 | Roof Pitch Calculator in Degrees and Percent |
| P1 | `/equal-spacing-calculator/` | `equal spacing calculator` | 480 | 7 | 0.00 | Equal Spacing Calculator for Layout Marks |
| P1 | `/hip-rafter-calculator/` | `hip rafter calculator` | 170 | 8 | 2.75 | Hip Rafter Calculator for Diagonal Roof Lines |
| P1 | `/hip-roof-calculator/` | `hip roof calculator` | 390 | 2 | 3.66 | Hip Roof Calculator for Sheathing Layout |
| P1 | `/wall-stud-calculator/` | `wall stud calculator` | 2,400 | 11 | 2.49 | Wall Stud Calculator for Straight Walls |
| P1 | `/shelf-spacing-calculator/` | `shelf spacing calculator` | 140 | 5 | 0.00 | Shelf Spacing Calculator with Hole Positions |
| P1 | `/gable-roof-calculator/` | `gable roof calculator` | 170 | 4 | 2.85 | Gable Roof Calculator for Area and Pitch |
| P1 | `/square-layout-calculator/` | `foundation square calculator` | 590 | 17 | 0.00 | Foundation Square Calculator for Layout Diagonals |
| P1 | `/diagonal-brace-calculator/` | `cross brace angle calculator` | 90 | 11 | 0.00 | Cross Brace Angle Calculator – Diagonal Length |
| P1 | `/hole-spacing-calculator/` | `hole spacing calculator` | 110 | 4 | 0.00 | Hole Spacing Calculator for Drill Centers |
| P1 | `/stair-stringer-calculator/` | `stair stringer calculator` | 8,100 | 20 | 0.00 | Stair Stringer Calculator for Notch Geometry |
| P1 | `/roof-sheathing-calculator/` | `roof sheathing calculator` | 590 | 3 | 3.00 | Roof Sheathing Calculator for Panel Takeoff |
| P1 | `/fence-post-calculator/` | `fence post calculator` | 880 | 16 | 1.73 | Fence Post Calculator for Post Spacing |

## Search-intent mismatches withheld from claimed synonyms

Original historical research assignments are **not rewritten**. These terms are withheld from the live page's “related search” copy until the actual feature and SERP intent support the claim.

| Historical keyword | Original proposed route | Why it needs separate task or scope verification |
|---|---|---|
| `wall framing calculator with windows and doors` | `/wall-stud-calculator/` | Door/window opening layouts belong to the separate framing calculator, not the straight-wall stud counter. |
| `wall framing calculator` | `/wall-stud-calculator/` | Ambiguous framing query; do not claim the plain stud counter covers opening-member takeoff. |
| `deck joist span calculator` | `/deck-material-calculator/` | Structural joist span capacity is not calculated; deck material geometry is not a code-approved span table. |
| `hip roof framing plan` | `/hip-rafter-calculator/` | The hip rafter page models line geometry rather than a complete roof frame design. |
| `hip roof volume calculator` | `/hip-rafter-calculator/` | Hip rafter line geometry does not output an enclosed roof volume. |
| `hip to gable calculator` | `/gable-roof-calculator/` | The gable tool estimates an existing gable roof, not a hip-to-gable conversion. |
| `shelf bracket spacing calculator` | `/shelf-spacing-calculator/` | Shelf clearance and pin locations do not size load-bearing bracket spacing. |
| `coopering calculator` | `/segmented-bowl-calculator/` | Segmented bowl ring angles are not stave/barrel coopering geometry. |
| `how to bend a plywood` | `/kerf-bending-calculator/` | A geometry kerf schedule is not a tested technique tutorial or material bending safety guide. |
| `staircase spindle spacing calculator` | `/baluster-spacing-calculator/` | Straight-reference baluster gap geometry does not calculate stair-slope-specific rail installation. |
| `rafter spacing calculator` | `/rafter-calculator/` | Computes cut dimensions, not a series of on-center rafter spacings or structural spacing recommendations. |
| `deck post spacing calculator` | `/deck-material-calculator/` | Material takeoff and joist reference centers do not establish deck post and footing locations. |
| `hip roof construction` | `/hip-rafter-calculator/` | Hip line geometry is neither a full construction plan nor structural framing design. |

## Remaining acceptance gaps

1. **External indexing is intentionally off:** No custom domain is owned and no external Google Search Console indexing, rich-result validation, ranking or real traffic has been verified. Do not call this a launched SEO site.
2. **GEO/structured-data scope:** For indexable release builds the site supplies the honest per-tool `WebApplication` schema and `WebSite` markup with canonical URLs. No review ratings, fake FAQ answers, author accreditations or unsupported product claims should be added.
3. **Task-level engineering validation:** Geometry tests and PDF rendering pass for modeled inputs; actual lumber grade/defects, structural clearance, physical saw setup, model vs real stock, and physical print ruler measurement still require field review.
4. **Next SEO research stage, separate from implementation:** Re-check selected US SERPs, topical competitors and the user-supplied regional Volume/KD/CPC through current data. Historical volume totals cannot be added as unique searchers or projected earnings.

## Traceability

- Source spec: `Woodworking_Calculator_完整开发方案_V3_20261104.md` (2026-11-04 research, 400 competitor rows in the snapshot).
- Source keyword export: `research/woodworking-keyword-map-152.csv`; original 152 rows preserved.
- Active tool specifications: `src/tools.json`; curated task mapping: `src/tool-intents.json`; flagged mismatches: `research/keyword-intent-cautions.json`.
- Static release boundary and links: `build.py`, `tests/validate_static.py`, `tests/validate_release.py`, `.github/workflows/verify.yml`.
- Function correctness: `tests/calculators.test.mjs` and specialist numerical/browser suites; all print files are generated by tests, not certified by an actual physical printer.

## 2026-11-06 — Practical intent correction and engineering regression gates

- **Research provenance:** The original `research/woodworking-keyword-map-152.csv` is unchanged. The exact query `wall framing calculator with windows and doors` (US estimated Volume 90, KD 0, CPC $3.11) was historically mapped to plain `/wall-stud-calculator/`. The curated research overlay now routes *on-page related search wording only* to the already working `/framing-calculator/` (multiple doors and windows); no new URL and no claim of a new SERP check.
- **Exclusions:** Add `deck post spacing calculator`, `rafter spacing calculator`, and `hip roof construction` to false-intent caution checks. There are now 13 flagged terms: one supported editorial reassignment, 12 withheld at their original route. The existing historical 139/13 active/P2 raw-assignment split is a dataset provenance statistic, not a count of fully satisfied search intentions.
- **Coverage controls:** The build and static validator require the corrected query to appear only on the matching opening-capable tool, and reject these 13 flagged terms from their original mismatched tool's claimed synonyms. The preview remains `noindex,nofollow,noarchive` and the offline release gate remains separate from actual domain ownership, publishing, physical stock checks, structural signoff and print ruler calibration.
- **Independent numeric guardrails:** `tests/field-acceptance-regressions.test.mjs` adds varied-pitch/ridge/seat rafter conservation, four-way crown-hand reference symmetry, hip roof slope-area/sheet-discard conservation, and stringer riser/tread endpoint checks. These confirm mathematical self-consistency only, **not** physical workshop safety or complete trade-specific installation procedures.

## 2026-11-06 — Fence Picket and Gambrel Roof promoted from researched P2

The baseline figures above refer to the prior 26/5 release. This update adds two independently implemented geometry tools: **28 active P0/P1**, **3 still held P2** (spiral staircase, lumber price, stave), maintaining the complete **152 original Semrush rows unchanged**. Gambrel truss-related queries remain explicitly excluded from the mathematical gambrel roof tool's SEO synonym claims. Fence Picket uses measured inner-post clear span and two distinct end-gap conventions; its optional stepped top is NOT a curved template. Gambrel uses two distinct symmetric slopes; it is NOT structural roof-truss design. All new routes must pass Node/browser/CSV/SVG and offline SEO release gates before publication, and the pages.dev preview remains noindex.

## 2026-11-06 — 28 task-specific field-verification prompts

Each active calculator now contains a distinct, task-aligned independent measurement checklist instruction, separate from its formula and safety disclaimer. The review instructions explicitly identify physical datums, material faces or cut coordinates to compare with CSV; no check is claimed as completed or mechanically safe. Original 152-row Semrush research dataset and preview noindex gate are unchanged.

## 2026-11-06 — remove automatic keyword-synonym marketing

The page builder previously copied up to four uncautioned search query variants from the 152-row historical Semrush export into generic “Closely related search terms include ...; the same measurements and geometry apply” sentences. This conflated *search assignment* with verified functional equivalence, even for queries not yet examined against the current SERP. That automatic copy is now **removed from all 28 active calculator pages**; primary task terms stay visible, while **only one evidence-reviewed reassignment** (“wall framing calculator with windows and doors” → opening-aware Framing) receives explicit task-specific wording. The original Semrush keyword CSV is unchanged.

Current raw route assignment counts: **145 of 152 keywords map to implemented P0/P1 pages; 7 still map to the three held P2 tool pages**. These are **not** traffic forecasts, ranking claims, or proof that 145 search intents have matching features. The 21 editorial caution records are retained; the sitemap/robots production release remains gated, and the Cloudflare pages.dev preview stays noindex,nofollow,noarchive. Static HTML and Chromium route checks explicitly prevent reintroducing generic synonym inventories.
