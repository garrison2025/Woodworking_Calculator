# Woodworking Calculator — Release Readiness Gate (2026-11-07)

Current implementation: **31 geometry calculators** (9 P0 + 22 P1), **six populated categories**, **zero unimplemented P2**, and 152 historical KD<=29 Semrush research entries. These counts come from src/tools.json. **Current software acceptance: 2026-11-07 main CI #717 PASS, merged SHA `95e8b81`; 42 publicly fetched preview HTML pages PASS, no real domain.** All original five P2 intents require independent release approval; the Materials category stays noindex until Lumber Price is approved. This document describes verifications still needed, not proof of real-world field acceptance. [Executable launch handoff](DOMAIN-LAUNCH-HANDOFF-20261107.md).

**Superseding owner scope decision (2026-11-07):** [Online-only software acceptance](ONLINE-ONLY-SOFTWARE-ACCEPTANCE-20261107.md) replaces human physical/real-device work as a **website software** release gate. Latest successful complete [main CI #42354449839](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42354449839) includes real Cloudflare HTTP/source parity. Items below labelled HUMAN/PHYSICAL/MANUAL NOT RUN remain historically accurate but are **optional/out-of-scope for software release**; they must not be reinterpreted as PASS or construction approval. Custom domain and explicit SEO release authorization remain required.

| Gate | Prior evidence | Required acceptance | State |
|---|---|---|---|
| Source and regression | Merged main [CI #717](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42337786055) PASSED; all 31 tools, 42 HTML, Node/Chromium/Firefox/WebKit, A4/Letter PDFs and offline release gates | Preserve full CI gate and freeze scope; check actual new custom domain only after purchase | AUTOMATED PASS; PHYSICAL/DOMAIN NOT RUN |
| Homepage UX | PR #13 passed 31/6 counts, tool search, local history clearing, 390px browser checks | Keep behavior stable; real-device review optional, not software release blocker | AUTOMATED PASS / DEVICES NOT RUN · OOS |
| Independent geometry | 31 tool models and numeric / SVG / CSV tests | Automated independent fixtures for software; real workpiece measurement only for separate physical certification | AUTOMATED PASS / HUMAN NOT RUN · OOS |
| Print/PDF | Browser A4/Letter and complete long schedule checks | Digital PDF contents and scale-bar checks; physical ruler measurement only if claiming printer-specific 1:1 fidelity | DIGITAL PASS / PHYSICAL NOT RUN · OOS |
| Devices / accessibility | Chromium/Firefox/Linux WebKit and keyboard tests | Automated browser, keyboard, touch-viewport emulation; real iOS/Android/assistive tech voluntary, not a software gate | AUTOMATED PASS / MANUAL NOT RUN · OOS |
| Construction / saw instructions | Proportional geometry drawings, not full-size templates | Qualified operator reviews stock grade, saw/cut datums, fastening, bearings, loads, local codes and scrap trials | NOT CERTIFIED |
| SEO/GEO launch | Preview noindex; offline canonical/sitemap simulator | Custom domain, deployed SHA check, real redirects/canonical/robots/sitemap, GSC/CWV verification and explicit launch authorization | NO DOMAIN; NOT RUN |
| Search evidence | 152 historical ranking terms + 22 intent cautions | Recheck true US SERP fit and non-brand intents before making marketing promises | NOT RUN CURRENT SERP |

## Representative independent fixtures — no physical signoff

- **Deck board:** coverage 120in, 5.5in actual board face, 0.125in gap: 22 rows; theoretical last rip 1.875in. Check purchased stock end trim and kerf separately. Multi-piece joints do not prove joist support.
- **Rafter:** 6:12 pitch, 120in horizontal run gives reference line approximately 134.16408in. With a 3in level seat, theoretical normal birdsmouth notch is 1.34164079in. Inspect ridge thickness, actual wall face, heel, HAP and material.
- **Baluster:** 96in clear, 1.5in faces, max 4in clear gap: 17 balusters, 18 gaps at approximately 3.9166667in. This is not a guardrail code approval.
- **Stair stringer:** 105in rise across 14 risers -> 7.5in each; 13 treads × 10in -> 130in run. Independently compare cutline vertices, CSV and measured board section.
- **Crown molding:** at spring 38° and wall corner 90°, independently check theoretical compound angle magnitudes and left/right inside/outside orientation on scrap stock.
- **Hip roof, sheathing, kerf bending, spiral stair and tapered staves:** compare actual reference planes and material properties; avoid claims of structural compliance, springback certainty, curved barrel geometry or full-size cut templates.

For each field test log the URL/tool, Git SHA, reviewer and competency, date, units/inputs, CSV and SVG filename, paper/print driver, measured real material, instrument, independent calculation, tolerance, discrepancy, PASS/FAIL and any second-reviewer approval.

Preview Cloudflare Pages must continue returning noindex,nofollow,noarchive and robots.txt Disallow: /. Production canonical/sitemap remains gated on an owned HTTPS domain and explicit approval.

## Software cut-coordinate precision review — 2026-11-07 (PR #14 CI passed)

The rafter birdsmouth model previously admitted a **nonzero seat / near-flat pitch** whose two cut segments could disappear from the coordinate schedule when the heel rounded below display resolution. The stair stringer accepted a strictly positive but sub-resolution remaining throat or bottom riser correction that could be reported as zero. The new source guards reject these inputs with an explicit `cut-coordinate resolution` error, clear the old drawing/CSV until correction, and preserve the intentional **zero-pitch/zero-seat no-material-cut** reference. Positive accepted cuts are bounded above the exported 1e-8 inch quantum, tested against the SVG/CSV contract and independent trigonometric reference examples.

Automated evidence passed in [PR #14 CI #42312144812](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42312144812): `tests/critical-cut-resolution.test.mjs`, `tests/e2e/critical-cut-resolution.spec.mjs`, the 31-tool browser contract and A4/Letter print checks. **This is a software representability safeguard, not proof of minimum safe remaining lumber, structural notch compliance or a physical saw trial.**

## Historical PR #16 specialty geometry cross-surface gate — merged and superseded by main CI #717

Spiral staircase: theoretical curved annular sector area is **not** the same as the four-corner straight-chord tread polygon shown by SVG and exported to CSV. Both values are now separate. Sub-resolution nonzero riser/wedge inputs are rejected. Gambrel: positive but nonrepresentable horizontal runs, rises and endpoint coordinates must fail safely. Polygon frustum stave: physical SVG corners are checked against millimeter CSV and independent shoelace area. See [specialty precision evidence](SPECIALTY-GEOMETRY-PRECISION-20261107.md). The PR #16 tests were merged and covered by later full-suite main CI; they do NOT constitute real-world stair/roof/barrel cutting or structural signoff.
