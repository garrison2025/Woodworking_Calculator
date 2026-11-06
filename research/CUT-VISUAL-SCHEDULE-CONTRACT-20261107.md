# SVG drawing versus cut schedule — independent cross-surface gate (2026-11-07)

Current preview scope: 31 active geometry tools, six populated categories, 152 historical Semrush keyword rows. Software/browser consistency is not physical construction certification.

## Kerf bending

- Physical slot edges are stored as left and right inch coordinates on the engine's 1e-8-inch export grid. SVG rectangles are now drawn from those *same row edges*, not from unrounded mark centers and an independent nominal saw-width calculation.
- The geometry model rejects slot edges which collapse, overlap, or extend beyond the flat stock after rounding. A geometry-only arc-radius and slit closure model cannot predict finished wood bend radius, tear-out or springback.
- The dedicated Playwright test checks every SVG rectangle's X, width and depth versus the same exported inch coordinates converted to millimeters; a separate Node test checks all slots against idealized arc, sweep and saw width.

## Crown molding

- At wall corner 90 degrees and spring angle 38 degrees: miter magnitude 31.619 degrees, bevel magnitude 33.863 degrees. At spring 45 degrees: miter magnitude 35.264 degrees, bevel magnitude 30.000 degrees.
- Both the illustrative signed plan ray and magnitude-only bevel ray have traceable numeric SVG attributes. Browser regression independently checks drawn ray slopes and metric-independent CSV angle magnitudes.
- Inside/outside and piece hand change only the *illustrative plan sign*. They do not determine actual saw-left/saw-right, table face, blade tilt or how to orient the stock on a specific saw. The drawing explicitly requires a scrap test pair.
- Independent angle benchmark reference: https://crownmiter.com/crown-molding-angle-chart/ ; only numeric reference values are used here, NOT a machine handedness prescription.

## Stair stringer

- The exported riser top height, horizontal run and tread endpoint are checked against *all* 28 SVG profile vertices for a 14-riser varied-height fixture, using the actual documented model-to-SVG transform.
- The verified profile is a nominal 2D geometric reference, not a checked saw path, 1:1 print pattern, fastener position or structural-bearing approval. All existing support 2D line-contact cautions remain unchanged.

## Acceptance labels

- Source: tests/kerf-export-geometry.test.mjs and tests/e2e/cut-visual-contract.spec.mjs.
- Full Node, Chromium, Firefox/WebKit, A4/Letter PDF and 42-route offline SEO CI must pass on the final feature head before merge.
- Real material trials, true print scale, saw orientation, structural code and actual worker safety are NOT RUN and cannot be certified by this change.
- Cloudflare pages.dev stays noindex,nofollow,noarchive with robots.txt Disallow: / until domain and explicit release approval.
