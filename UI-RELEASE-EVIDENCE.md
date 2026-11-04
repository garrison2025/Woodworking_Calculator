# UI release evidence (2026-11-04)
## Implemented in code
- Workbench layout: left input, central original SVG diagram, right calculation outputs, mobile re-order.
- UI tokens and component rules: `DESIGN.md`, `src/style.css`.
- Interaction code: `src/app.mjs`; all 26 routes use local geometry results, in/mm toggle, 1/16 and 1/32 fraction approximation, client-generated CSV/SVG and print-to-PDF.
- Recent tools displayed from browser-local history, error state, live region, skip-to-main, focus-visible, keyboard buttons and reduced-motion CSS are present in source.
## Evidence states
- Code inspection / static references: **IMPLEMENTED**, not a visual test.
- Desktop screenshot: **NOT RUN**.
- Mobile screenshot / overflow audit: **NOT RUN**.
- Contrast measurement and touch validation: **NOT RUN**.
- Browser PDF / 100% print scale: **NOT RUN**.
- External browser source availability: **NOT RUN** (no deployed preview address supplied).

Remain `noindex` until these are completed. No screenshots or performance metrics are fabricated.
