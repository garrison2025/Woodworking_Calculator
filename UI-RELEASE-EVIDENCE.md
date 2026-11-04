# UI release evidence — 2026-11-04
## Verified
- Practical three-panel desktop calculator: measurement controls, original geometry SVG, live numeric takeoff; mobile order: input → results → diagram → schedule and method.
- Actual Playwright Chromium navigation and input→result updates passed on **all 26 routes**. Unit dropdown supports inches, feet, millimeters, centimeters and meters.
- CSV and SVG export download events, result clipboard and print-button invocation confirmed. Print/PDF output and physical scale are **not** certified.
- No document-level horizontal scrolling at **360/390/768/1024/1440 px** for homepage, stud, framing, deck-material and roof-sheathing pages. Narrow workbench layout was corrected after first real browser failure.
- Desktop and mobile (1440/390px): **18 automated screenshots** of homepage, stud, deck-board, rafter, stringer, hip roof, framing, deck-material and roof-sheathing. [Run #76](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41798293682) captured them; manual aesthetic acceptance of every screenshot is not claimed.
- Desktop uses a measured workshop look with original CAD-style SVG, neutral/green/wood palette, no external fonts. Mobile was compacted into two-column measurement/result cards and diagram blank-height removal, then browser tested again.

## NOT RUN / LIMITATIONS
- Real device touch/soft keyboard, screen reader testing, automated accessibility contrast metrics, Safari/Firefox, measured CWV.
- Paper/PDF printer dialog verification, 1:1 physical ruler verification, engineer-reviewed saw orientation and cutting diagram precision.
- Aesthetic review of **all** 26 tools on every breakpoint (screenshots sampled homepage/stud/deck/rafter/stringer only).

All implementation is browser-local and keeps the preview noindex. No claim of full V3 visual or engineering acceptance.

## Framing update — run #68
- PASS: interactive wall elevation with 1–3 independently positioned openings, corresponding sill/height values and color-distinct center marks.
- PASS: chromium regression for second opening and invalid elevation.
- NOT RUN: physical stud layout and dedicated visual review of the new framing drawing on real devices.

## Hip sheet layout — CI run #41793989952
- **PASS:** four-plane clipped polygons now use the same values as the measurement schedule; the user can change sheet direction without leaving the page.
- **PASS:** automated screenshot capture at desktop 1440px and mobile 390px includes the hip roof page; 20/20 Chromium tests passed including orientation-dependent polygon and count updates.
- **NOT RUN:** manual inspection of the new images; paper print layout, Safari/Firefox and real-device touch interaction.

## Single-plane sheet grid — 2026-11-04
- PASS: browser test verifies each sheet cut has a visible SVG rectangle, and change of stock orientation updates positions from 8 to 6.
- PASS: [CI #73](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41794301192) confirms 21 Chromium checks and 12 representative desktop/mobile snapshots.
- NOT RUN: physical placement/1:1 printing, actual roof fastening or on-device screen reader testing.

## Deck workbench and expanded responsive gate — CI #76
- PASS: 22 actual Chromium tests. Deck board rows (22), joist reference lines (10), stock length change (22 to 44 boards), CSV result and invalid-input drawing clearance have explicit browser assertions.
- PASS: five viewport widths (360/390/768/1024/1440) now cover homepage, stud, framing, deck-material and roof-sheathing; all pass document-level horizontal overflow checks.
- PASS: 18 screenshots captured by [run #76](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41798293682); not manually reviewed for physical cut precision or screen-reader performance.

## Numeric CSV usability — CI #84
- PASS: browser-verified download files retain selected units in headers and machine-readable numeric coordinates. Local read-back verified on stud and hip-roof sample pages; standard metric fallback also passed.
- PASS: existing UI table remains human-readable with unit suffixes, while the CSV is optimized for spreadsheet calculations and SVG drawing labels reflect the same engine units.
- NOT RUN: Excel spreadsheet import GUI and real device touch downloads.

## Fence and segmented bowl regression (CI #88)
- 26 passing Playwright checks include fence overlapping-post rejection and recoverable centerline CSV, plus interactive all-ring segment schedule and angle/length unit headers.
- No new UI layout style or mobile screenshots for these two routes were manually reviewed; functional UI checks are not a universal aesthetic signoff.

## Unified data-table semantics and shelf cross-section — 2026-11-04
- PASS: [CI #91](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41805332970) includes 28 real Chromium tests. The new shelf test checks three rectangular shelves in the SVG, numeric bottom/top faces, actual end clearances and invalid metric-input recovery.
- PASS: [CI #90](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41804993159) checked that baluster/post SVG widths grow proportionally as actual entered material face width grows; bowl tables show dimensionless ring/segment indexes and angle units while CSV headings match.
- NOT RUN: manual detailed visual acceptance of every route on real mobile and paper physical scale.

## Soffit datum cross-section — CI #93
- PASS: roof-top and rafter-underside are now visible as two parallel rafter faces in a proportional section. The dashed finish datum is derived from the same numeric engine values as the on-screen metrics and downloaded two-row cut schedule.
- PASS: 29 Chromium checks, including changing stock depth, asserting the matching numeric result, checking SVG datum elements, exporting metric CSV and clearing invalid geometry. [Run #93](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41806374873).
- NOT RUN: reviewed real-size construction details, printed full-size templates, hand verification of physical fascia assemblies, or cross-browser/device acceptance.

## Deck joint reference visibility — CI #95
- PASS: the deck SVG adds distinct colored butt-joint ticks inside each board row and continues to show dashed joist center reference lines. Changing stock from 144 to 100 in reveals 22 joints, while a non-reachable joist center clears the drawing and reports a specific error; valid input restores the visual schedule.
- PASS: [CI #95](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41809838176) validated matching PDF/CSV-aware responsive browser behavior. 29/29 Playwright tests passed.
- LIMIT: the diagram illustrates **unstaggered** aligned seams and must not be treated as a structural design or physical paper-scale cut template.

## Hole spacing SVG and CSV precision — CI #98
- PASS: [CI #98](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41810910456) includes 30 Chromium tests, including four SVG drill-hole circles, isotropic center-pitch/radius ratios, unit-dependent table/CSV edges and hole overlap error clearing.
- SVG board face width is an arbitrary visual slab, since the user does not input board width; drawn circles preserve equal horizontal and vertical scale and are NOT paper-size drilling templates.
- PASS: metric CSV export tested without floating precision tails; the geometry engine itself remains unchanged by export formatting.
