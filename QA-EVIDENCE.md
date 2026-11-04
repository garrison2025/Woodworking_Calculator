# QA evidence — 2026-11-04
## Executed
- **PASS:** GitHub Actions run [41780919798](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41780919798), workflow **Verify Woodworking Tools**, outcome success.
- **PASS:** Node test runner: **216 / 216** passing; 0 failing. This covers 26 distinct golden-default fixtures, input validation and generic deterministic/unit-conversion invariants; it does **not** equal 8 independently sourced geometry golden cases per tool.
- **PASS:** Static build (Python 3.12) emitted **36 HTML pages**, including **26 calculator pages**, five category directories, and four policy/info pages.
- **PASS:** Static QA verified site links, unique titles, one H1 per page, preview robots, 5 P2 not published, and core assets exist.

## Not yet executed (release blockers)
- **NOT RUN:** Browser end-to-end input, unit, export, copy and print checks on desktop Chrome.
- **NOT RUN:** 360 / 390 / 768 / 1024 / 1280 / 1440 responsive viewport screenshots, keyboard/touch and real focus contrast audit.
- **NOT RUN:** Physical printed 1:1 size verification (no such claim is made in UI).
- **NOT RUN:** Independent reference design verification of the complex birdsmouth, roof-sheet cutting, framing opening members, saw angle handedness, kerf springback and structural fit.
- **NOT RUN:** Real Cloudflare Pages preview response and custom-domain live checks.
- **N/A:** Production canonical/robots/sitemap and AdSense until actual domain and approvals exist.

**Policy:** All generated pages remain noindex until the owner deliberately sets a real custom domain, completes release gates, and enables the production build. A CI pass does not establish full V3 acceptance.
