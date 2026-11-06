# Functional and query-intent upgrades — 2026-11-06

This change deliberately preserves the original 152-row historical Semrush CSV. It adds **eight** editorial cautions for ambiguous/unsupported search intents: `pointing calculator`, `calculator center`, `center calculator`, `deck framing calculator`, `decking joist spacing calculator`, `deck joist spacing calculator`, `gambrel roof truss calculator`, `gambrel truss calculator`. These are research assignments, not proven matching user tasks. No site adds page claims or silent redirects on the basis of these terms.

## Actual feature upgrades

- Roof Pitch: selected rise-per-12, degrees, grade or measured rise/run all use a single mathematical model and export the same computed pitch. Only the selected source field participates in math; roof angle must be below 89.9 degrees.
- Equal Spacing: fixed center count remains default. A maximum actual face-gap mode calculates a minimum part count (requiring real part width). A target center-pitch mode chooses the nearest integer interval count, then recomputes actual pitch and mark positions. Invalid overlap is rejected.
- Straight Stair: the default geometry is unchanged. Deck-specific mode checks measured tread-board coverage and the entered available horizontal flight run; this is **not** a stair code, fastening, structural, stringer or footing design.
- Source fields for unused calculator modes are hidden accessibly, but their values remain local and reversible. Print/CSV data comes from the same selected calculation mode.

## Release and evidence limits

This is an app enhancement on 26 existing P0/P1 URLs, not a claim that all historical search keywords are satisfied or all P2 tools are released. Default geometry tests, mode-boundary tests, cross-browser UI tests, PDF printing and production index gate are handled by GitHub CI. Real materials, printer ruler checks and independent engineering approval remain outside automated tests. The pages.dev preview remains noindex/nofollow/noarchive.
