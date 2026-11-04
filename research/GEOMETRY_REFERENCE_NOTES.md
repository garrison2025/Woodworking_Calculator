# Geometry reference notes — rafter and stair stringer QA
Date: 2026-11-04

This note distinguishes **independently traceable trade conventions**, **math modeled here** and **work not yet validated**. It does not confer a professional design certification.

## 1. Straight stair stringer — accepted conventions

Primary external references:
- **BC Carpenter Apprenticeship Program, Level 1, H-5: Build Stair Systems**: https://bctradesmodules.gov.bc.ca/sites/bctradesmodules.gov.bc.ca/files/module_supplemental/H5.pdf — terminology (finished-floor total rise, unit rise/run), Learning Task 4, printed pages 39–42 (the browser PDF page numbers differ from the printed page numbers).
- **JLC Field Guide: Stairs**: https://www.jlconline.com/how-to/interiors/stairs/stairs-field-guide/ — consistent riser heights, finished floors and tread thickness allowance.

Conventional layout mode in `src/calcs.mjs`:
- The top landing is the uppermost walking surface. For `N` risers, there are `N-1` separate treads.
- `H = totalFinishedRise/N`. `totalHorizontalRun = (N-1)*runPerTread`.
- The j-th riser upper corner: `x = j*runPerTread`, `y = (j+1)*H`, for j from 0 through N−1. The final upper corner represents the top landing vertical reference, not an extra tread.
- Bottom cut height measured from installation reference: `H - installedTreadThickness + lowerFinishThicknessInstalledLater`. Only enter lower finish if it is installed after the stringer; do not double-count finished floor elevations.
- The normal penetration of a notch (perpendicular to a straight board's nominal sloping lower edge) in a repeated right-angle riser/tread layout is `H*T/hypot(H,T)`. The nominal remaining throat is `boardDepth - notchNormal`. This is pure planar geometry and **not** a strength calculation or a local-code compliance threshold.

Independently recomputable reference case: total rise 105 in, 14 risers, 10 in run, 11.25 in board, 1.5 in tread and 0 added lower floor finish:
`H=7.5`; treads `13`; total run `130`; bottom cut `6`; notch normal `7.5*10/12.5=6`; remaining nominal throat `5.25` inches. If lower finishing material of 0.5 in will be added later, bottom cut becomes `6.5 in`.

**Critical exclusions:** actual top connection and support, floor substrates and framing, stringer installation, wood grade and load, nosing, local stair code and physical stock geometry. The illustrative SVG is not a 1:1 verified cut sheet. Trade references explicitly recommend field-verifying difficult connections using full-size physical layout.

## 2. Common rafter with ridge/overhang and seat cut

The model assumes a straight common rafter in two dimensions with a constant rise/run roof slope; a ridge-board thickness is subtracted from the input horizontal run by half the actual thickness. `p = pitch/12`, `theta=atan(p)`, `R=run-ridgeThickness/2`.

- Rise ridge-to-bearing: `R*p`; slope line length: `R*sqrt(1+p²)`.
- Overhang slope length: `overhangHorizontal*sqrt(1+p²)`.
- Seat cut is specified as a horizontal reference distance `S` **along the bearing cut**. Its vertical roof-slope difference is `S*p`.
- Depth of the nominal seat cut measured **normal to the rafter long edge**: `S*sin(theta)` or `S*p/sqrt(1+p²)`. Nominal remaining depth: `depth - S*sin(theta)`. This is a trigonometric projection, not a structural capacity assessment.
- The separate bearing and overhang positions are reported in the takeoff schedule.

Hand calculation at pitch 6:12 with horizontal seat 3 in: `theta≈26.565°`; notch normal `3*(.5/sqrt(1.25))=1.3416407865 in`. If rafter face depth is 5.5 in, nominal normal remaining depth is `4.1583592135 in`.

**Critical exclusions:** roof loads, exact ridge and wall reference planes, real birdsmouth bearing, fascia angle, structural notch limits, collar ties and fasteners, saw kerf and dimensional lumber tolerance. Do not treat a diagram as a full-size cutting template.

## 3. Automation evidence
- Unit regression fixtures are in `tests/calculators.test.mjs` and cover exact values, altered flooring, nonzero ridge, invalid depth.
- Chromium E2E covers editable inputs, live SVG and result updates, invalid state, desktop/mobile snapshots: `tests/e2e/workspaces.spec.mjs`.
- Preview stays `noindex`. Passing math and rendering tests is **not** physical approval or a sign-off for professional construction.

## 4. Symmetric equal-pitch hip roof sheet clipping (engineering derivation)

For roof plan dimensions `W`, `L` including separately entered eave projections, normalize the longer side to `A=max(W,L)`, shorter to `B=min(W,L)`. With pitch ratio `p=pitch/12`, surface stretch across the slope is `F=sqrt(1+p²)`. The ridge has horizontal length `A-B`, and the four roof planes comprise two trapezoids and two end triangles.

Each **side trapezoid** in its own actual slope-face coordinates `(u=eave-axis, v=uphill)` has vertices `(0,0),(A,0),(A-B/2,BF/2),(B/2,BF/2)`. Each **end triangle** has `(0,0),(B,0),(B/2,BF/2)`. Two of each face give total sloped surface area `W*L*F`. This is independent of tile choice.

Choose rectangular sheet dimensions `S_u,S_v`; the orientation selector swaps them. Start a grid at each plane's eave origin. Clip each sheet rectangle against its roof-plane polygon with four consecutive half-plane operations (Sutherland–Hodgman style). Reject zero-area intersections. The area of a clipped sheet polygon is computed by the shoelace formula and is required to sum to `W*L*F` within the fixed numerical tolerance. Each nonempty clipped polygon currently consumes **one new sheet**; no offcut reuse, fastener spacing, staggered sheets, gap widths, seam topology or fitting optimization is done.

A flat 192 × 96 in footprint with 96 × 48 in stock has area `18,432 sq in` and theoretical minimum `ceil(18,432/4,608)=4` sheets. Eave-parallel long edge: two side sheets per long side and one per short hip => **6 separate sheet positions**; after rotating sheet orientation 90° it becomes **12 positions**. This demonstrates why area-only counts are inadequate under explicit no-offcut-reuse assumptions.

The two-dimensional cut coordinate list is defined **relative to each sheet's own lower-left origin in its roof plane**, measured in physical slope-face inches. Plan SVG projection folds the same polygon coordinates back to overhead building geometry. This still is NOT a verified full-size cutting pattern, roof installation specification or engineered sheathing approval.

**Evidence:** deterministic fixtures and 72 slope/dimension/orientation differential checks in `tests/calculators.test.mjs`, actual interactive browser tests in `tests/e2e/workspaces.spec.mjs`, [GitHub Actions run #41793989952](https://github.com/garrison2025/Woodworking_Calculator/actions/runs/41793989952).
