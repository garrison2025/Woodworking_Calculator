# Workshop Geometry Tools

**Woodworking Calculator V3 implementation · US English · Cloudflare Pages static site**

A free, browser-only woodworking measurement workspace: **9 P0 + 17 P1** routes, with live measurements, local SVG diagrams, fractional inch display, five length units (in / ft / mm / cm / m), result copy, CSV cut lists, and browser Print / Save as PDF. Five complex P2 intentions are held, not published.

> **Release status: engineering beta, not a production launch.** 264 geometry tests, 33 Chromium browser tests and visual snapshots pass. Independent physical cutting design, Safari/Firefox, printer-scale and full accessibility verification remain open. All default deployments are `noindex`.

## What is implemented

- 26 distinct static calculator URLs built from `src/tools.json`. All five length units use the same route; no duplicate unit URLs.
- Five active categories (Framing & walls, Decks & railings, Roofs & stairs, Interior finish, Woodworking). Materials category remains a P2-only planning category and has **no empty public page**.
- Search-ready prerendered HTML explaining inputs, formulas, examples, caveats and related tools.
- 152 keyword rows, with Semrush estimates and mapped URLs, saved in `research/woodworking-keyword-map-152.csv`. The owner-approved complete V3 specification is saved in `research/WOODWORKING_BUILD_SPEC_V3_20261104.md`.
- Calculators written as pure JavaScript functions (`src/calcs.mjs`). No database, paid API, third-party font or runtime backend.
- Safety policies: no unsupported structural span, official code compliance, physical 1:1 printing scale, or material springback guarantees.
- Roof sheathing now supports a clipped **single-plane sheet grid** with eave/uphill cut coordinates and a conservative purchase count, separately from the four-plane hip roof layout. No offcut reuse or engineered fastening pattern is implied.

## Local development

Requirements: **Python 3.10+** and **Node.js 18+** for tests.

```powershell
git clone https://github.com/garrison2025/Woodworking_Calculator.git
cd Woodworking_Calculator
python build.py
node --test tests/*.test.mjs
python tests/validate_static.py
npm install --no-audit --no-fund
npx playwright install chromium
npx playwright test
python -m http.server 8787 --directory dist
```

Open `http://localhost:8787`. The Playwright suite starts its own local test server and includes 26-route smoke, clipboard/export, breakpoints and UI screenshots.

## Deploy to Cloudflare Pages (preview, free plan)

