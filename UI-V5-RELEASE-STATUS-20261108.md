# WoodLayout V5 UI / Motion Release Evidence — 2026-11-08

## Code release
- UX polish: [PR #41](https://github.com/garrison2025/Woodworking_Calculator/pull/41), merged into `main` as `666f4c499f30477c26973316a8e5241a62e81036`.
- Changes: recoverable homepage zero-results search; higher-contrast, larger calculator form guidance; 44px form controls; short non-geometric result and drawing feedback; reduced-motion and native-print safeguards.
- All calculator formula engines, 31 tool routes, historical 152-keyword research map, 42-page publishing gate and downloadable measurement coordinates were kept intact.
- PR Actions #42434907847: 595/595 unit tests, 254/254 Chromium e2e checks, 40/40 Firefox/WebKit smoke checks; PDF and offline SEO validations passed.
- Merged-main Actions #42435357832: code verification passed.

## Cloudflare release gate — NOT VERIFIED AT THIS RECORD'S CREATION
- The merged-main Cloudflare HTTP/source-parity audit failed twice: 42 URLs were reachable, but `/assets/app.mjs`, `/assets/home.mjs`, `/assets/style.css` differed from the merged source. No Cloudflare Pages check run was associated with the V5 merge commit, unlike the prior V4 merges. This is a deployment/integration discrepancy, not evidence of a calculator formula failure.
- This documentation-only repository update intentionally does not change generated site assets, and may prompt the existing Cloudflare Git integration to rebuild. It must **not** be considered deployment proof.
- Release acceptance requires a successful Cloudflare Pages deployment of current `main` and an independent `deployed-preview` parity audit (253 source checks, 42 live pages, 31 configs and forms, all preview pages noindex).
- Cloudflare project settings for this repository: Git source `garrison2025/Woodworking_Calculator`, production branch `main`, build command `python3 build.py`, output directory `dist`. Check the actual Cloudflare project settings; do not infer they are currently configured correctly from this note.
- No production custom domain is approved. The `*.pages.dev` preview must remain `noindex`, with no GSC submission.
- Physical printing, cutting-material verification, iOS/Android devices and screen readers remain independently NOT RUN.

## Recovery when an automatic production build is not triggered
1. Cloudflare Dashboard > Workers & Pages > the woodworking calculator project > Deployments: inspect the latest successful deployment's commit SHA.
2. Settings > Builds: inspect connected Git repository and Branch control, including whether automatic production-branch deployments are enabled.
3. If the Git connection is disconnected or suspended, repair that authorization in the dashboard; if a build failed, inspect the deployment's Build log.
4. Once the deployed assets match current main, rerun the read-only GitHub `deployed-preview` job or `python3 scripts/verify_live_launch.py --base https://woodworking-calculator.pages.dev --mode preview --verify-source-parity`.
