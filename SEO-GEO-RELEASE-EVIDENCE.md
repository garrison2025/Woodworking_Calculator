# SEO / GEO release evidence (2026-11-04)
## Verified in repository CI
- 26 P0/P1 dedicated routes; five P2 are HOLD and absent from output.
- 36 prerendered HTML files with individual title/description/H1, formula and worked example, limitations and cross-links.
- Source of truth: `src/tools.json`; complete **152 keyword rows** with source metrics and canonical mapping: `research/woodworking-keyword-map-152.csv`.
- U.S. English first; same canonical route for imperial/metric views, no query-driven indexable pages.
- Index permission gated by `RELEASE_APPROVED=1` + real HTTPS `SITE_URL`; preview: noindex, robots Disallow, no sitemap, no fake canonical.
- Actual CI result: [41782065704](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41782065704) PASS.

## NOT RUN / BLOCKED
- Live crawl / GSC / Cloudflare preview response: NOT RUN.
- Canonical and sitemap on owned custom domain: N/A until domain connected.
- Production mobile Core Web Vitals and Google rich-result validation: NOT RUN.
- Source-referenced expertise, real authorship and trust assertions: no claims added.
- Six special-result entries (three image-result and three AI Overview entries) in the Semrush export: research evidence only; not an SEO ranking promise.

Do not index P0/P1 simply because a page exists; full feature and dimensional QA are still release gates.
