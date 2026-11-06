# Workshop field acceptance record — geometry, CSV, print and trial-fit

**Status at creation: NOT RUN (physical).** This is a blank, field-completion worksheet. No measurements, material inspections, saw trials, structural signoffs, supplier invoices or printer-scale checks have been performed by these automated changes.

**Current implementation scope (2026-11-07):** 31 active geometry calculators (9 P0 + 22 P1), with zero held P2. All real cutting, physical printer measurements and professional acceptance remain NOT RUN unless independently recorded. An SVG screenshot is a **proportional reference**, never a 1:1 cutting template or machine-ready saw path. Human review must use the **numeric cut list** and independently measured references.

## Required provenance for every session

| Field | Entry (fill in during physical review) |
|---|---|
| Reviewer and competence / supervisor | NOT RECORDED |
| Date, site, tool URL and Git commit | NOT RECORDED |
| Browser, OS, printer, paper, print-dialog scale | NOT RECORDED |
| Unit (in/mm), entered dimensions, saved CSV filename | NOT RECORDED |
| Measurement instruments, calibration dates | NOT RECORDED |
| Lumber/product supplier, actual cross section, grade and defects | NOT RECORDED |
| Approved job-specific tolerances and code review authority | NOT RECORDED |
| Actual results, deviations, photos/record IDs and final disposition | NOT RECORDED |

## Gate 1 — print calibration (not a physical cutting template)

1. Use a calculator's **Print / PDF** worksheet. Choose A4 or Letter to match actual paper loaded; set **100% / Actual size**, never fit-to-page. Print the two **separate physical reference bars**.
2. Measure the full printed **100 mm** reference: pass only when within **99.5–100.5 mm** (the project's existing ±0.5% calibration criterion).
3. Independently measure **1 in**: pass only within **0.995–1.005 in**. Record both, the printer settings and the measuring device.
4. If either fails, reject the paper scale, correct settings and reprint. A passing ruler does **not** authorize scaling the SVG into a cutting template.
5. Confirm the A4/Letter PDF has readable numeric columns, correct pagination, and no omitted schedule rows (including for long lists).

| Measurement | Printed result | Acceptance | Result / signature |
|---|---|---|---|
| 100 mm reference bar | NOT MEASURED | 99.5–100.5 mm | PENDING |
| 1 in reference bar | NOT MEASURED | 0.995–1.005 in | PENDING |
| PDF numeric table legibility | NOT INSPECTED | All units, numbers and row labels readable | PENDING |
| Page row completeness | NOT INSPECTED | Matches the CSV count and last row | PENDING |

## Gate 2 — independent numeric and SVG/CSV review

For each tool used in a real task, independently hand-calculate at least one non-default input. Review **selected units, coordinate origin, sign conventions, actual measured faces, row order, SVG aspect ratio, exported CSV header units, any tolerance, and failure behavior**. At least one other person should repeat the hand calculation for high-risk geometry. Do not approve by merely comparing the app to itself.

| Task family / representative live tool | Independent hand fixture | Critical field comparison | State |
|---|---|---|---|
| Deck board / Deck estimator | Width 120 in, board 5.5 in, gap 0.125 in → 22 rows, last rip 1.875 in | Real board face vs nominal size; residual rip; butt-gap reference; joist centerlines are not structural span ratings | NOT RUN |
| Baluster / equal spacing / fence posts | 96 in clear, 17 × 1.5 in balusters → 18 equal gaps, each 3.9166667 in | Real clear gaps/end faces; code limits determined independently | NOT RUN |
| Drilling / shelf pin layout | 100 mm strip, four 5 mm holes, 5 mm centers from each end → X: 5, 35, 65, 95 mm | Diameter, edge clearance, front/back orientation, both side panels, hardware specification | NOT RUN |
| Common rafter / roof pitch | Pitch 6:12, horizontal run 120 in, seat 3 in, stock 5.5 in → line 134.16408 in, normal notch 1.34164 in | Actual ridge, plate datum, heel location; no structural notching approval | NOT RUN |
| Stair stringer / stair geometry | 105 in rise / 14 risers → 7.5 in/riser, 13 × 10 in treads → 130 in total run; 1.5 in tread thickness → nominal bottom reference 6 in | Actual finished floors, local rise/tread requirements, support/bearing and material quality | NOT RUN |
| Hip roof / sheathing | Recompute all four roof-plane areas from actual entered plan and pitch; polygon vertex dimensions from numeric CSV | Slope-face versus top-down projection; purchased sheet edges; no unproven offcut reuse | NOT RUN |
| Crown molding | Independently check corner included angle and spring-angle conventions against a **scrap trial** | Left/right and inside/outside signs are only illustrative; do not translate directly into saw settings | NOT RUN |
| Framing with openings | Measure three actual wall reference datums and all active opening positions before comparison | King/jack/header/sill material acceptance, grade, openings and valid bearing are separate from geometry | NOT RUN |
| Kerf bending / segmented bowl / wainscot | Hand recompute segment face, kerf web and panel end widths | Trial material behavior; do not infer bending strength or lathe/knife/saw safety | NOT RUN |

## Gate 3 — supervised physical dry fit or scrap trial

**Never execute a calculated cutting layout directly as an operating instruction.** A competent workshop operator independently evaluates tool manufacturer instructions, blade/guard/clamp setup, stock defects, code requirements and a safe cutting plan before any scrap cut.

For each trial, write down: nominal CSV dimension → independently measured stock geometry → actual resulting dimension → signed deviation → pre-approved task tolerance → ACCEPT / REJECT / REWORK. A passing geometric tolerance **does not** certify load capacity, fastening, building-code compliance, roof/stair structural suitability, or machining safety. Record any altered dimensions; rerun the calculator and invalidate obsolete printed sheets.

| Trial ID | Tool / record | CSV target | Measured actual | Difference | Approved tolerance | Decision and verifier |
|---|---|---|---|---|---|---|
| 01 | NOT SELECTED | — | — | — | NOT APPROVED | NOT RUN |
| 02 | NOT SELECTED | — | — | — | NOT APPROVED | NOT RUN |
| 03 | NOT SELECTED | — | — | — | NOT APPROVED | NOT RUN |

## Gate 4 — disposition

- **Automated PASS:** Browser/script calculation-to-SVG-to-CSV checks, synthetic fixture tests, PDF-format audits — list exact GitHub commit and CI run separately.
- **Human geometry review:** PENDING until names, independent math and physical measurements are signed.
- **Physical printer review:** PENDING until both reference bars have real measured values.
- **Stock and machine review:** PENDING until independently approved. Do not infer purchase readiness from an optimizer.
- **Structural/code review:** OUTSIDE THIS SOFTWARE; certified approval must come from the relevant competent authority.
- **Search indexing:** PREVIEW ONLY. Keep \`noindex,nofollow,noarchive\`, \`robots.txt Disallow: /\` and no live sitemap until a deliberate formal launch.

**Release rule:** A browser PASS is not an acceptance signature. Any failure in manual review must be recorded with the specific calculator, inputs, CSV row and diagram coordinate, then fixed and rerun through automated tests before reassessment.
