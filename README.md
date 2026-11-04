# Workshop Geometry Tools

Free English-language woodworking layout calculators, browser-only geometry, print diagrams, and material schedules. Source research: owner-approved Woodworking Calculator V3.0 (2026-11-04).

## Build

`python3 build.py` builds static pages into `dist/`. `node --test tests/*.test.mjs` runs algorithm fixtures. Cloudflare Pages build command: `python3 build.py`, output directory: `dist`. No paid API or runtime database.

**Launch policy:** Every generated route is `noindex,nofollow` until a separately verified custom domain and release gate. Never treat a Pages preview as a canonical production site. Structural geometry is not code, load, or safety certification.
