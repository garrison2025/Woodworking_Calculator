# WoodLayout V4 / V5 UI release evidence — updated 2026-11-08

## Merged product changes

- V4 six-part workbench UX: [PR #39](https://github.com/garrison2025/Woodworking_Calculator/pull/39), merged as `1db24ad19b464e6c68cca1a95e11fb942c6e567a`.
- V5 visual and interaction polish: [PR #41](https://github.com/garrison2025/Woodworking_Calculator/pull/41), merged as `666f4c499f30477c26973316a8e5241a62e81036`.
- Current main: `2a9f2b5a659d6125ba8034bd9e7da8f585f59311` after the evidence-backed homepage/SEO update.
- The released source retains **31 calculator tools, 6 categories, 42 HTML pages and all 152 historical keyword records**. No calculator route, formula engine, field manifest, canonical route or SEO keyword record was removed by V4/V5.
- V4 covers mobile category navigation; complex-calculator task sections and result summaries; coalesced live updates; linked drawing/measurement rows; focus, touch and reduced-motion behavior; and automated multi-viewport/browser/export checks.
- V5 adds recoverable homepage empty-search state, clearer calculator guidance, 44px controls, short cosmetic feedback, reduced-motion handling and print safeguards.

## Current automated acceptance — main commit 2a9f2b5

- **Main verification job: PASS.** 254 Chromium E2E cases were executed; 253 passed directly and the 540-cut long-print PDF case passed on retry (1 flaky). The PDF content audit then passed: A4 65 pages and Letter 70 pages, all 540 distinct cut IDs and 2,700 group-row identifiers present, no missing or duplicated rows; 10 specialist A4/Letter PDFs also passed structural checks.
- **Firefox + WebKit: PASS, 40/40.** Includes V4 mobile category navigation at five viewport widths, linked deck drawing/schedule rows, high-frequency input coalescing, reduced-motion behavior, keyboard-accessible measurement tables and exports.
- **GEO crawler access: PASS.** 42 canonical pages, robots.txt, sitemap.xml, llms.txt and eight AI/search User-Agent requests returned readable production content. User-Agent response checks do not prove official crawler identity or source-IP verification.
- **Lighthouse lab: PASS.** The five sampled reports on 2026-11-08:
  | Page / profile | Performance | Accessibility | Best practices | SEO |
  |---|---:|---:|---:|---:|
  | Home / mobile | 97 | 100 | 100 | 100 |
  | Stair Stringer / mobile | 98 | 96 | 100 | 100 |
  | Materials / mobile | 99 | 100 | 100 | 100 |
  | Deck Board / mobile | 91 | 96 | 100 | 100 |
  | Home / desktop | 100 | 100 | 100 | 100 |

## Cloudflare production acceptance — PARTIAL, not PASS

- The public canonical host `https://woodlayout.com` served all **42 expected pages** in the production audit. The audit completed **921 checks**, including **253 source-parity checks** against the current checkout.
- The only two failures in that run were the legacy production Pages alias not issuing the expected permanent redirect for `/` and `/stud-calculator/`. The custom-domain content, page metadata, 31 tool configurations/forms, assets, robots, sitemap and source parity passed that audit.
- The separate GEO check and Lighthouse run both detected the current public WoodLayout release.
- [PR #49](https://github.com/garrison2025/Woodworking_Calculator/pull/49) strengthens the audit to also require `www.woodlayout.com` → apex redirects and to verify query-string/path preservation. Its CI must pass before merge.
- Required Cloudflare account action: create Bulk Redirects for the exact host `woodworking-calculator.pages.dev` → `https://woodlayout.com` (301, subpath matching, preserve path suffix and query string), plus `www.woodlayout.com` → apex (301). Do not include branch-preview subdomains; they must remain noindex. The connected browser profiles currently have no Cloudflare sign-in, so dashboard changes have not been made or claimed.
- Until these rules are active and the production audit returns `status=PASS` with `failures=[]`, the Cloudflare launch gate remains **PARTIAL**.

## Remaining independent evidence

- Actual iOS/Android hardware, mobile soft-keyboard behavior and VoiceOver/NVDA testing: **NOT RUN**. Responsive emulation and browser automation are not physical-device or screen-reader certification.
- Physical A4/Letter printer ruler calibration and real timber trial cuts: **NOT RUN**. PDF structure/content checks do not certify 1:1 print scale, saw settings or structural safety.
- Google Search Console verification, sitemap submission and actual indexing: **NOT RUN**. A successful HTTP sitemap response is not proof of indexing.
- The owner has previously waived physical and real-device checks as release gates for this online geometry-reference tool. That waiver does not authorize claims of certified 1:1 templates, structural suitability or screen-reader conformance.

## Relevant GitHub Actions

- [Main verification and production audit #42463100861](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42463100861)
- [Live Lighthouse lab #42463100889](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42463100889)
- [GEO crawler access audit #42463100751](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/42463100751)
