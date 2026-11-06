# Scenario case acceptance — 2026-11-06

**Six complete synthetic measurement presets, not physical workshop trials.** Deck Board, Common Rafter and Stair Stringer now display two reproducible cases each in the measurement pane. Clicking a case fills all tool inputs, including hidden optional fields, using the user's current in/mm setting. It immediately updates the same calculation engine, SVG and typed CSV that manually entered dimensions use; Reset restores the original tool defaults.

Representative independent formulas:

- Deck Board: 120 in coverage, 5.5 in actual board face, 0.125 in gap gives **22 rows**, final 1.875 in rip because 21×5.5 +21×0.125 +1.875=120. At 95 in coverage with 0.25 in gaps, 5.5 in faces, 120 in row length, 96 in supplier stock, 10% reserve: **17 rows, 3 in last rip, 38 nominal stock pieces**; there is no supported joist/butt seam layout.
- Rafter: 96 in center run less half of a 1.5 in ridge =95.25 in measured run; at 6:12 rise is 47.625 in. Normal depth removed by a 3 in horizontal seat is 3×sin(atan(6/12))≈1.341641 in. A separate 4:12 case demonstrates changing pitch, horizontal run, overhang and actual stock.
- Stair Stringer: 105 in rise/14 risers means 7.5 in actual step height, 13×10=130 in horizontal run. A 7.5×10 rise/tread notch has 6 in normal depth and leaves **5.25 in** nominal throat in 11.25 in stock. A second 96 in rise/13 risers case independently checks lower-finish bottom cut and 10.5 in tread.

The `src/worked-cases.json` table stores all case dimensions in **inches**, and records typed expected metrics. `tests/worked-cases.test.mjs` recalculates independent numerical invariants and checks both CSV unit headers. `tests/e2e/worked-cases.spec.mjs` tests both case buttons in inches and millimeters, validates full form values, metric text, SVG span/source and downloaded CSV, and then checks Reset.

The new cards are prerendered HTML for real task examples, not auto-generated keyword synonyms, and are suppressed in physical worksheet printing. They never certify a real stock piece, a saw setting, a building code or printer scale. All Cloudflare Pages previews remain `noindex,nofollow,noarchive`, with original 152-row keyword research data unchanged.
