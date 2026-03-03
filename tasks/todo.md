# Thematic Engine Build Plan

## Plan
- [x] Initialize project structure for a standalone browser app
- [x] Implement generated market universe (2,486 stocks, 26 core heads, 175 micro-clusters)
- [x] Build thematic matrix UI with heatmap momentum cells (1D, 1W, 1M, 6M, YTD)
- [x] Add interaction features: stock search, mode filters, cluster drill-down modal
- [x] Simulate live momentum updates and refresh aggregate values
- [x] Verify behavior locally and document review results
- [x] Retarget taxonomy and labeling to Indian market-only coverage (NSE/BSE context)
- [x] Build comparison view with cluster multi-select and control toolbar
- [x] Add normalized comparison chart with timeframe switching (`1D`, `5D`, `1M`, `6M`, `YTD`)
- [x] Add NSE/BSE comparison filter and relative-strength scan side panel
- [x] Add live update loop for selected cluster series in comparison view
- [x] Verify comparison workflows and document results

## Verify Plan Check-In
- Scope is a functional MVP that reproduces the interaction model and visual framing from the reference screenshots.
- Stack decision: plain HTML/CSS/JS to keep setup friction near zero in an empty repo.
- Data decision: deterministic synthetic universe matching target scale exactly.
- Comparison v1 scope: compare any combination of clusters from all 175 micro-clusters, render normalized series, support timeframe/exchange filters, and show a relative-strength scan for selected set.
- Out of scope for this step: real market feed integration and backend APIs.

## Review
- `node --check app.js` passed.
- Manual runtime verification through Playwright:
  - loaded app at `http://127.0.0.1:4173/index.html`
  - verified universe totals render as 2,486 stocks / 26 heads / 175 clusters
  - verified search + mode filtering pathways update matrix
  - verified cluster click opens composition modal
  - verified live ticks update pulse while modal is open (no modal state exception)
  - verified browser console has zero errors
- Indian-market retarget verification:
  - confirmed page title and hero copy are India-specific
  - confirmed thematic heads are India market sectors (BFSI, PSU, defence, ports, etc.)
  - confirmed exchange mix card and modal exchange breakdown render (`NSE` / `BSE`)
  - confirmed symbol formatting renders as `NSE:XXXXX123` / `BSE:XXXXX123`
  - confirmed browser console has zero errors after retarget
- Comparison v1 verification:
  - `node --check app.js` passed after comparison implementation
  - switched between Themes and Comparison views via top nav links
  - confirmed initial cluster chips render and normalized chart canvas is visible
  - confirmed timeframe toggle (`5D`) and exchange filter (`NSE`) update comparison meta
  - confirmed cluster search (`Defence`) returns suggestions and adds selected cluster chip
  - confirmed relative-strength scan panel updates and live tick increments (`tick #9` -> `tick #10`)
  - confirmed browser console has zero errors during comparison interactions

## Branding Cleanup Plan (2026-03-01)
- [x] Identify borrowed or third-party style labels in UI and docs.
- [x] Replace visible UI copy with project-owned terminology in `index.html` and runtime strings.
- [x] Align project docs (`README.md`, `lessons.md`, `memories.md`, `tasks/todo.md`) with the new naming.
- [x] Verify no targeted borrowed labels remain in the repo.

## Branding Cleanup Verify Plan Check-In
- Scope: copy-only cleanup, no behavioral logic changes.
- Safety: preserve element IDs, data attributes, and JS hooks so navigation and interactions remain intact.

## Branding Cleanup Review
- Verified removal of legacy borrowed labels using a repo-wide case-insensitive keyword sweep.
- Spot-checked UI labels in `index.html` after edits:
  - brand now `PORTFOLIO TRACKER`
  - nav labels now use `Sectors` and `Signals`
  - hero heading now `Thematic Map`
  - comparison heading now `Cluster Comparison`

## Real Data Adapter Plan (2026-03-01)
- [x] Add adapter core module with DTO validation, poll cadence/backoff helpers, merge utilities, and backend adapter HTTP client.
- [x] Wire app runtime config (`window.PORTFOLIO_TRACKER_CONFIG`) and adapter factory (`backend` / `synthetic`) into boot path.
- [x] Replace fixed interval loop with scheduler-based polling (adaptive market-hours for backend, retry/backoff, stale-state handling).
- [x] Route comparison series through adapter hooks and keep synthetic fallback path for local/demo mode.
- [x] Add topbar data status UI (source mode, freshness, stale/error chip).
- [x] Add Node unit tests for normalization, scheduler/backoff, merge logic, and comparison series mapping.
- [x] Update README with backend integration contract and operational behavior.

## Real Data Adapter Verify Plan Check-In
- Scope: frontend adapter hooks and contracts only; no backend service implementation.
- Safety: preserve existing render and interaction behavior while changing only data source lifecycle and status surfacing.

## Real Data Adapter Review
- Validation commands:
  - `node --check app.js`
  - `node --check adapterCore.js`
  - `node --test tests/adapterCore.test.js`
- Unit tests passed (`8/8`):
  - bootstrap payload normalization success + validation failures
  - poll payload validation for missing return windows
  - adaptive market-hours polling interval logic
  - exponential retry backoff cap
  - stale-state trigger rules
  - state merge behavior for stock updates and empty updates
  - comparison series payload mapping to chart points
- Manual constraints acknowledged:
  - backend endpoints are contract-defined but not available in this repo, so end-to-end fetch verification is pending staging/backend availability.

