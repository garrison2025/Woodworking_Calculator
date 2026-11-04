# UI release evidence — 2026-11-04
## Verified
- Practical three-panel desktop calculator: measurement controls, original geometry SVG, live numeric takeoff; mobile order: input → results → diagram → schedule and method.
- Actual Playwright Chromium navigation and input→result updates passed on **all 26 routes**. Unit dropdown supports inches, feet, millimeters, centimeters and meters.
- CSV and SVG export download events, result clipboard and print-button invocation confirmed. Print/PDF output and physical scale are **not** certified.
- No document-level horizontal scrolling at **360/390/768/1024/1440 px** for homepage and stud tool. Narrow workbench layout was corrected after first real browser failure.
- Desktop and mobile (1440/390px) **10 real screenshots** of homepage/stud/deck/rafter/stringer were captured and reviewed from GitHub Actions `verified-ui-screenshots` artifact on [run #41790303379](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41792234356).
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
