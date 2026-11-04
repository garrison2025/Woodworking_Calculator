# QA evidence — 2026-11-04 (deployed preview)
## Executed / PASS
- **GitHub Actions:** [run #95](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41809838176) passed on `main` (commit `baff57c9`).
- **Geometry:** **254 / 254** Node unit tests passed; 26 default numerical fixtures, 5-unit round-trip invariants, valid/invalid boundary checks and targeted regressions. This does not constitute independent structural engineering verification.
- **Real Chromium browser:** **29 / 29** Playwright E2E checks passed, including actual initial JS output and SVG on every one of the 26 routes, deck final rip (1.875 in), change→recalculate, five unit choices (in/ft/mm/cm/m), export downloads, clipboard and print-event wiring, local-only asset requests, zero page-level overflow at 360, 390, 768, 1024 and 1440 px, and actual desktop/mobile screenshots.
- **Prerender:** **36 HTML pages** built: 26 calculators, five categories, four informational/legal pages and homepage; five P2 routes deliberately withheld.
- **Static SEO:** verified distinct titles, valid links, one H1, 152 distinct mapped keyword rows with KD≤29, default noindex, preview robots disallow, no preview sitemap or fake canonical.
- **Observed live preview:** https://woodworking-calculator.pages.dev/ and `/stud-calculator/` were publicly accessible. The current preview displays evaluated formulas and five unit options. Public meta robots is `noindex,nofollow,noarchive`; `robots.txt` says `User-agent: *\nDisallow: /`.
- **UI snapshot artifact:** [run #76](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41798293682) generated 18 automatic full-page desktop/mobile screenshots across nine representative routes. Screenshots were captured, not individually manually approved.

## Remaining release blockers / NOT RUN
- Independent physical geometry and reference cutting verification for birdsmouth, compound crown saw handedness, kerf/springback, hip roof sheet nesting, stairs, framed openings and actual material stock.
- Physical 1:1 print ruler and paper scaling validation; site explicitly calls SVG a scaled schematic, **not** a verified full-size template.
- Real mobile touch testing, screen-reader/keyboard accessibility audit beyond basic Playwright controls, Safari/Firefox, WCAG contrast measurement.
- Production Lighthouse/Core Web Vitals, GSC, AdSense, canonical and actual custom-domain redirects (no domain has been purchased).

**Release state:** engineering preview **PASS for automated smoke and core math**; full production and physical cut-template acceptance **NOT COMPLETE**. All preview routes remain `noindex` until separate launch authorization.

## Geometry extension — additional verified calculations
- Rafter uses ridge-adjusted line length, horizontal seat rise and **normal** notch depth `seat×sin(atan(pitch/12))` with a remaining-section geometry check. Reference fixtures include 6:12, 12:12 and an impossible section.
- Straight stair stringer computes all riser/tread coordinates, nominal throat, and bottom layout rise `unitRise−treadThickness+lowerFinishInstalledLater`. Both changed inputs and live display were exercised in Chromium.
- Trade reference conventions and source links: `research/GEOMETRY_REFERENCE_NOTES.md`. **Structural suitability and physical print scale remain unverified.**

## Framing upgrade (commit 2526c90; run #68)
- PASS (CI): individually elevated doors/windows, removal of overlapping regular on-center studs, king/jack center coordinates, rough opening area, and invalid wall combinations.
- PASS (Chromium): second opening inputs, two SVG cutouts and height-overflow error.
- NOT RUN: physical cutting, structural headers/cripples, real touch and browser cross-checks.

## Hip roof polygon layout — verified in CI (run #41793989952)
- **PASS, core geometry:** four face polygons, sheet clipping, area conservation, non-overlap of tile ownership by plane, valid sheet-coordinate bounds, both orientation options, the 4-versus-6-versus-12 fixture, transposed footprints and square roofs.
- **PASS, extended properties:** 72 width/length/pitch/orientation configurations conserve the analytical sloped area; overly dense sheet grids and invalid orientations fail with safe validation errors.
- **PASS, browser:** live SVG sheet polygons, orientation select, full table/CSV export pathway with consistent columns, display updates and error recovery; desktop/mobile screenshots captured via Playwright on six pages.
- **NOT RUN:** offcut reuse algorithms, real sheet stagger/joint installation, fastening, roof underlayment, structural/sheathing code review, verified full-size print templates, physical stock fitting or measurements on real devices.
- This run tested the generated GitHub Pages-ready dist, **not** a verified updated Cloudflare deployment. The site's preview noindex rules remain unchanged.

## Rectangular sheathing upgrade — commit b4e4e1b, run #73
- PASS: sloped area conservation, full/partial sheet grids, 90-degree orientation, grid limit and quantity allowance, with 235/235 Node unit checks.
- PASS: 21/21 Chromium checks, including SVG cuts, 8-to-6 orientation change, CSV export and invalid-input behavior.
- PASS: public Cloudflare preview serves updated roof sheathing description and orientation control with noindex metadata.
- NOT RUN: real sheet cutting, nail/seam/structural review, browser-PDF scale calibration, real-device touch or production GSC indexing.

## Deck material and metadata regression — CI #76
- PASS: 238/238 Node tests, including actual final-rip width, shortened joist end bay, stock segment coordinates, piece counts, and rejection of unbounded segmentation.
- PASS: 22/22 Chromium checks, with deck-material SVG and CSV reaction to stock edits, error recovery, and horizontal overflow checks at 360/390/768/1024/1440px on five page types.
- PASS: generated static HTML has unique H1/title/description; all tool descriptions end with punctuation and do not contain the former malformed `... plan Formula, dimension ...` phrase. Preview remains noindex, 26 calculator routes and 5 P2 holds.
- PASS (captured by CI): 18 desktop/mobile page screenshots across nine routes; not a substitute for manual full-visual audit or real touch testing.
- LIVE OBSERVATION (rechecked after deployment): the public Cloudflare Pages paths `/deck-material-calculator/` and `/roof-sheathing-calculator/` both served their repaired, punctuated meta descriptions with no old `Formula, dimension` concatenation. Both continue to declare `noindex,nofollow,noarchive`. This confirms these two pages' metadata propagation, but does not certify all 26 pages or production indexing.
- NOT RUN: physical board layout, seam/fastener support inspection, actual printable scale proof, real-device/mobile browser matrix, production domain indexing.

## Printed scale verification — CI #81 / commit a2bcd48
- PASS: Browser print mode exposes both CSS physical ruler widths (100 mm and 1 in) and hides navigation. Chromium generated Letter and A4 PDF bytes with MediaBox checks within ±0.2% of nominal dimensions.
- PASS: [CI #81](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41799606385): 238/238 Node unit tests, 23/23 browser tests and static page validation. The short-lived `print-calibration-pdfs` artifact is uploaded in the same run.
- PASS (public preview): `/stud-calculator/` and `/roof-sheathing-calculator/` were fetched independently with the calibration elements present; both retain `noindex,nofollow,noarchive`.
- NOT RUN: Actual physical printer ruler measurements on A4/Letter; no drawing is a certified 1:1 cutting template.

## Precision CSV exports — CI #84 (2026-11-04)
- PASS: [run #84](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41800799208), commit `2774dc84`: **242/242** Node unit tests, **24/24** real Chromium browser tests and static HTML checks.
- PASS: selected length units in CSV column headers, raw numeric values (no formatted unit suffixes or thousands separators), area units (m² or ft²), appropriately converted hip-roof clipped polygon coordinates, nullable heterogeneous rows, signed numeric values and spreadsheet-formula-safe text cells.
- PASS: browser downloads for stud millimeters, hip-roof polygon millimeters and a no-schedule roof-pitch metric fallback; full CSV streams were inspected in the browser tests.
- PASS (public Cloudflare preview): `/assets/cut-list.mjs` and `/assets/app.mjs` were independently fetched and contain the new export-module integration. This verifies asset deployment, not file downloads on every real browser/device.
- NOT RUN: Excel desktop / LibreOffice desktop import compatibility, non-Chromium downloads, professional field certification. The source engine may already round coordinates to its own documented precision; export avoids additional locale rounding.

## Fence-post and segmented-bowl boundary verification — CI #88
- PASS: [CI #88](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41803898150) — **247/247** deterministic Node unit tests and **26/26** live-browser Chromium tests; static HTML validation still passes with 26 calculators, 36 pages and 152 keyword rows. Preview robots remains noindex.
- PASS: fence-post now rejects post faces that overlap or touch at the actual fitted OC interval. New regression exercises 20 length/spacing combinations, first/last center coordinates, final null bay and CSV clear-bay outputs.
- PASS: segmented-bowl produces per-piece schedule rows covering repeated rings; regression checks n=3/6/12/24/48/180, 1/2/4 rings, chord formula, radial depth and full 0–360° segment sweeps. CSV ring and segment indexes stay dimensionless; the three angle fields carry degrees; chord lengths use the selected unit.
- PASS (browser): fence invalid-to-valid recovery, unit switch and CSV; bowl ring count changes, metric angles and dimensions, and invalid inside diameter handling.
- PASS (public preview static content): revised published descriptions of `/fence-post-calculator/` and `/segmented-bowl-calculator/` and `noindex,nofollow,noarchive` observed. This does not independently exercise every deployed browser interaction, which is exercised in Chromium CI.
- NOT RUN: physical on-site fence clear-space measurement, turning stock layout, grain/kerf/glue allowance, actual saw cut reference measurements, Safari/Firefox and real devices.

## Shared table typing, proportional item faces, reserved shelf clearances — CI #90–91
- PASS (CI #90): on-screen table and CSV share a typed column model. Ring/segment identifiers are plain counts, angle fields carry degrees, lengths carry the selected physical unit, area and clipped vertices have explicit unit descriptions. Mixed-row columns are keyed consistently. Dynamic marks for fence posts and balusters use entered material face widths rather than constant 7-pixel rectangles.
- PASS (CI #91): [run #91](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41805332970), **249/249** Node unit and **28/28** real Chromium browser checks. Shelf rows now record top/bottom faces plus clear spaces directly below/above; actual top and bottom openings are clearly distinguished from user-entered *additional minimum reserves*. Property fixtures across 1, 2, 3, 5 and 10 shelves conserve case height and maintain thickness.
- PASS (public preview static): `/shelf-spacing-calculator/` serves revised minimum-reserve field labels and explained real clearances. `/segmented-bowl-calculator/` and `/fence-post-calculator/` also remain reachable. All three observed responses retain `noindex,nofollow,noarchive`.
- NOT RUN: manual ruler measurements or real stock fits, all-browser device matrix, Safari/Firefox, screen-reader audit, building code or load capacity. Shelf SVG and post faces remain scaled schematics, not full-size physical prints.

## Soffit reference-plane calculation and drawing — CI #93
- PASS (251 Node fixtures, 29 real Chromium tests): `soffit-calculator` now uses the formerly inert `depth` input and explicitly separates slope fall, rafter-normal stock depth converted to same-station vertical separation, eave underside drop, vertical lining thickness and signed fascia datum offset.
- PASS (independent geometric invariant): across pitch 0, 2, 6, 9, 12 and 24 rise-per-12, calculated same-station vertical separation divided by `hypot(1,pitch/12)` recovers the entered rafter normal depth. Zero depth, doubled depth, negative fascia offset and excessive negative offset are covered by regression.
- PASS (browser): the default 24-in, 6:12 fixture gives 12-in roof fall and 18.6492-in finished reference drop using 5.5-in normal stock, 0.5-in vertical lining and zero fascia offset. Doubling stock depth to 11 in changes the result to 24.7984 in. SVG includes identifiable rafter and finish datum elements; metric CSV includes matched coordinates; invalid offsets clear the diagram.
- PASS (public Cloudflare page/JS propagation): `/soffit-calculator/` served the new explanatory geometry text, while `assets/calcs.mjs` and `assets/app.mjs` exposed the new `soffit-section` branch. Public meta robots remained `noindex,nofollow,noarchive`.
- NOT RUN: independent site-specific fascia/lining assembly inspection, physical ruler/print validation, structural support/fastening checks, real-device touch, WebKit/Firefox compatibility, engineering signoff. These dimensions describe a **named reference-datum convention**, not a universal soffit construction method.

## Deck board butt seam centerline alignment — CI #95
- PASS: [CI #95](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41809838176) — **254/254** Node tests, **29/29** Chromium Playwright tests and 36-page/152-keyword noindex static validation.
- PASS: With 144-in rows, 16-in joist centers and 100-in stock, every deck row is split into **96 + 48 in** segments at a **96-in** joist-center reference instead of unsupported 100 + 44-in ends. The CSV `buttJointAtEnd` field and SVG `.deck-plan-seam` marks identify the reference cut.
- PASS: Board counts are based on actual supported segments; no offcut reuse. Invalid stock shorter than the first reachable joist center is rejected, including altered joist-spacing cases; valid/invalid input changes clear and restore all seam drawing marks.
- PASS: deterministic property fixtures across multiple deck lengths, joist center intervals and stock lengths independently check whole-run conservation, positive segments, maximum stock lengths, and actual joist-center membership for every intermediate joint.
- PASS (public Cloudflare preview content): `/deck-material-calculator/` serves the revised seam-support description, warnings about unstaggered joins and `noindex,nofollow,noarchive`.
- NOT RUN: physical decking seam bearing, joist section width, double-joist/blocking, end gaps, material deflection, fastener schedule, code-compliant joist spans, full-size printing and Safari/Firefox/real-device tests. A shared seam location across every row is a computation/reference fixture, **not a recommended field seam pattern**.
