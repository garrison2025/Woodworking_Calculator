# Keyword-to-capability intent audit — 2026-11-05

This is a provenance-preserving quality overlay on `woodworking-keyword-map-152.csv`, **not a new keyword scrape, SERP recheck, or proof of traffic**. The original 152 Semrush research rows (U.S. volume/KD/CPC/competitor estimates) remain intact; one misassigned URL is corrected. Only 26 actual P0/P1 tool routes are implemented. All preview pages remain noindex.

## High-priority exact functionality confirmed in source

| Original research term | U.S. volume | KD | CPC USD | Existing route | What is demonstrably implemented | Status |
|---|---:|---:|---:|---|---|---|
| rafter calculator | 4,400 | 7 | 2.38 | /rafter-calculator/ | Ridge-adjusted run, pitch/rise, tail, exact idealized 2D horizontal seat + vertical heel cut coordinates and HAP | Implemented geometric reference; real structure not certified |
| birdsmouth cut calculator | 390 | 5 | 1.98 | /rafter-calculator/ | Nominal 2-line birdsmouth, physical XY endpoints, sawline numeric CSV and proportional model | Implemented reference; not a safe 1:1 jig or code approval |
| stair stringer calculator | 8,100 | 20 | 0.00 | /stair-stringer-calculator/ | Nominal repeated stair sawlines, top/bottom user-chosen reference lines, stock envelope | Partial physical construction intent; support design incomplete |
| stair stringer calculator online | 320 | 21 | 0.00 | /stair-stringer-calculator/ | Same specialist tool; remapped from generic `/stair-calculator/` | Corrected intent mapping |
| decking joist spacing calculator | 720 | 12 | 1.57 | /deck-material-calculator/ | User-entered nonstructural joist CENTER reference grid plus optional straight full-width stock purchase | Only planning-grid interpretation |
| deck joist spacing calculator | 210 | 9 | 1.83 | /deck-material-calculator/ | Same user-entered center reference spacing, not a recommended maximum | Partial intent only |

## Explicit keyword gaps — do NOT claim these needs are solved

| Keyword, as present in original research | U.S. volume | KD | CPC USD | Existing research mapping | Unsupported search intent |
|---|---:|---:|---:|---|---|
| deck joist span calculator | 720 | 16 | 1.83 | /deck-material-calculator/ | No beam/joist load, deflection, wood grade, species, allowable structural span or code tables. **Never present OC arithmetic as a span rating.** |
| deck post spacing calculator | 590 | 8 | 1.09 | /deck-material-calculator/ | No deck post, beam and footing placement model or structural post-spacing recommendation |
| rafter spacing calculator | 260 | 14 | 0.00 | /rafter-calculator/ | No OC array or structurally approved rafter spacing calculation |
| hip roof volume calculator | 90 | 2 | 0.00 | /hip-rafter-calculator/ | Hip Rafter reports 3D line geometry, **not** enclosed roof volume |
| picket spacing calculator | 210 | 2 | 0.00 | /fence-picket-calculator/ | Target is one of five intentionally HELD P2 tools; it is not a published calculator |
| hip roof construction | 590 | 7 | 0.00 | /hip-rafter-calculator/ | Tool is geometric reference, not a roof construction guide or certified engineering plan |

**SEO action**: Keep all evidence rows, preserve KD and CPC, do not inject the unsupported terms as claims into page titles/H1/FAQ/JSON-LD, and do not invent thin new pages. Only retarget when exact functionality genuinely exists; avoid treating a keyword assigned in a research CSV as a verified search-performance opportunity. For missing structural calculators, seek authoritative load/code sources and professional review before building. Zero indexed/organic traffic and live rankings are claimed.

## Release gate

- Static preview: continue `noindex,nofollow,noarchive`, robots disallow and no preview sitemap/canonical.
- The production domain, Search Console property, indexing approval, site maps, accessibility testing, actual printer calibration, field cuts, and verified supplier prices remain separate gates.
- Cross-browser automation using Playwright Firefox/WebKit on CI is browser-engine smoke evidence, **not actual macOS Safari field testing**.
