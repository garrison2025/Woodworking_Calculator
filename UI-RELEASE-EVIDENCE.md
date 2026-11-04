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
