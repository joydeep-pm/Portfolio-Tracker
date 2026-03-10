# Claude Critical Review Handoff

## Mission
Run a **critical full-project audit** and produce fix-ready findings for:
- feature correctness (what is broken or misleading)
- usability/discoverability (how to use each feature is unclear)
- typography/readability (fonts too small in multiple places)

This handoff is for a developer-grade review mindset, not a generic summary.

## Baseline Snapshot (2026-03-07)
- Repo: `/Users/joy/Portfolio Tracker`
- Branch: `main`
- Latest pushed commit at handoff time: `6d4d032`
- Local app URL: `http://127.0.0.1:4173`
- Production URL: `https://portfolio-tracker-kappa-woad.vercel.app`
- Quant engine URL: `https://portfolio-tracker-if7l.onrender.com`

## Current Architecture Map
- UI shell and views: `app.js`, `index.html`, `styles.css`
- Frontend adapter contracts: `adapterCore.js`
- Node gateway routes: `api/*.js`
- Shared backend libs/contracts: `api/_lib/*`
- Python quant boundary: `quant-engine/*`
- Thematic ingest + operational CLIs: `scripts/*`
- Living execution artifacts: `tasks/todo.md`, `tasks/lessons.md`, `tasks/handoff.md`

## Known User Pain (Priority)
1. Multiple features are not working as expected (behavioral trust gap).
2. Fonts are too small in multiple places (readability/accessibility gap).
3. It is hard to understand how to use features (discoverability gap).

## Deferred Strategic Item (Context Only, Not Current Scope)
- There is interest in a future **India AI Investment Committee** modeled on the architecture style of multi-agent investing repos such as `virattt/ai-hedge-fund`.
- For this audit, treat that as a roadmap item only.
- Do not recommend pulling it forward ahead of current correctness/readability/usability fixes unless you find a strong architectural reason.
- If you mention it, keep the recommendation narrow:
  - India-native research copilot
  - explainable ranking and paper-trading only
  - no autonomous live trading recommendation

## What Was Recently Stabilized
- Strict live ingest mode is available:
  - `node scripts/ingest-bharatfintrack.js --target-stocks 2486 --target-clusters 175 --require-live --output ./data/thematic_index_catalog.json`
- Alerts pending->dispatch->sent flow works in UI and API checks.
- Peer RS bootstrap fallback was hardened to avoid repeated 404 console spam during comparison init.

## High-Risk Areas to Re-Validate
- Comparison + peer relative-strength behavior under live/unsteady market snapshots.
- Portfolio disconnected states and downstream signals dependence.
- Signals panel action clarity when no portfolio focus stock exists.
- Quant/research command surfaces and error UX when upstream routes are unavailable.
- Network dashboard status messaging vs actual endpoint behavior.

## Critical Audit Workflow (Required)
### 1) Runtime Bring-up
```bash
cd "/Users/joy/Portfolio Tracker"
ulimit -n 65536
npx vercel dev --listen 4173
```

### 2) Regression/Contract Baseline
```bash
node --test tests/*.test.js
```

### 3) Core Data Baseline
```bash
node scripts/ingest-bharatfintrack.js --target-stocks 2486 --target-clusters 175 --require-live --output ./data/thematic_index_catalog.json
```

### 4) API Flow Matrix (manual/curl)
Validate at minimum:
- market: bootstrap + poll
- charts: normalized-returns + decision-markers
- peers: relative-strength
- portfolio: bootstrap + poll + decisions
- orders: preview + status
- macro: latest + context + harvest
- alerts: channels + enqueue + dispatch + events
- hotspots: snapshot + poll
- agents: intent + analyze
- quant: optimize-allocation + thematic-rotation + interpret + technical-candles

### 5) UI Flow Matrix (manual)
Validate end-to-end user flow in:
- Themes
- Comparison
- Portfolio
- Signals & Analysis
- Alerts
- Network
- What’s New

### 6) Typography + Usability Audit (must-do)
Check for font-size and readability failures across cards, tables, controls, helper text, and status chips.

Suggested minimum targets:
- Body/copy: >= `14px`
- Key controls/buttons/inputs: >= `14px`
- Critical table values and status labels: >= `13px`
- Prefer line-height >= `1.4` for dense content zones

Also verify:
- “How to use this” cues exist near complex features.
- Disabled states explain *why* and *how to unblock*.
- Empty states include actionable next step(s), not just absence text.

## Expected Deliverable from Claude
Return a prioritized review with:
1. Findings first (P0/P1/P2), each with file/area and exact reproduction steps.
2. For each finding: expected vs actual behavior and likely root cause.
3. Concrete patch plan grouped by theme:
   - correctness
   - typography/readability
   - discoverability/onboarding
4. Minimal-risk implementation order (what to fix first for max user impact).
5. A short note on whether the repo is ready for the deferred India AI Investment Committee phase, and if not, what blockers must be cleared first.

## Non-Negotiable Review Rules
- Do not claim a flow is healthy without reproducing it.
- Do not mark UX as acceptable if text is difficult to read at normal laptop distance.
- Prefer small, safe, high-impact fixes over broad redesigns in first pass.
- Keep architecture boundary: heavy quant logic stays in `quant-engine`, gateway stays in root `api`.
