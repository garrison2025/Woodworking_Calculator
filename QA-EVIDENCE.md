# QA evidence — 2026-11-04 (deployed preview)
## Executed / PASS
- **GitHub Actions:** [run #41793989952](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41793989952) passed on `main`.
- **Geometry:** **233 / 233** Node unit tests passed; 26 default numerical fixtures, 5-unit round-trip invariants, valid/invalid boundary checks and targeted regressions. This does not constitute independent structural engineering verification.
- **Real Chromium browser:** **20 / 20** Playwright E2E checks passed, including actual initial JS output and SVG on every one of the 26 routes, deck final rip (1.875 in), change→recalculate, five unit choices (in/ft/mm/cm/m), export downloads, clipboard and print-event wiring, local-only asset requests, zero page-level overflow at 360, 390, 768, 1024 and 1440 px, and actual desktop/mobile screenshots.
- **Prerender:** **36 HTML pages** built: 26 calculators, five categories, four informational/legal pages and homepage; five P2 routes deliberately withheld.
- **Static SEO:** verified distinct titles, valid links, one H1, 152 distinct mapped keyword rows with KD≤29, default noindex, preview robots disallow, no preview sitemap or fake canonical.
- **Observed live preview:** https://woodworking-calculator.pages.dev/ and `/stud-calculator/` were publicly accessible. The current preview displays evaluated formulas and five unit options. Public meta robots is `noindex,nofollow,noarchive`; `robots.txt` says `User-agent: *\nDisallow: /`.
- **UI snapshot artifact:** [successful browser run](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41792234356) → `verified-ui-screenshots`, twelve actual Chromium screenshots, desktop 1440px and mobile 390px: homepage, stud, deck, rafter, stringer and hip roof. The older views were manually reviewed in an earlier run; the new hip roof snapshots have been captured automatically but not manually inspected.

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
