# QA evidence — 2026-11-05 (deployed preview)
## Executed / PASS
- **GitHub Actions:** [run #127](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41932935822) passed on `main` (commit `285a013f`).
- **Geometry:** **270 / 270** Node unit tests passed; 26 default numerical fixtures, 5-unit round-trip invariants, valid/invalid boundary checks and targeted regressions. This does not constitute independent structural engineering verification.
- **Real Chromium browser:** **36 / 36** Playwright E2E checks passed, including actual initial JS output and SVG on every one of the 26 routes, deck final rip (1.875 in), change→recalculate, five unit choices (in/ft/mm/cm/m), export downloads, clipboard and print-event wiring, local-only asset requests, zero page-level overflow at 360, 390, 768, 1024 and 1440 px, and actual desktop/mobile screenshots.
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

## Hole spacing edge coordinates and circle diagrams — CI #98
- PASS: [CI #98](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41810910456) — **257/257** Node unit tests, **30/30** Chromium browser tests, **36** HTML pages, **26** active calculators, **152** keyword rows and preview `noindex` static validation.
- PASS: independent metric fixture (100 mm board, four 5 mm diameter holes, 5 mm end-center setback) yields 30 mm pitch, 25 mm between-hole clear wood and 2.5 mm end margin. The four left/right hole edges are 2.5–7.5, 32.5–37.5, 62.5–67.5 and 92.5–97.5 mm. Property tests check assorted counts, diameters, setbacks and zero-gap tangent holes; overlap/stock overflow is rejected.
- PASS: browser SVG now renders holes as isotropically scaled circles with aligned center ticks rather than infinite vertical marks; changing diameter changes both graphic radius and spacing constraints. CSV contains center, left/right edge, diameter and previous-hole clearance in the selected unit. Invalid entries clear marks and schedule.
- PASS: the CSV presentation layer normalizes metric floating-point conversion tails (e.g. `4.999999906 mm` to `5 mm`) only to **6 decimal places for mm**, 7 for cm and 10 for m; the source geometry engine and input measurements are not rounded anew. Initial browser test surfaced the issue; CI #98 passes after correction.
- PASS (public Cloudflare preview): updated `/hole-spacing-calculator/` title/description and source explanations and deployed `/assets/cut-list.mjs` metric normalization observed; preview still explicitly `noindex,nofollow,noarchive`.
- NOT RUN: actual physical drilled holes and their tolerance, transverse stock width and edge clearance, material strength, proper clamping, drill runout, real paper print scale, Safari/Firefox and assistive technology audits. The SVG is schematic, not a full-size drill template.

## Kerf trial geometry — CI #106 (2026-11-04)
- PASS: [CI #106](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41812985103) **260/260** Node tests, **31/31** Chromium browser tests, 36 prerendered pages, 26 active calculators, five P2 holds and 152 mapped search keywords; preview meta robots remains `noindex,nofollow,noarchive`.
- PASS: `kerf-bending-calculator` rejects zero retained web, overlapping/touching kerf mouth geometry, and web/cut depth/saw width smaller than the 1e-8 in cut-coordinate rounding resolution; exported mouth edges and remaining web stay positive.
- PASS: explicit developed reference arc, per-cut mouth edges, nominal cut depth, preserved web and maximum idealized closure in the typed schedule; browser confirms physical slot section uses one scale on both axes, material ratio, metric CSV headers, invalid-to-valid recovery and error clearing.
- PASS (public preview): revised kerf cut guidance, source-code overlap and precision checks, `noindex` metadata independently fetched after successful CI.
- LIMITATIONS: the neutral axis and finished radius are NOT predicted. Trial calculations are neither woodworking safety verification nor certified physical 1:1 saw templates. Scrap tests, paper rulers, Safari/Firefox and real mobile accessibility remain NOT RUN.

## Crown compound geometry and stair stringer nominal vertices — CI #118
- PASS: [CI #118](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41929865892) finished **264/264** Node unit and **33/33** Chromium browser tests, 36 prerendered HTML pages, 26 P0/P1 calculators, 152 mapped keyword rows and `noindex` preview checks.
- PASS: stair 105-in floor rise / 14 nominal risers / 10-in tread run, with 13 actual tread intervals, yields 130 in horizontal run, **162.5 in** first-tread-to-top notch pitch line, and **167.10774967 in** lower-floor-datum to upper-landing diagonal. The latter is not a physical stringer stock/cut length. The engine returns 28 nominal profile vertices; browser SVG follows those actual coordinates with alternating vertical risers and horizontal treads. The bottom 6-in trim reference is separate, and modifying a not-yet-installed floor finish changes the trim but not nominal step profile.
- PASS: six riser-count independent property fixtures confirm notch pitch-line length and complete nominal vertex path. Invalid throat and bottom trim remain safely rejected.
- PASS: crown reference fixture (spring 38°, included corner 90°) gives **31.61900654°** miter magnitude and **33.86291398°** bevel magnitude. Algebraic sine/tangent and cosine/sine invariants checked over 16 spring/corner pairs, and all four inside/outside × left/right combinations preserve magnitudes while reversing illustrative sign. Selected side/hand are passed through to one-row angle CSV (degree-labelled headers) and dynamic two-angle SVG. Input limits and invalid choices are rejected.
- PASS: new real-browser tests validate correct labelled step polyline geometry, independent bottom trim, responsive crown switches, CSV download and invalid input reset. The original stringer finish-correction heading remains supported after correcting an intermediate regression. Three-decimal UI rounding is tested separately from full-precision engine angles.
- NOT RUN: physical crown saw handedness, face/fence placement, actual compound cut scraps, actual stringer bearing and minimum-throat structural review, physical print scaling, Safari/Firefox or live mobile accessibility. The plan sign is illustrative only; SVG is never a certified 1:1 template.

## Large cut schedules, bounded DOM and full CSV — CI #120
- PASS: [CI #120](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41931441930) completed **265/265 Node** and **34/34 Playwright Chromium** tests; 36 HTML pages, 26 active tools, 152 Semrush research rows and all noindex static checks.
- PASS: the maximum permitted segmented-bowl schedule of **100 rings × 180 segments = 18,000** individual records is generated with correct ring and segment endpoints, angles, chords and total count. Tests check representative boundaries across the full dataset.
- PASS (real Chromium): for 540 records, only **160** table rows are mounted at once. Previous/Next and Go-to-page navigate to correct source rows; the fourth page contains 60 records ending at Ring 3 / segment 180. Page switching does not re-run the geometry engine. Switching to mm preserves the page and typed columns; modifying ring count resets to the first page, while invalid geometry clears the table and hides navigation.
- PASS: downloaded metric CSV for 540 records includes first and last scheduled pieces, 540 actual data rows plus a header and the explicit source-note metadata row, independently of the selected screen page.
- PASS (live Cloudflare preview HTML): `/segmented-bowl-calculator/` serves `#schedule-pager`, page jump control, previous/next buttons and explicit `noindex,nofollow,noarchive`. Deployed JS and CSS contain the pagination implementation.
- LIMIT: printed worksheet intentionally contains the **current page only**; CSV is the complete output. Actual large-paper printing, mobile/assistive technology use, non-Chromium browsers and practical woodworking dimensions remain unverified.

## Independent diagonal checks and ideal target diagram — CI #127
- PASS: [CI #127](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41932935822) **270/270** Node unit tests, **36/36** real Chromium E2E checks, 36 prerendered HTML pages, 26 active tools, 152 Semrush research keyword rows and noindex preview policy.
- PASS: 36×48-in target has 60-in theoretical diagonal. Default user tolerance is 0.125 in. Two equal but wrong 65-in measurements yield zero A–B spread but **both +5-in target errors** and only ONE of three comparisons inside user tolerance. Independent fixtures check exact boundary inclusivity, zero tolerance, negative tolerance rejection, multi-scale 3-4-5 target invariants and an individual diagonal that passes while spread fails.
- PASS: three typed schedule rows and CSV exports preserve correct target, measured, signed/absolute deviation, user tolerance, and human-readable status across inch/mm conversion, with status remaining text rather than being mislabeled as length.
- PASS (real Chromium): the SVG target rectangle's width:height equals the entered 36:48 ratio, and **two ideal diagonals** are drawn. Changing measured diagonals leaves the ideal geometry unchanged; altering tolerance changes comparison status, and invalid inputs clear the diagram and schedule.
- PASS (public Cloudflare preview): `/square-layout-calculator/` serves new `tolerance` input and explicit diagonal limitations, while deployed geometry code and SVG drawing label are available. Robot metadata remains `noindex,nofollow,noarchive`.
- NOT RUN: real measured edge/angle survey, a determination of the actual four corner angles, structural approval, laser/tape calibration, real printed scale, Safari/Firefox compatibility and manual mobile/screen-reader accessibility. **Three numeric comparisons do not prove squareness or compliance.**