1. Cloudflare Dashboard → Workers & Pages → Pages → Connect to Git.
2. Select repository `garrison2025/Woodworking_Calculator`, production branch `main`.
3. **Framework preset:** None.
4. **Build command:** `python3 build.py`.
5. **Build output directory:** `dist`.
6. **Environment variables:** none for the preview build. Do **not** enable indexing.
7. Current verified preview: [woodworking-calculator.pages.dev](https://woodworking-calculator.pages.dev/). Keep it `noindex` until a real domain and separate production approval. Browser and static QA evidence is in `QA-EVIDENCE.md`.

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
research/GEOMETRY_REFERENCE_NOTES.md  Trade reference conventions and 2-D geometry derivations
tests/validate_static.py        Static page and crawler-policy checks
tests/e2e/workspaces.spec.mjs    Actual browser/UI regression checks
playwright.config.mjs           Local Chromium test harness
.github/workflows/verify.yml    GitHub Actions: build and tests
DESIGN.md, QA-EVIDENCE.md, UI-RELEASE-EVIDENCE.md, SEO-GEO-RELEASE-EVIDENCE.md
```

## Engineering caveats

Rafter normal-notch depth and stair-stringer flooring correction now have independently derived regression tests; both still require physical construction approval. Some professional tasks are intentionally **not claimed production complete**: framing king/jack illustrations are schematic (no headers/cripples); rafter birdsmouth is a reference geometry, not a verified structural cut pattern; hip roof includes four-plane clipped sheet coordinates but does not reuse offcuts, stagger sheets or certify an installation plan; kerf bending is a trial estimate; compound crown orientations require a scrap cut. The route exists because it performs a useful bounded geometry calculation, **not** because its whole V3 physical workflow has passed acceptance.

## SEO research discipline

Source: user's Blocklayer.com Semrush US top-400 sample as of 2026-11-04. **152 distinct relevant KD≤29** keywords are research evidence, not projected new-site traffic. CPC means estimated paid search price, not AdSense income. Each keyword maps to one intended URL. All approval and release status stays in the evidence documents.

## Reference standard

Project design and QA follow the repository [Website-Starter-Standard](https://github.com/chenmu2024/Website-Starter-Standard), adapted to a high-density industrial calculator instead of a generic SaaS landing page.

## 2026-11-04 — Multi-opening wall framing improvement

- Doors and windows now have independent sill elevations and heights, with an editable wall-top reference.
- The geometry engine distinguishes clear rough-opening edges from adjacent king/jack center marks, omitting regular studs that collide with the side-member packs.
- The SVG scales each opening vertically from the same result data used for the metrics and position schedule. Reference elevations are not precut member lengths.
- CI: [run #68](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41792234356) — 228 unit tests + 18 real Chromium checks passed. Preview stays noindex; physical cutting and structural suitability have not been verified.

## 2026-11-04 — Hip roof sheet-cut layout (preview only)

- The old sheet-area lower bound is retained alongside a new **per-plane grid sheet count without offcut reuse**. For a symmetric rectangular roof, four independent slope faces are represented by two end triangles and two side trapezoids.
- The sheet grid is clipped against each face using a deterministic 2D polygon algorithm in the plane's real sloped dimensions. The same polygon points drive the SVG plan drawing and CSV coordinates. The orientation dropdown rotates sheets by 90° relative to each plane's eave.
- The table and exported CSV include **per-sheet cut vertices relative to that sheet's own local origin**. The browser preview explicitly shows only the first 160 table rows if a result is larger; the local CSV contains the full schedule and aligned columns.
- In the independent flat 192 × 96 in illustration, a 96 × 48 in sheet has a theoretical area minimum of 4 sheets; laying out each hip plane without reuse requires 6 sheets in the default direction or 12 when rotated. These are *geometric examples*, not stock optimization or structural installation advice.
- CI: [233 Node tests and 20 Chromium checks](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41793989952), including 72 dimension/pitch/orientation conservation fixtures and desktop/mobile image capture of the new hip roof page. **No physical cutting, real-world sheathing seams, full-size printing or structural certification.**

## 2026-11-04 — Single-plane roof sheathing cut layouts

A single rectangular roof face now uses actual sloped width to clip each stock sheet to the eave-origin grid. Rotation, whole/edge counts, order allowance and cut coordinates update the same SVG, table and local CSV. This is not a structural fastening/staggered-seam plan; no offcut reuse or physical 1:1 print claim is made. Verified in [GitHub Actions run #73](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41794301192).

## 2026-11-04 — Deck estimator takeoff upgrade

The separate `/deck-material-calculator/` now calculates actual parallel board row widths (including the final rip), conservative purchased stock pieces at a user-specified board length, joist *reference centerlines* and a shared dimensional 2-D SVG/CSV schedule. This is not a structural joist-span calculator, approved fastening plan or staggered joint schedule; no offcut reuse is claimed. The P0 deck-board calculator remains a simpler, separate spacing/count task.

## 2026-11-04 — Static SEO and responsive verification

Tool meta descriptions are now punctuated and length-bounded; the static release checker prevents regression of the malformed `... plan Formula, dimension diagram...` pattern. Responsive overflow checks now visit framing, deck-material and roof-sheathing workspaces at five widths, and the screenshot artifact samples all three at both desktop and mobile sizes. These are Chromium automation checks, not real-device touch or independent structural validation.

## Print scale calibration (A4 / Letter preview)

The **Print / PDF** worksheet now contains two physically sized CSS reference bars: 100 mm and 1 inch. Use Chrome's *Actual size / 100%* setting and turn off fit-to-page. Compare the printed paper bars to a reliable ruler; reject the printout if either differs by more than 0.5%. **Only these bars are physical-size references:** the SVG calculation drawing remains a scaled schematic and must NEVER be used as a 1:1 saw/cut template.

GitHub Actions exports two print evidence PDFs (Letter and A4) from headless Chromium and checks their page dimensions and browser CSS physical-unit widths. These tests do **not** verify real paper output or printer settings; actual ruler measurements remain an explicit production acceptance blocker.

Latest verified print calibration build: [CI run #81](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41799606385) — **238/238** unit tests, **23/23** Playwright checks and static validation passed; `print-calibration-pdfs` artifact contains both generated paper formats. Preview routes still use `noindex`.

## 2026-11-04 — Precision CSV schedule exports

CSV cut schedules now use the selected unit **in their column headers** (such as `Position (mm)`, `Cut Area (m²)` and `Cut Vertices (mm)`) and retain **plain machine-readable numerical coordinates** instead of rounded, locale-formatted values with mixed unit suffixes. Clipped roof polygon vertices are converted to the same selected unit as numeric cut rows. Sheet quantities and percentages remain dimensionless. The source-note row stays explicitly labeled, all columns stay consistent across nullable records, and strings which begin with spreadsheet formulas are escaped. Screen tables and SVG labels still use human-readable formatted dimensions; both use the same engine values. No paid API or data upload is involved.

## 2026-11-04 — Measurable edge-case fixes

- `/fence-post-calculator/`: the run is clearly defined **between end-post centers**. An actual clear bay must remain positive after subtracting post face width; wide posts that would overlap/touch are now rejected instead of yielding a negative opening. Every post's center and its following clear bay are exported (last post has a blank next-bay value). This is not a structural fence design.
- `/segmented-bowl-calculator/`: all ring/segment combinations now have an explicit cut schedule: ring and segment identifiers, start/end angles in degrees, miter angle in degrees, finished outer/inner chord lengths and radial depth. Repeating rings is a geometric model; no kerf, grain, glue, rough blank or optimized layout is asserted.
- CSV typing now keeps ring/segment indexes as **unitless numbers**, angles as **degrees**, and physical chord lengths in the selected unit. Browser E2E and deterministic property fixtures guard these distinctions.

Current validation: [CI #88](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41803898150) passed **247/247** Node geometry/CSV tests and **26/26** Playwright Chromium tests. The independent public preview displays the revised fence-post centerline assumptions and segmented-bowl per-piece guidance. Physical workbench testing and certified cut layouts are still excluded.

## 2026-11-04 — Shared schedule units and proportional item faces

All on-screen cut-list headers and CSV headers now come from the same typed schedule schema. Ring and segment indexes stay unitless on screen, while miter/start/end angles display degrees and coordinate/chord lengths follow the user-selected unit; heterogeneous schedule rows align by column key rather than first-row-only objects. Both baluster and fence-post schematic face widths now scale in proportion to the actual entered material width (visible strokes remain illustrative, not a 1:1 print template). Browser and Node regressions cover these distinctions.

## 2026-11-04 — Corrected shelf clearance meaning and face-level schedule

`/shelf-spacing-calculator/` now explicitly distinguishes extra reserved top/bottom clearance from the actual final end clearances after equalizing free space. Its cut list includes shelf bottom and upper surfaces plus the clear space on both sides of each shelf. The SVG renders scaled plank thickness instead of infinitely thin lines. Unit, geometry conservation and insufficient-clearance regression fixtures cover the new calculation. These are geometry aids, not load-bearing or hardware recommendations.

Latest verified release check: [CI #91](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41805332970) passed **249/249** Node tests, **28/28** Playwright Chromium tests and all noindex/static checks. A separate [CI #90](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41804993159) verified shared unit headers and proportional post/baluster face geometry. These checks are not physical material or accessibility certification.

## 2026-11-04 — Soffit rafter depth is no longer inert

The P0 `/soffit-calculator/` now uses **every user-visible input**. The datum is wall rafter-top (0 vertical drop, positive down). Projection×pitch/12 gives the top-face fall. A rafter's depth measured **normal to its roof face** becomes vertical separation between parallel surfaces using `depth×hypot(1,pitch/12)`. Vertical lining thickness and a downward-positive signed fascia adjustment are then added to the finished reference datum. The two-row worksheet and proportional roof/underside/soffit cross-section share this geometry. The model is a reference convention, not a certification of real fascia assembly, load capacity or 1:1 templates. Independent 0/2/6/9/12/24:12 slope fixtures and a browser check cover depth sensitivity and signed offset errors.

The [CI #93](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41806374873) release gate confirmed **251/251** Node geometry/CSV tests, **29/29** real Chromium browser tests and static validation. The public Cloudflare preview served the repaired soffit instructions plus the updated `assets/calcs.mjs` and `assets/app.mjs`. Every preview page retains `noindex` pending an owned production domain and separate physical review.

## 2026-11-04 — Supported deck butt seam reference geometry

The deck estimator now refuses to create **unsupported mid-bay butt joints** from arbitrary purchased stock lengths. Its deterministic per-row segment plan takes the furthest *entered joist center reference* not exceeding the board stock length, repeats as necessary, and places an end only at the last deck edge. For a 144-in deck at 16-in joist centers with 100-in stock, the reference seam is at 96 in, creating 96+48-in segments rather than 100+44-in unsupported board ends. The complete CSV includes `buttJointAtEnd`, and the SVG differentiates orange seam marks from dashed green joist centers. Stock lengths too short to reach a center are rejected; counts use actual supported segments plus optional allowance and never reuse offcuts. **This is NOT a real-world structural/seam-fastening design:** seams are identical across all rows (not staggered), and joist widths, double-joist blocking, fasteners, end gaps and structural span limits require separate inspection.

Latest verified build: [CI #95](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41809838176) passed **254/254** geometry/CSV unit tests and **29/29** Playwright Chromium checks with **36 HTML pages**, **26 enabled tools** and **152 research keyword rows**. The live Cloudflare deck estimator page serves the updated joist-seam guidance and retains `noindex,nofollow,noarchive`. Physical build and joint-bearing suitability remain excluded from CI.

## 2026-11-04 — True-radius longitudinal drill layout

The hole-spacing tool now reports **center pitch, clear solid material between drilled holes and leftover solid wood at each end**. Each downloadable schedule row includes the hole center, left/right hole edge and clearance to the previous hole; all use the selected physical unit. The SVG displays true circular hole footprints using a *single isotropic scale* shared with each center tick, shrinking the diagram width if a large diameter would otherwise clip the fixed viewport. The end-center setback is NOT equal to the end material margin (`margin=setback−diameter/2`). Tests cover independent 100 mm geometry, varied hole counts and diameters, exact tangent holes and negative clearances. This is longitudinal-only geometry: board width, across-grain edge clearance, material strength, clamps, drill runout, physical paper-scale correctness and safe machining are excluded.

**Drilling guide validation:** [CI #98](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41810910456) passed **257/257** Node geometry/CSV checks and **30/30** real Chromium browser tests. New 100 mm/5 mm fixtures independently verify four hole centers, outer edge coordinates, 25 mm clear material and 2.5 mm end margin. The CSV output normalizes metric length conversion tails under one millionth of a millimeter without modifying the geometry engine. The publicly served Hole Spacing page has updated method text and keeps `noindex,nofollow,noarchive`. Cross-width edge spacing and real physical drilling remain NOT VERIFIED.

## 2026-11-04 — Kerf continuity and flat-board slit checks

The P0 kerf-bending trial plan enforces strictly positive retained continuous wood and rejects touching/overlapping saw mouths on the flat arc reference. Schedule rows now include kerf center, left/right mouth limits, nominal depth, remaining web and idealized maximum closure; calculated average planned turn is reported separately. The selected radius is only a reference arc, not a guaranteed finished bend or neutral axis. Stock failure, springback, wood grain, physical cuts and paper-scale printing remain unverified.

### 2026-11-04 — Kerf plan release QA

[GitHub Actions #103](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41812557680) passed **259/259** Node geometry/CSV tests, **31/31** real Chromium browser tests and all 36-page/26-tool/152-keyword static checks. Tests include physical cut-mouth overlap rejection, strictly positive continuous wood web, idealized turn estimate and coordinate conservation, proportional stock/web/slot SVG, unit-aware CSV and invalid-input recovery. The site is still a **noindex engineering beta**, not a construction-grade springback estimator or a 1:1 cutting template. Independent woodworking trials, printer checks, Safari/Firefox, screen reader and real mobile device testing are not complete.

The additional coordinate-resolution guard is covered by [CI #106](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41812985103), which passed **260/260** Node tests and **31/31** Chromium tests. Kerf mouth, cut depth and web thinner than the engine's reliable cut-list coordinate resolution are explicitly rejected rather than being exported as zero. All 26 tools and 152 mapped keyword rows retain the unindexed Cloudflare preview policy.

## 2026-11-05 — Crown cut references and true nominal stair geometry

- `/stair-stringer-calculator/`: stair profile SVG now uses exactly the same **2×riser-count** nominal step vertices derived by the geometry engine. The nominal notch pitch-line from first tread to upper landing is distinguished from the **longer floor-to-floor diagonal, which is NOT a stringer cutting/stock length**. The bottom-finish trim marker is independent from the nominal riser profile. For 105-in rise / 14 risers / 10-in treads: 13 runs spanning 130 in, notch pitch-line **162.5 in**, floor chord **167.10775 in**, bottom trim **6 in** with 1.5-in tread stock and no later lower finish. These are geometric references, not approved fabrication, bearing or structural stock lengths.
- `/crown-molding-calculator/`: corner side and left/right reference are explicit selections. Flat-saw geometry magnitudes remain 31.619° / 33.863° for 38° spring and 90° corner, while the illustrative plan sign and SVG reference orientation can flip. A one-row degree-labelled CSV records chosen reference and both angle magnitudes. Signed diagrams are **NOT saw left/right or crown flip/fence instructions**; independently verify the saw, crown profile, installation side and scraps.
- [CI #118](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41929865892) validated **264 Node** and **33 real-browser Chromium** cases, 26 tool URLs, 36 static pages, 152 KD≤29 research rows and preview `noindex`. Independent real cutting, printer scale, Safari/Firefox and actual mobile/device accessibility remain unverified.