## Activation Bridge Plan (2026-03-02)
- [x] Add mock backend contract endpoints for `/api/v1/market/bootstrap`, `/api/v1/market/poll`, and `/api/v1/comparison/series`.
- [x] Add shared mock market generator/state helper for consistent payloads across endpoints.
- [x] Add one-click Angel integration health endpoint at `/api/angel/health` to validate env readiness.
- [x] Refine topbar status behavior for stale/error/freshness clarity while backend activation is pending.
- [x] Update README with mock-mode usage and health-check workflow.
- [x] Verify syntax and API contract behavior using local Node checks and endpoint invocation scripts.

## Activation Bridge Verify Plan Check-In
- Scope: unblock integration progress while live Angel account activation is pending.
- Safety: keep existing frontend adapter contracts intact; new APIs must conform to already-implemented DTOs.

## Activation Bridge Review
- Added backend mock contract routes:
  - `api/v1/market/bootstrap.js`
  - `api/v1/market/poll.js`
  - `api/v1/comparison/series.js`
- Added shared in-memory market simulator:
  - `api/_lib/mockMarket.js`
- Added env-readiness probe endpoint:
  - `api/angel/health.js`
- Frontend status polish:
  - freshness chip now includes relative time + `asOf` timestamp
  - stale health uses warning visual style, errors use alert style
- Documentation updates:
  - mock backend mode config and health-check workflow in `README.md`
- Validation:
  - `node --check app.js`
  - `node --check api/_lib/mockMarket.js`
  - `node --check api/v1/market/bootstrap.js`
  - `node --check api/v1/market/poll.js`
  - `node --check api/v1/comparison/series.js`
  - `node --check api/angel/health.js`
  - `node --test tests/adapterCore.test.js tests/mockApi.test.js` (13/13 passing)

## Zerodha Portfolio Plan (2026-03-03)
- [ ] Add broker provider abstraction and implement `kite-direct` + `kite-mcp` (stub) providers.
- [ ] Add Zerodha auth/session endpoints (`/api/zerodha/auth/url`, `/api/zerodha/callback`, `/api/zerodha/session/status`).
- [ ] Add portfolio API contracts (`bootstrap`, `poll`, `decisions`, `snapshots/eod`) with decision-engine output.
- [ ] Add Supabase-backed snapshot persistence helper with safe fallback when env is missing.
- [ ] Add phase-2 gated order APIs (`preview`, `submit`, `status`) with dry-run default behavior.
- [ ] Add `Portfolio` as a separate top-nav page in existing dashboard UI with heatmap, filters, and decision panel.
- [ ] Extend frontend adapter/runtime for portfolio bootstrap/poll and status updates.
- [ ] Add tests for decision engine, provider contract, portfolio APIs, and order gating.
- [ ] Update README with Zerodha setup, env vars, portfolio API usage, and trading safety flags.

## Zerodha Portfolio Verify Plan Check-In
- Scope: integrate Portfolio inside current dashboard without breaking existing Themes/Comparison behavior.
- Safety: order placement remains gated (dry-run by default), single-user model, equity-cash scope only.

## Data Command Rebrand Plan (2026-03-04)
- [x] Add UI variant runtime contract (`uiVariant`, `enableComparisonClassic`) and wire root variant hook.
- [x] Restructure `Themes` page IA: command bar, snapshot strip, return bands dock, compact sector blocks.
- [x] Restructure `Portfolio` page IA: command bar with source chips, snapshot tiles, compact holdings grid, rationale panel.
- [x] Replace shared visual tokens and typography with Data Command system (Slate + Teal, Satoshi, border-first).
- [x] Update app rendering templates/classes and copy labels for legal distinctiveness and scan clarity.
- [x] Keep `Comparison` behavior intact while inheriting shared shell token updates only.
- [x] Update `README.md` with UI variant/branding section and runtime config details.
- [x] Add redesign validation notes to `tasks/todo.md` review section after checks.

## Data Command Verify Plan Check-In
- Scope: redesign Themes and Portfolio only; preserve backend contracts, decision logic, and data adapters.
- Safety: maintain existing IDs/event hooks where required to avoid interaction regressions.
- Rollback: preserve a `classic` variant path through runtime config for quick fallback.

## Data Command Review
- Updated page structure:
  - Themes now uses `themes-header` + `themes-command-bar` + `snapshot-strip` + matrix workspace.
  - Portfolio now uses `portfolio-header` + source/connection chips + `portfolio-command-bar` + compact holdings grid + rationale panel.
- Updated identity system:
  - Satoshi typography via Fontshare.
  - Slate + Teal token system in `styles.css` with border-first surfaces.
  - Removed old premium-minimal copy style patterns and renamed key labels (`Theme Command Grid`, `Return Bands`, `Momentum Radar`, `Signal Rationale`).
- Runtime UI hooks:
  - Added `uiVariant` and `enableComparisonClassic` parsing in `readRuntimeConfig()`.
  - Added body dataset binding in `applyUiVariantConfig()`.
  - Added portfolio source/connection chip rendering and scan-priority row sorting (`action_then_confidence`).
- Validation:
  - `node --check app.js`
  - `node --check adapterCore.js`
  - `node --check api/_lib/portfolioAssembler.js`
  - `node --check api/_lib/decisionEngine.js`
  - `node --test tests/adapterCore.test.js tests/mockApi.test.js tests/portfolioAssembler.test.js` (15/15 passing)
- Manual-browser note:
  - Automated Playwright smoke could not be run in this environment because Chrome persistent context failed to launch (`Opening in existing browser session`).
