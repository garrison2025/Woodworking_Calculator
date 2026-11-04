# QA evidence — 2026-11-04 (deployed preview)
## Executed / PASS
- **GitHub Actions:** [run #41790303379](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41790303379) passed on `main`.
- **Geometry:** **225 / 225** Node unit tests passed; 26 default numerical fixtures, 5-unit round-trip invariants, valid/invalid boundary checks and targeted regressions. This does not constitute independent structural engineering verification.
- **Real Chromium browser:** **17 / 17** Playwright E2E checks passed, including actual initial JS output and SVG on every one of the 26 routes, deck final rip (1.875 in), change→recalculate, five unit choices (in/ft/mm/cm/m), export downloads, clipboard and print-event wiring, local-only asset requests, zero page-level overflow at 360, 390, 768, 1024 and 1440 px, and actual desktop/mobile screenshots.
- **Prerender:** **36 HTML pages** built: 26 calculators, five categories, four informational/legal pages and homepage; five P2 routes deliberately withheld.
- **Static SEO:** verified distinct titles, valid links, one H1, 152 distinct mapped keyword rows with KD≤29, default noindex, preview robots disallow, no preview sitemap or fake canonical.
- **Observed live preview:** https://woodworking-calculator.pages.dev/ and `/stud-calculator/` were publicly accessible. The current preview displays evaluated formulas and five unit options. Public meta robots is `noindex,nofollow,noarchive`; `robots.txt` says `User-agent: *\nDisallow: /`.
- **UI snapshot artifact:** [successful browser run](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41790303379) → `verified-ui-screenshots`, ten actual Chromium screenshots, desktop 1440px and mobile 390px: homepage, stud, deck, rafter, stringer. Screenshots were manually reviewed for hierarchy and compact mobile layout.

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
