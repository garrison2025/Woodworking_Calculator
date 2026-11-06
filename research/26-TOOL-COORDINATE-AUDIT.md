# 31-tool numerical ↔ CSV ↔ SVG consistency gate (historical filename retained)

**Source of truth:** \`src/tools.json\` determines the current 31 live P0/P1 calculator routes and their defaults; \`src/calcs.mjs\` computes geometry in inches; \`src/cut-list.mjs\` exports typed columns. Browser snapshots can otherwise appear visually plausible with a missing or shifted measurement.

The regression \`tests/e2e/sitewide-contract.spec.mjs\` verifies **every** live route at both inch and millimeter display settings against the same entered measurements: all on-screen metric labels and numbers, all downloaded typed CSV cells and units (including vertex lists), SVG shape family and world-span attributes, representative primitive counts, and multiple row/coordinate annotations. All five originally held P2 concepts were subsequently implemented as bounded P1 geometry tools and now participate in the 31-tool cross-surface contract.

This is a *cross-surface consistency* check: engine, UI, SVG, CSV. Independent math/scientific and physical certification require different evidence; see \`tests/field-acceptance-regressions.test.mjs\`, \`research/GEOMETRY_REFERENCE_NOTES.md\` and \`FIELD-ACCEPTANCE-CHECKLIST.md\`.

| Route | Geometric family | Primary rendered element |
|---|---|---|
| /stud-calculator/ | Sloped stud faces | \`.gable-cut-face\` |
| /framing-calculator/ | Frame openings | \`.opening-cutout\` |
| /deck-board-calculator/ | Board rip face | \`.deck-board-face\` |
| /baluster-spacing-calculator/ | Baluster face | \`.baluster-face\` |
| /rafter-calculator/ | Plumb-clipped stock | \`.rafter-stock-section\` |
| /crown-molding-calculator/ | Miter/bevel references | \`.crown-miter-ray\` |
| /soffit-calculator/ | Datum section | \`.soffit-rafter\` |
| /kerf-bending-calculator/ | Individual saw slots | \`.kerf-slot\` |
| /wainscoting-calculator/ | Panel edge | \`.wainscot-panel\` |
| /stair-calculator/ | Stair riser | \`.stair-riser\` |
| /rise-run-calculator/ | Proportional rise/run | \`.roof-pitch-slope\` |
| /deck-material-calculator/ | Deck row face | \`.deck-plan-board\` |
| /segmented-bowl-calculator/ | Ring segments | \`.ring-segment-face\` |
| /roof-pitch-calculator/ | Proportional roof triangle | \`.roof-pitch-slope\` |
| /equal-spacing-calculator/ | Center-only or real part face | \`.axis\` / \`.equal-part-face\` |
| /hip-rafter-calculator/ | Plan reference diagonal | \`.hip-plan-diagonal\` |
| /hip-roof-calculator/ | Roof-sheet polygon | \`.roof-panel-cut\` |
| /wall-stud-calculator/ | Vertical stud cut face | \`.wall-cut-stud\` |
| /shelf-spacing-calculator/ | Actual shelf thickness | \`.shelf-face\` |
| /gable-roof-calculator/ | Proportional gable slope | \`.roof-pitch-slope\` |
| /square-layout-calculator/ | Ideal rectangle | \`.square-target-outline\` |
| /diagonal-brace-calculator/ | Trimmed brace reference | \`.brace-cut-centerline\` |
| /hole-spacing-calculator/ | Drill circle | \`.drill-hole\` |
| /stair-stringer-calculator/ | Nominal stair-step polyline | \`.stringer-step-profile\` |
| /roof-sheathing-calculator/ | Individual sheet bounds | \`.sheathing-cut\` |
| /fence-post-calculator/ | Post face | \`.post-face\` |
| /spiral-staircase-calculator/ | Single-turn annular wedge plan | `.spiral-tread-face` |
| /gambrel-roof-calculator/ | Four pitched roof sections | `.gambrel-slope-segment` |
| /lumber-price-calculator/ | Board-foot cross section | `.lumber-board-face` |
| /fence-picket-calculator/ | Picket face stations | `.picket-face` |
| /stave-calculator/ | Faceted frustum stave | `.stave-face` |

**Test limitations:** SVG primitive count and stored coordinate attributes are NOT an independent measurement of real printed scale, hardware compliance or saw setup. Synthetic default inputs are audited; full user input-space coverage is mathematically impossible. A separate manual worksheet requires real measurements and tolerances before any use in a job.
