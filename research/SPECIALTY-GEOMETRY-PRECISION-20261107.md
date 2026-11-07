# Specialty Geometry Precision: spiral, gambrel and stave (2026-11-07)

**Source of truth:** current 31 P0/P1 calculator routes in `src/tools.json`; all geometry is in inches, cut-coordinate grids are quantized at 1e-8 in. This review covers plan/section geometry rather than professional structural or fabrication approval.

## Spiral staircase — two legitimately different areas

For outer pole-to-edge radius `R`, pole radius `r` and one tread's positive sector angle `θ` in radians:

- **Curved annular sector area** `A_sector = (R²-r²)θ/2` square inches.
- **Straight-chord four-vertex polygon area** `A_chord = (R²-r²)sin(θ)/2` square inches.

The SVG currently draws four joined straight vertices. These straight chord edges enclose **less** area than a truly curved outside/inside face. The metrics and CSV now contain *both* area values, distinctly labeled. For the standard 15-riser / 14-tread, 72 in diameter, 4 in pole and 360° example, the difference is physical, not a rounding defect. The difference is **not** automatically a waste allowance or a purchasable board-blank count. Actual curved-nose and support details are outside the model.

Input guards reject tiny positive riser heights, pole/walk-line chord geometry and radial edges that cannot be represented in exported coordinates. A zero-like row cannot masquerade as a legitimate nonzero physical tread.

## Symmetric two-pitch gambrel

Horizontal half-span `H=(buildingWidth+2eave)/2`; `upperRun=H-lowerRun`. The four roof faces have independent exported start/end X and elevation. The drawing uses one scale across all four segments. Each positive lower/upper horizontal run, corresponding rise and emitted coordinate endpoints must remain representable on the export coordinate grid.

For each section: `slope = hypot(horizontalRun,verticalRise)`. Surface area includes both symmetric lower faces and both symmetric upper faces at the roof's entered longitudinal length. No truss or cut-template certification follows from these figures.

## Tapered polygon-frustum stave

The stave is modeled as a straight-sided trapezoid, **not** a curved barrel bulge. Top and bottom chords follow `D*sin(π/N)`, while the face-center slant and the longer corner-edge true length are distinct. A new SVG local-scale and origin annotation lets the browser independently translate each of its four actual pixel corners to the machine-readable millimeter CSV plan vertices. The shoelace polygon area must equal the independent trapezoid area within rounding tolerance.

## Regression and release boundaries

- Node: `tests/specialty-geometry-precision.test.mjs` independently verifies curved-sector vs chord-polygon areas, polygon shoelace closure, roof-face sum and bounds, stave chord/slant references and rejected sub-resolution inputs.
- Browser: `tests/e2e/specialty-precision.spec.mjs` compares **every** physical spiral wedge vertex, gambrel slope endpoint and stave corner with actual rendered SVG and exported metric CSV. It also exercises invalid-state clearing and recovery.
- Existing 31-tool sitewide CSV/diagram and complete print tests remain required.
- **No** physical material, printed ruler, structural load, genuine curved tread, jig, wood grade or qualified signoff was tested. This code cannot provide them.

All Cloudflare `pages.dev` routes remain **noindex,nofollow,noarchive** with `robots.txt Disallow: /`. No purchased custom domain or publication approval was assumed.
