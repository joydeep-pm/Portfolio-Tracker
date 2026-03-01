# Lessons Learned (Portfolio Tracker)

Record repeatable mistakes and prevention rules here.

## Template

- Date:
- Issue:
- Root cause:
- Prevention rule:
- Applied fix:

## Current seed entries

- Date: 2026-03-01
- Issue: Initial thematic framing was interpreted as global-first instead of India-specific.
- Root cause: Region scope was not treated as a hard constraint before taxonomy and naming decisions.
- Prevention rule: Lock `market_scope` first, then validate heads, clusters, symbols, and exchanges against that scope before polishing UI.
- Applied fix: Retargeted taxonomy to India sectors and exchange context (`NSE`/`BSE`) across Themes and Comparison flows.

- Date: 2026-03-01
- Issue: Comparison was at risk of being treated as an optional add-on instead of a core workflow.
- Root cause: Initial MVP focus was matrix rendering, not cross-cluster analysis.
- Prevention rule: For market-analytics tools, define comparison requirements in v1 scope (selection, windows, filters, scan panel).
- Applied fix: Added a dedicated Comparison view with multi-cluster chips, timeframe toggles, exchange filters, normalized chart, and momentum scan.

- Date: 2026-03-01
- Issue: Synthetic-market demos can drift across runs and make QA hard to reproduce.
- Root cause: Randomized generation and live updates are unstable without deterministic seeding.
- Prevention rule: Use seeded generators and deterministic allocation logic for every scale-bound demo dataset.
- Applied fix: Anchored universe generation to a fixed seed and explicit targets (`2486` stocks, `26` heads, `175` clusters).

- Date: 2026-03-01
- Issue: Real-time updates can desync detail views from matrix state.
- Root cause: Live ticks mutate momentum values while modal/detail UI may stay static unless explicitly refreshed.
- Prevention rule: When live loops are enabled, re-render any open detail surface that depends on mutable series state.
- Applied fix: Wired live tick updates to refresh open cluster composition modal and comparison scan output.

- Date: 2026-03-01
- Issue: Scope creep risk (backend/feed work) can delay delivery of a usable visual prototype.
- Root cause: Real-time market tooling invites infrastructure expansion before interaction model is proven.
- Prevention rule: Ship deterministic front-end prototype first; defer live feed/backend integration until UX and analytic surfaces are validated.
- Applied fix: Implemented the first version as standalone HTML/CSS/JS with local simulation and explicit out-of-scope notes.
