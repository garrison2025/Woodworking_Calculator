# Woodworking Calculator — Release Readiness Gate (2026-11-07)

Current implementation: **31 geometry calculators** (9 P0 + 22 P1), **six populated categories**, **zero unimplemented P2**, and 152 historical KD<=29 Semrush research entries. These counts come from src/tools.json. This document describes verifications still needed, not proof of real-world field acceptance.

| Gate | Prior evidence | Required acceptance | State |
|---|---|---|---|
| Source and regression | PR #13 CI #42310268231: 556 Node, 193 Chromium, 18 Firefox/WebKit passed + 42 static pages | PR #14 separate full Node/browser/PDF/release checks must pass | PRIOR PASS / CURRENT PR PENDING |
| Homepage UX | PR #13 passed 31/6 counts, tool search, local history clearing, 390px browser checks | Keep behavior stable; manual touch / assistive tech review still required | AUTOMATED PASS / DEVICES NOT RUN |
| Independent geometry | 31 tool models and numeric / SVG / CSV tests | Second-source hand calculation and independent measurement on high-risk trade geometry | HUMAN NOT RUN |
| Print/PDF | Browser A4/Letter and complete long schedule checks | Physically measure 100mm rule between 99.5–100.5mm and 1in rule between 0.995–1.005in at actual print scale; check all rows | PHYSICAL NOT RUN |
| Devices / accessibility | Chromium/Firefox/Linux WebKit and keyboard tests | Real Android/iOS touch, macOS Safari, NVDA/VoiceOver review, recorded screenshots | MANUAL NOT RUN |
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

## Software cut-coordinate precision review — 2026-11-07 (pending new PR CI)

The rafter birdsmouth model previously admitted a **nonzero seat / near-flat pitch** whose two cut segments could disappear from the coordinate schedule when the heel rounded below display resolution. The stair stringer accepted a strictly positive but sub-resolution remaining throat or bottom riser correction that could be reported as zero. The new source guards reject these inputs with an explicit `cut-coordinate resolution` error, clear the old drawing/CSV until correction, and preserve the intentional **zero-pitch/zero-seat no-material-cut** reference. Positive accepted cuts are bounded above the exported 1e-8 inch quantum, tested against the SVG/CSV contract and independent trigonometric reference examples.

Evidence proposed: `tests/critical-cut-resolution.test.mjs`, `tests/e2e/critical-cut-resolution.spec.mjs`, existing 31-tool browser contract and A4/Letter printable schedules. **This is a software representability safeguard, not proof of minimum safe remaining lumber, valid structural notch size, code compliance or a physical saw trial.** Mark this PASS only after the new PR commit's full Actions run succeeds.
