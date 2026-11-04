# Print calibration / PDF worksheet acceptance — 2026-11-04

## Capability boundary

- The drawing panel is proportional SVG in a fixed viewBox; it is **not** a certified full-size drawing.
- The separate reference bars are created with explicit CSS widths `100mm` and `1in` under print media. They are intended to let a person verify the printed scale; there is no silent automatic correction.
- Letter and A4 PDF outputs are tested in headless Chromium, but a physical printer may still apply fit-to-page or margin scaling.

## Manual measurement checklist (NOT RUN)

1. Open any calculator and click **Print / PDF**. Pick **Letter** or **A4**, according to paper actually loaded.
2. Choose **100% / Actual size**, NOT **Fit to page**. Print one page containing both physical rulers.
3. Measure the outer black edges of **100 mm** bar on paper: 99.5–100.5 mm inclusive passes the ±0.5% criterion.
4. Independently measure the **1 in** bar: 0.995–1.005 inches passes the same criterion.
5. If either is outside tolerance, reject the paper result, correct browser/printer scaling and repeat.
6. Even if both pass, use the numeric cut schedule, not the SVG drawing, to lay out stock. Physical scrap cuts and professional structural details are still required where appropriate.

## Automated acceptance scope

- CSS physical lengths checked in Chromium print mode against `96 CSS px / inch`, plus visibility and navigation hiding.
- Browser-produced A4 and Letter PDF byte signatures and PDF MediaBox paper dimensions are asserted.
- CI uploads short-lived `print-calibration-pdfs` evidence; tests do **not** claim real printer or physical-cut verification.

## State

- CSS/browser & PDF file generation: tests added; mark PASS only after the associated CI run succeeds.
- Real printed 100 mm / 1 in ruler measurement: **NOT RUN**.
- One-to-one cutting template certification: **NOT SUPPORTED**.
