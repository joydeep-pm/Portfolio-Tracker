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

## Themes Grid Spillover Hotfix Plan (2026-03-04)
- [x] Convert Themes rows to two-tier structure (label/count + metrics strip) to avoid single-row compression.
- [x] Keep metric chips boxed and aligned via dedicated metrics grid wrapper.
- [x] Preserve row click behavior and existing modal drill-down hook.
- [x] Record corrective lesson for layout architecture.

## Roadmap Operationalization + Wave 1 Kickoff Plan (2026-03-04)
- [x] Create roadmap tracker file (`tasks/roadmap.md`) with Wave 1-4 structure and release gates.
- [x] Expand roadmap with actionable itemization and live status/evidence updates.
- [x] Implement `W1.1` broker provider contract enforcement.
- [x] Implement `W1.5` headless portfolio snapshot CLI with table/json modes and export support.
- [x] Add Wave 1 tests for provider contract + CLI output schema and exports.
- [x] Run validation checks and record evidence.

## Roadmap Operationalization Verify Plan Check-In
- Scope: planning/tracking hardening + first Wave 1 executable deliverables (`W1.1`, `W1.5`, partial `W1.7`).
- Safety: no changes to live trading execution path; dry-run defaults unchanged.
- Backward compatibility: existing API contracts and frontend behavior remain intact.

## Roadmap Operationalization Review
- Tracking updates:
  - Added active execution board, Wave 1 dependencies, acceptance criteria, and evidence in `tasks/roadmap.md`.
  - Marked `W1.1` and `W1.5` as complete, `W1.7` as in progress.
- Code updates:
  - Provider contract enforcement in `api/_lib/brokers/providerFactory.js` (`assertProviderContract`).
  - New CLI command: `scripts/portfolio-snapshot.js`.
  - README usage section for headless CLI.
  - New tests: `tests/providerFactory.test.js`, `tests/portfolioCli.test.js`.
- Validation:
  - `node --check api/_lib/brokers/providerFactory.js`
  - `node --check scripts/portfolio-snapshot.js`
  - `node --test tests/providerFactory.test.js tests/portfolioCli.test.js` (7/7 pass)
  - `node --test tests/adapterCore.test.js tests/mockApi.test.js tests/portfolioAssembler.test.js` (15/15 pass)
  - Manual smoke: `node scripts/portfolio-snapshot.js --mode summary --format table --exchange all`

## Wave 1 Foundation Follow-up (2026-03-04)
- [x] Add dedicated EOD runner script for cron/manual execution (`scripts/run-eod-snapshot.js`).
- [x] Add idempotency test for EOD snapshot persistence in memory mode.
- [x] Verify EOD runner with sample date output.

## Network Connectivity Dashboard Plan (2026-03-04)
- [x] Add a dedicated `Network` top-nav view and section shell in `index.html`.
- [x] Implement live connectivity probe logic in `app.js` for Zerodha, Angel, market, portfolio, and macro endpoints.
- [x] Render provider/source/API status cards + endpoint diagnostics table in the new view.
- [x] Add refresh controls and auto-refresh cadence while the Network view is active.
- [x] Add native-styled CSS for the new view using existing design tokens/classes.
- [x] Add a "What's New" entry and validate syntax/runtime behavior.

## Network Connectivity Dashboard Verify Plan Check-In
- Scope: UI + client-side diagnostics only, no backend contract changes.
- Safety: reuse existing endpoints and fail-open in the dashboard when one probe fails.

## Network Connectivity Dashboard Review
- Code updates:
  - `index.html` (new `Network` nav target + `networkView` page layout)
  - `app.js` (endpoint probes, provider/flow derivation, renderers, view routing, auto-refresh, What's New entry)
  - `styles.css` (network view cards, diagnostics table, responsive behavior)
- Validation:
  - `node --check app.js`
  - `node --check api/angel.js api/market.js api/portfolio.js api/zerodha.js`
  - `node --test tests/*.test.js` (87/87 pass)

## Angel Historical Integration Plan (2026-03-04)
- [x] Add Angel historical API config surface (`ANGEL_HISTORICAL_API_KEY`) and health visibility.
- [x] Patch `kite-direct` provider to fetch `1W/1M/6M/YTD` returns from Angel candle endpoint when Angel overlay is connected.
- [x] Keep deterministic fallback behavior only when Angel historical fetch is unavailable.
- [x] Add automated tests for Angel historical return derivation + fallback behavior.
- [x] Update docs (`.env.example`, `README.md`) with required env vars and verification steps.
- [x] Run tests and record evidence.

## Angel Historical Verify Plan Check-In
- Scope: market-data layer only (returns computation), no portfolio ownership/provider-switch changes.
- Safety: preserve existing quote overlay and Zerodha session flow; historical fetch failures must fail open to existing fallback path.

## Angel Historical Integration Review
- Code updates:
  - `api/_lib/brokers/kiteDirectProvider.js` (Angel candle history path + fallback chaining)
  - `api/_lib/configHealth.js` (historical key visibility/profile)
  - `api/angel.js` (health route now reports optional historical key status)
  - `tests/kiteAngelOverlay.test.js` (historical return derivation test + key routing assertion)
  - `.env.example`
  - `README.md`
  - `app.js` (`What's New` entry)
- Validation:
  - `node --check api/_lib/brokers/kiteDirectProvider.js`
  - `node --check api/_lib/configHealth.js`
  - `node --check api/angel.js`
  - `node --test tests/kiteAngelOverlay.test.js tests/configHealth.test.js` (5/5 pass)
  - `node --test tests/angelSession.test.js tests/mockApi.test.js` (8/8 pass)
  - `node --test tests/*.test.js` (84/84 pass)

## Live Themes (Angel) Plan (2026-03-04)
- [x] Add Angel live market service for themed `heads/clusters/stocks` payload assembly from catalog constituents.
- [x] Wire `/api/v1/market/bootstrap` and `/api/v1/market/poll` to Angel live path when Angel session is connected.
- [x] Keep mock fallback only when Angel session/data is unavailable.
- [x] Wire `/api/v1/comparison/series` to live cluster IDs to avoid mismatch with Themes live mode.
- [x] Add automated tests for live market assembly + comparison series compatibility.
- [x] Update docs and in-app `What's New` feed.
- [x] Run full regression suite and record evidence.

## Live Themes (Angel) Verify Plan Check-In
- Scope: Themes/Comparison market data surfaces only; portfolio ownership remains Zerodha-backed and unchanged.
- Safety: runtime falls back to existing mock market provider only when Angel session/calls fail.

## Live Themes (Angel) Review
- Code updates:
  - `api/_lib/angelLiveMarket.js` (new live market assembly and comparison helper)
  - `api/market.js` (Angel live mode routing + fallback)
  - `api/comparison.js` (Angel live comparison routing + fallback)
  - `data/angel_symbol_tokens.seed.json` (pre-seeded token map to avoid serverless `searchScrip` 403 throttling)
  - `tests/angelLiveMarket.test.js` (live view + comparison tests)
  - `README.md`
  - `app.js` (`What's New` update)
- Validation:
  - `node --check api/_lib/angelLiveMarket.js`
  - `node --check api/market.js`
  - `node --check api/comparison.js`
  - `node --test tests/angelLiveMarket.test.js tests/mockApi.test.js` (8/8 pass)
  - `node --test tests/*.test.js` (87/87 pass)

## Phase 1 Macro Harvester Plan (2026-03-04)
- [x] Add modular harvester service for RBI/SEBI RSS ingestion with clean field extraction (`title`, `link`, `pubDate`, `description`).
- [x] Add RBI feed discovery from `https://www.rbi.org.in/Scripts/rss.aspx` and parse Press Releases + Notifications feeds.
- [x] Add SQLite storage (`macro_events.db`) with `market_news` table + dedupe via unique `url`.
- [x] Add hard-priority tagger (`RBI`, `SEBI`, `NBFC`, `digital lending`, `KYC`, `payments`, `capital markets`).
- [x] Add manual run interface (`scripts/harvest-macro-news.js`) plus API route (`/api/v1/macro/harvest`, `/api/v1/macro/latest`).
- [x] Add automated tests for parsing, dedupe, tagging, and route behavior.
- [x] Update README/env template with usage and operational notes.

## Phase 1 Macro Harvester Verify Plan Check-In
- Scope: asynchronous external context ingestion only (no live-tick dependency, no order flow changes).
- Safety: read-only external fetch + SQLite writes in `data/macro_events.db`; no mutation of portfolio execution paths.
- Fallback: if one source feed fails, throw explicit fetch error; dedupe safety retained via `INSERT OR IGNORE`.

## Phase 1 Macro Harvester Review
- Code updates:
  - `api/_lib/macroHarvester.js`
  - `api/macro.js`
  - `scripts/harvest-macro-news.js`
  - `tests/macroHarvester.test.js`
  - `tests/macroApi.test.js`
  - `api/_lib/contracts.js`
  - `vercel.json`
  - `.env.example`
  - `README.md`
  - `package.json` + `package-lock.json` (`rss-parser`, `better-sqlite3`)
- Validation:
  - `node --check api/_lib/macroHarvester.js`
  - `node --check api/macro.js`
  - `node --check scripts/harvest-macro-news.js`
  - `node --test tests/macroHarvester.test.js tests/macroApi.test.js` (7/7 pass)
  - `node --test tests/*.test.js` (72/72 pass)
  - Manual live run 1: `node scripts/harvest-macro-news.js --format table --per-source 5 --limit 5` => `Inserted>0 Duplicates=0`
  - Manual live run 2: same command => `Inserted=0 Duplicates>0` (dedupe proven)

## Wave 1 Foundation Follow-up Review
- Validation:
  - `node --check scripts/run-eod-snapshot.js`
  - `node --test tests/snapshots.test.js tests/providerFactory.test.js tests/portfolioCli.test.js` (8/8 pass)
  - `node scripts/run-eod-snapshot.js --snapshot-date 2099-12-31 --exchange all` returned `{ stored: true, mode: "memory" }`

## Wave 1 Auth + BharatFinTrack + Mapping Plan (2026-03-04)
- [x] Harden Zerodha auth/session lifecycle (expiry cutoff, logout, cookie/session clear).
- [x] Build BharatFinTrack ingestion job with normalized catalog output.
- [x] Add holdings-to-theme normalized mapping and attach to portfolio snapshots.
- [x] Add/expand automated tests for auth/session, ingestion, thematic mapping, and enriched portfolio payloads.
- [x] Update roadmap statuses/evidence and README usage notes.

## Wave 1 Auth + BharatFinTrack + Mapping Review
- Code updates:
  - Session hardening: `api/_lib/zerodhaSession.js`, `api/zerodha.js`, `api/portfolio.js`, `api/orders.js`, `vercel.json`.
  - BharatFinTrack ingest/catalog: `scripts/ingest-bharatfintrack.js`, `data/bharatfintrack_seed.json`, `data/thematic_index_catalog.json`.
  - Thematic mapping engine: `api/_lib/thematicCatalog.js`, `api/_lib/thematicMapping.js`, `api/_lib/portfolioService.js`.
  - Tests: `tests/zerodhaAuth.test.js`, `tests/bharatfintrackIngest.test.js`, `tests/thematicMapping.test.js`, `tests/portfolioServiceThematic.test.js`.
- Validation:
  - `node --check api/_lib/zerodhaSession.js`
  - `node --check api/zerodha.js`
  - `node --check api/_lib/thematicCatalog.js`
  - `node --check api/_lib/thematicMapping.js`
  - `node --check scripts/ingest-bharatfintrack.js`
  - `node --test tests/adapterCore.test.js tests/mockApi.test.js tests/portfolioAssembler.test.js tests/providerFactory.test.js tests/portfolioCli.test.js tests/snapshots.test.js tests/zerodhaAuth.test.js tests/thematicMapping.test.js tests/bharatfintrackIngest.test.js tests/portfolioServiceThematic.test.js` (30/30 pass)

## Wave 2 Screener + Hotspot Engine Plan (2026-03-04)
- [x] Add PKScreener-style adapter (`breakout`, `consolidation`, `momentum_anomaly`) with live-command hook + deterministic fallback.
- [x] Build hotspot service with IST cadence cache and stale/failure scheduler metadata.
- [x] Join scan results with thematic mappings and compute ranked hotspot scores.
- [x] Expose hotspots via API (`snapshot`, `poll`) and headless CLI export command.
- [x] Add Wave 2 tests and execute full regression suite.
- [x] Update roadmap and README docs with Wave 2 contracts.

## Wave 2 Screener + Hotspot Engine Review
- Code updates:
  - `api/_lib/pkscreenerAdapter.js`
  - `api/_lib/hotspotService.js`
  - `api/hotspots.js`
  - `scripts/hotspots-snapshot.js`
  - `vercel.json` rewrites for `/api/v1/hotspots/*`
- Tests added:
  - `tests/pkscreenerAdapter.test.js`
  - `tests/hotspotService.test.js`
  - `tests/hotspotsApi.test.js`
- Validation:
  - `node --check api/_lib/pkscreenerAdapter.js`
  - `node --check api/_lib/hotspotService.js`
  - `node --check api/hotspots.js`
  - `node --check scripts/hotspots-snapshot.js`
  - `node --test tests/pkscreenerAdapter.test.js tests/hotspotService.test.js tests/hotspotsApi.test.js` (7/7 pass)
  - `node --test tests/adapterCore.test.js tests/mockApi.test.js tests/portfolioAssembler.test.js tests/providerFactory.test.js tests/portfolioCli.test.js tests/snapshots.test.js tests/zerodhaAuth.test.js tests/thematicMapping.test.js tests/bharatfintrackIngest.test.js tests/portfolioServiceThematic.test.js tests/pkscreenerAdapter.test.js tests/hotspotService.test.js tests/hotspotsApi.test.js` (37/37 pass)
  - `node scripts/hotspots-snapshot.js --mode summary --format table --exchange all`
  - `node scripts/hotspots-snapshot.js --mode detailed --format json --exchange all --export ./artifacts/hotspots.json`

## Wave 3 Multi-Agent Core Plan (2026-03-04)
- [x] Add intent router for natural-language prompt classification and context extraction.
- [x] Add LangGraph-style workflow orchestrator for portfolio/market/news/recommendation nodes.
- [x] Add lightweight news RAG store and retrieval layer with sentiment aggregation.
- [x] Add weighted consensus decision scoring with risk controls and explanation schema.
- [x] Expose agent APIs and CLI for intent + analysis workflows.
- [x] Add Wave 3 automated tests and run full regression suite.

## Wave 3 Multi-Agent Core Review
- Code updates:
  - `api/_lib/agentRouter.js`
  - `api/_lib/newsRagStore.js`
  - `api/_lib/multiAgentEngine.js`
  - `api/agents.js`
  - `scripts/agents-analyze.js`
  - `data/news_corpus_seed.json`
  - `vercel.json` rewrites for `/api/v1/agents/*`
- Tests added:
  - `tests/agentRouter.test.js`
  - `tests/newsRagStore.test.js`
  - `tests/multiAgentEngine.test.js`
  - `tests/agentsApi.test.js`
- Validation:
  - `node --check api/_lib/newsRagStore.js`
  - `node --check api/_lib/agentRouter.js`
  - `node --check api/_lib/multiAgentEngine.js`
  - `node --check api/agents.js`
  - `node --check scripts/agents-analyze.js`
  - `node --test tests/agentRouter.test.js tests/newsRagStore.test.js tests/multiAgentEngine.test.js tests/agentsApi.test.js` (8/8 pass)
  - `node scripts/agents-analyze.js --prompt "evaluate my portfolio against current PSU bank thematic momentum" --format table --exchange all`
  - `node scripts/agents-analyze.js --prompt "evaluate my portfolio against current PSU bank thematic momentum" --format json --exchange all --export ./artifacts/agent-analysis.json`

## Wave 4 Streamlit UI Integration Plan (2026-03-04)
- [x] Scaffold Streamlit app and connect to backend APIs.
- [x] Build portfolio, hotspots, and agent recommendation panels.
- [x] Add user controls (exchange, refresh, prompt, watchlist trigger).
- [x] Add Streamlit dependency and run script.
- [-] Add UI regression snapshots/manual QA (pending environment-driven browser checks).

## Wave 4 Streamlit UI Integration Review
- Code updates:
  - `streamlit_app.py`
  - `requirements-streamlit.txt`
  - `scripts/run-streamlit-dashboard.sh`
- Validation:
  - `python3 -m py_compile streamlit_app.py`
  - `bash -n scripts/run-streamlit-dashboard.sh`
- Notes:
  - Functional API integration is wired for `/api/v1/portfolio/bootstrap`, `/api/v1/hotspots/snapshot`, and `/api/v1/agents/analyze`.
  - Visual regression snapshots and manual desktop/mobile QA are still pending.

## Cross-Wave Observability + Contracting (2026-03-04)
- [x] Add API contract-version constants for Wave 2/3 endpoints.
- [x] Add trace ID helper and structured JSON logging helper.
- [x] Integrate trace ID + contract metadata into hotspots and agents APIs.
- [x] Update API tests to assert `meta.contractVersion` and `meta.traceId`.
- [-] Expand trace/contract coverage to all legacy Wave 1 endpoints (pending).

## Cross-Wave Observability + Contracting Review
- Code updates:
  - `api/_lib/contracts.js`
  - `api/_lib/trace.js`
  - `api/hotspots.js`
  - `api/agents.js`
- Validation:
  - `node --check api/hotspots.js`
  - `node --check api/agents.js`
  - `node --test tests/hotspotsApi.test.js tests/agentsApi.test.js` (4/4 pass)

## Cross-Wave Safety Guardrails (2026-03-04)
- [x] Add recommendation disclaimer constant for agent outputs.
- [x] Add guardrail helper to constrain confidence and downgrade low-confidence aggressive actions.
- [x] Integrate guardrails/disclaimer into multi-agent recommendation pipeline.
- [x] Add automated tests for safety helper and decision schema persistence.
- [-] Extend safety guardrails uniformly to all legacy recommendation endpoints.

## Cross-Wave Safety Guardrails Review
- Code updates:
  - `api/_lib/safety.js`
  - `api/_lib/multiAgentEngine.js`
  - `tests/safety.test.js`
  - `tests/multiAgentEngine.test.js`
- Validation:
  - `node --check api/_lib/safety.js`
  - `node --test tests/safety.test.js tests/multiAgentEngine.test.js tests/agentsApi.test.js` (6/6 pass)

## Cross-Wave Closure Sprint Plan (2026-03-04)
- [x] Finalize X4 backfill/replay strategy with service, CLI, and tests.
- [x] Expand trace coverage to legacy APIs (`portfolio`, `orders`, `zerodha`, `market`, `comparison`).
- [x] Expand contract metadata to legacy APIs and all JSON CLI envelopes.
- [x] Extend safety disclaimer/guardrails to legacy decision endpoint (`portfolio/decisions`).
- [x] Add Streamlit snapshot capture workflow and produce desktop/mobile evidence artifacts.
- [x] Re-run full automated regression suite and update roadmap evidence.

## Cross-Wave Closure Sprint Review
- Code updates:
  - `api/_lib/backfillService.js`
  - `scripts/replay-backfill.js`
  - `tests/backfillService.test.js`
  - `api/portfolio.js`
  - `api/orders.js`
  - `api/zerodha.js`
  - `api/market.js`
  - `api/comparison.js`
  - `api/_lib/contracts.js`
  - `tests/legacyApiMeta.test.js`
  - `tests/cliContracts.test.js`
  - `scripts/capture-streamlit-snapshots.py`
- Validation:
  - `node --check api/portfolio.js api/orders.js api/zerodha.js api/market.js api/comparison.js scripts/replay-backfill.js scripts/capture-streamlit-snapshots.py`
  - `node --test tests/mockApi.test.js tests/zerodhaAuth.test.js tests/portfolioCli.test.js tests/backfillService.test.js tests/legacyApiMeta.test.js tests/cliContracts.test.js` (23/23 pass)
  - `node --test tests/*.test.js` (58/58 pass)
  - `node scripts/replay-backfill.js --from 2026-03-01 --to 2026-03-02 --hotspot-dir ./artifacts/backfill-hotspots > artifacts/backfill-sample.json`
  - `python3 scripts/capture-streamlit-snapshots.py --url http://127.0.0.1:8501 --output-dir artifacts/ui`
- Evidence artifacts:
  - `artifacts/backfill-sample.json`
  - `artifacts/eod-sample.json`
  - `artifacts/hotspots-sample.json`
  - `artifacts/agents-sample.json`
  - `artifacts/ui/streamlit-dashboard-desktop.png`
  - `artifacts/ui/streamlit-dashboard-mobile.png`

## X1 Config & Secrets Workflow Plan (2026-03-04)
- [x] Add environment template covering all required/optional keys.
- [x] Add runtime config-health validator with masked secret output.
- [x] Add tests for config profile logic and warning behavior.
- [x] Add docs for local `.env.local` and Vercel env mirroring flow.

## X1 Config & Secrets Workflow Review
- Code updates:
  - `.env.example`
  - `api/_lib/configHealth.js`
  - `scripts/config-health.js`
  - `tests/configHealth.test.js`
  - `README.md`
- Validation:
  - `node --check api/_lib/configHealth.js`
  - `node --check scripts/config-health.js`
  - `node --test tests/configHealth.test.js` (2/2 pass)
  - `node scripts/config-health.js --format table > artifacts/config-health.txt`
  - `node scripts/config-health.js --format json > artifacts/config-health.json`
  - `node --test tests/*.test.js` (63/63 pass)

## Wave 1 Live-Paper Validation Review (2026-03-04)
- Validation command:
  - `KITE_API_KEY=<env> KITE_ACCESS_TOKEN=<env> node scripts/live-paper-validate.js --exchange all --export ./artifacts/live-paper-snapshot.json`
- Result:
  - `connected: true`
  - `provider: kite-direct`
  - `providerMode: live`
  - `rowCount: 26`
  - `summary`: present and non-empty in exported payload
- Evidence artifact:
  - `artifacts/live-paper-snapshot.json`

## G5 Production Readiness Sign-off Review (2026-03-04)
- Deployment:
  - `npx vercel --prod --yes`
  - Inspect: `https://vercel.com/joytdh-gmailcoms-projects/portfolio-tracker/2bofaaxRg7S6mfnzUkmF7KeRRrtg`
  - Production: `https://portfolio-tracker-kg79ujdbh-joytdh-gmailcoms-projects.vercel.app`
  - Alias: `https://portfolio-tracker-kappa-woad.vercel.app`
- Post-deploy smoke checks (all `200`):
  - `GET /api/zerodha?route=session-status`
  - `GET /api/v1/portfolio/bootstrap?exchange=all`
  - `GET /api/v1/hotspots/snapshot?exchange=all`
  - `GET /api/v1/agents/intent?...`
  - `POST /api/v1/agents/analyze`
- Quality gates:
  - `node --test tests/*.test.js` (63/63 pass)
  - live-paper validation artifact present (`artifacts/live-paper-snapshot.json`)
  - production smoke artifact present (`artifacts/production-smoke.json`)

## Themes Heatmap Alignment Plan (2026-03-04)
- [x] Align heatmap row grid start with header grid start inside each theme card.
- [x] Enforce fixed metric column widths so `1D/1W/1M/6M/YTD` chips line up row-to-row.
- [x] Preserve single-line cluster labels with ellipsis to prevent spillover.
- [x] Add a homepage "What's New" entry for this UI change.
- [x] Run syntax + test validation before deploy.

## Themes Heatmap Alignment Review
- Code updates:
  - `styles.css`
  - `app.js`
  - `tasks/lessons.md`
- Validation:
  - `node --check app.js`
  - `node --test tests/*.test.js`
- Outcome:
  - Theme heatmap rows and headers now share the same left start and fixed metric tracks, so chips sit directly under their time-window headers.

## What's New Dedicated Page Plan (2026-03-04)
- [x] Add top-nav route for a dedicated `What's New` page.
- [x] Move release cards/log panel from `Themes` into standalone `What's New` view.
- [x] Extend client view router to support `whatsnew` target.
- [x] Add a dated `WHATS_NEW_FEED` entry announcing the new page.
- [x] Re-run JS syntax and full automated tests.

## What's New Dedicated Page Review
- Code updates:
  - `index.html`
  - `app.js`
- Validation:
  - `node --check app.js`
  - `node --test tests/*.test.js` (65/65 pass)
- Outcome:
  - `What's New` now behaves as a first-class app page accessible from top navigation, similar to `Portfolio` and `Comparison`.

## Plan Traceability UI Plan (2026-03-04)
- [x] Add a traceability section on `What's New` that maps each referenced source repo to implemented modules.
- [x] Render source -> wave -> module -> UI surface cards from structured data in `app.js`.
- [x] Add quick actions from each mapping card to relevant app views.
- [x] Add a dated `WHATS_NEW_FEED` entry for this traceability release.
- [x] Re-run syntax and full test suite.

## Plan Traceability UI Review
- Code updates:
  - `index.html`
  - `app.js`
  - `styles.css`
- Validation:
  - `node --check app.js`
  - `node --test tests/*.test.js`
- Outcome:
  - The UI now explicitly shows where each GitHub-inspired plan component lives in this codebase and where it surfaces in-product.

## Themes Card Width Hotfix Plan (2026-03-04)
- [x] Diagnose heatmap right-edge clipping (`6M/YTD`) at three-cards-per-row laptop layouts.
- [x] Increase minimum theme-card width so grid naturally drops to two cards per row when needed.
- [x] Add a dated `What's New` entry for this UI fix.
- [x] Run syntax + full regression tests.

## Themes Card Width Hotfix Review
- Code updates:
  - `styles.css`
  - `app.js`
- Validation:
  - `node --check app.js`
  - `node --test tests/*.test.js`
- Outcome:
  - Theme cards now render in 2-per-row layout on constrained desktop widths, keeping the full return-band columns visible.

## Macro Agent Phase Move (2026-03-04)
- [x] Phase 1 approved and completed as foundation.
- [x] Move posted to Phase 2 execution (LLM sentiment + macro context mapping).

## Phase 2 Macro Context Node Plan (2026-03-04)
- [x] Add macro context analysis engine over SQLite `market_news` (sentiment score, catalyst, impacted clusters, rationale summary).
- [x] Add API contract for macro context analysis (`/api/v1/macro/context`) with symbol/theme targeting.
- [x] Add manual CLI runner for macro context analysis to validate Phase 2 without UI.
- [x] Wire Portfolio `Signal Rationale` UI with a new `Macro & Regulatory Context` tab and fetch on row selection.
- [x] Add/update tests for macro context engine + API + adapter payload normalization.
- [x] Update docs, roadmap evidence, and `What's New` feed with Phase 2 changes.

## Phase 2 Macro Context Verify Plan Check-In
- Scope: asynchronous macro/regulatory context only; no dependency on live broker tick stream.
- Safety: read-only analysis of harvested news + read-only portfolio context; no changes to order execution path.
- UX: additive tab inside existing `Signal Rationale` card, preserving current decision panel behavior.

## Phase 2 Macro Context Review
- Code updates:
  - `api/_lib/macroContextEngine.js`
  - `api/macro-context.js`
  - `scripts/macro-context-analyze.js`
  - `adapterCore.js`
  - `app.js`
  - `index.html`
  - `styles.css`
  - `vercel.json`
  - `api/_lib/contracts.js`
  - `README.md`
  - `tests/macroContextEngine.test.js`
  - `tests/macroContextApi.test.js`
  - `tests/adapterCore.test.js`
  - `tests/cliContracts.test.js`
- Validation:
  - `node --check api/_lib/macroContextEngine.js`
  - `node --check api/macro-context.js`
  - `node --check scripts/macro-context-analyze.js`
  - `node --check app.js`
  - `node --check adapterCore.js`
  - `node --test tests/macroContextEngine.test.js tests/macroContextApi.test.js tests/adapterCore.test.js tests/cliContracts.test.js` (18/18 pass)
  - `node --test tests/*.test.js` (78/78 pass)
  - `node scripts/macro-context-analyze.js --format table --exchange all --include-processed --limit 10`

## Phase 3 Next.js UI Integration Plan (2026-03-04)
- [x] Add drop-in Next.js API route (`/api/v1/macro-context`) that queries SQLite `llm_analysis` and returns normalized payload.
- [x] Add drop-in `MacroContextPanel` React component with native semantic Tailwind classes only (no custom color/font system).
- [x] Implement loading skeleton + null/fallback state + source/timestamp footer behavior.
- [x] Add integration notes for mounting the panel inside existing Signal Rationale layout.

## Phase 3 Next.js UI Verify Plan Check-In
- Scope: provide Next.js-ready route/component files without modifying current non-Next runtime in this repo.
- Safety: route reads SQLite only; no write path and no broker/order side effects.

## Phase 3 Next.js UI Review
- Code updates:
  - `app/api/v1/macro-context/route.ts`
  - `components/MacroContextPanel.tsx`
- Validation:
  - Structural verification only (repo is non-Next and has no TypeScript toolchain installed).
  - `npx tsc --version` failed due missing `typescript` package in this workspace.

## TypeScript Compile Fix Plan (2026-03-04)
- [x] Align `tsconfig.json` module settings so Next-style ESM `app/api` and `components` TS files compile.
- [x] Add missing type declarations for `better-sqlite3`.
- [x] Re-run `npx tsc --noEmit` and confirm zero errors.

## TypeScript Compile Fix Review
- Code updates:
  - `tsconfig.json`
  - `next-env.d.ts`
  - `package.json`
  - `package-lock.json`
- Validation:
  - `npm i -D @types/better-sqlite3`
  - `npx tsc --noEmit` (pass)

## Macro Context 500 Hotfix Plan (2026-03-04)
- [x] Reproduce production failure for `/api/v1/macro/context` and identify root cause.
- [x] Fix SQLite path resolution for serverless runtime to writable storage (`/tmp` fallback).
- [x] Add fail-open behavior for macro context route/engine when storage is unavailable.
- [x] Re-run macro tests and full regression suite.

## Macro Context 500 Hotfix Review
- Root cause:
  - Production endpoint returned `500` with message `unable to open database file` due read-only deployment filesystem when defaulting to `./data/macro_events.db`.
- Code updates:
  - `api/_lib/macroHarvester.js`
  - `api/_lib/macroContextEngine.js`
  - `api/macro-context.js`
- Validation:
  - `curl -i https://portfolio-tracker-kappa-woad.vercel.app/api/v1/macro/context?symbol=SBIN&exchange=all` (pre-fix: `500`, `unable to open database file`)
  - `node --check api/_lib/macroHarvester.js api/_lib/macroContextEngine.js api/macro-context.js`
  - `node --test tests/macroContextEngine.test.js tests/macroContextApi.test.js tests/macroHarvester.test.js tests/macroApi.test.js` (11/11 pass)
  - `node --test tests/*.test.js` (78/78 pass)

## Macro Context 500 Deployment Hotfix Plan (2026-03-04)
- [x] Collapse `macro-context` serverless handler into existing `macro` handler to reduce total function count for Vercel Hobby cap.
- [x] Update route rewrites/tests to use `/api/macro?route=context` for `/api/v1/macro/context`.
- [x] Keep fail-open behavior for storage errors (`200` neutral payload) to prevent UI hard-fail.
- [x] Run targeted + full test suite and verify endpoint contract locally.
- [x] Deploy to production and verify `/api/v1/macro/context` no longer returns `500`.

## Macro Context 500 Verify Plan Check-In
- Scope: production availability hotfix only; no UI redesign and no trading execution path changes.
- Success criterion: macro context panel stops showing backend `500`, and endpoint returns `200` with either contextual or neutral payload.
- Risk: function consolidation may impact route-specific tests; mitigate with contract tests before deploy.

## Macro Context 500 Deployment Hotfix Review
- Code updates:
  - `api/macro.js` (added `route=context` analyzer path and fail-open storage handling)
  - `api/macro-context.js` (removed to reduce serverless function count)
  - `vercel.json` (rewired `/api/v1/macro/context` to `/api/macro?route=context`)
  - `tests/macroContextApi.test.js` (route/handler alignment)
  - `components/MacroContextPanel.tsx` (endpoint default aligned to `/api/v1/macro/context`)
- Validation:
  - `node --test tests/macroContextApi.test.js tests/macroContextEngine.test.js tests/macroApi.test.js` (6/6 pass)
  - `node --test tests/*.test.js` (78/78 pass)
  - `npx vercel build` -> `.vercel/output/functions` count = `9`
  - `npx vercel --prod --yes` deployed and aliased to `https://portfolio-tracker-kappa-woad.vercel.app`
  - `curl -i https://portfolio-tracker-kappa-woad.vercel.app/api/v1/macro/context?symbol=DEEPAKNTR&exchange=all` now returns `200` (no backend `500`)

## Macro Context Uniform Output Fix Plan (2026-03-04)
- [x] Stop destructive queue behavior for UI reads by defaulting macro context requests to include processed events.
- [x] Add production auto-harvest bootstrap when context endpoint has zero events in writable `/tmp` DB.
- [x] Improve symbol specificity by deriving theme hint from holdings-to-theme mapping when user clicks a symbol.
- [x] Verify regression suite and live endpoint behavior across multiple symbols.

## Macro Context Uniform Output Fix Review
- Root cause:
  - Context read flow was using `includeProcessed=false`, while analyzer marks items as processed, causing subsequent requests to see empty/generic output.
  - On Vercel serverless, `/tmp` DB starts empty frequently; without on-demand harvest, `considered_events` stayed `0`.
  - Theme hint was often empty, so head-impact routing stayed generic.
- Code updates:
  - `api/macro.js` (default `includeProcessed=true`, production auto-harvest when empty, second-pass analysis)
  - `api/_lib/macroContextEngine.js` (derive per-symbol theme hint from BharatFinTrack mapping + improved theme/head token overlap)
  - `app.js` (frontend macro request now sends `includeProcessed: true`; added What's New entry)
- Validation:
  - `node --check api/macro.js`
  - `node --check api/_lib/macroContextEngine.js`
  - `node --check app.js`
  - `node --test tests/macroContextApi.test.js tests/macroContextEngine.test.js tests/macroApi.test.js` (6/6 pass)
  - `node --test tests/*.test.js` (78/78 pass)
  - Live prod verification (`https://portfolio-tracker-kappa-woad.vercel.app/api/v1/macro/context`):
    - `symbol=PAYTM` -> `theme_hint=Fintech & Payments India`, top clusters led by Fintech micro-clusters.
    - `symbol=HDFCBANK` -> `theme_hint=Banking & Financial Services`, top clusters led by Banking micro-clusters.
    - `symbol=ITC` -> `theme_hint=Consumer Staples`, top clusters led by Consumer Staples micro-clusters.

## Angel Live Session Activation Plan (2026-03-04)
- [x] Implement SmartAPI auth helper with secure TOTP generation from `ANGEL_TOTP_SECRET`.
- [x] Add Angel session lifecycle routes (`session`, `session-status`, `logout`) in `api/angel.js`.
- [x] Add Vercel rewrites for new Angel routes and keep existing callback/postback/health unchanged.
- [x] Add tests for missing-env and mocked success login flow.
- [x] Verify production health/status endpoints and document exact env setup steps.

## Angel Live Session Verify Plan Check-In
- Scope: backend auth/session plumbing only; no order placement and no migration from Zerodha provider yet.
- Success criteria: once env vars are set, `POST /api/angel/session` returns connected session metadata and `GET /api/angel/session/status` reports connected.
- Safety: never persist raw secrets in repo; only keep in-memory tokens and masked diagnostics in responses.

## Angel Live Session Activation Review
- Code updates:
  - `api/_lib/angelSmartApi.js` (SmartAPI request helper + RFC-compatible TOTP generator)
  - `api/angel.js` (`session`, `session-status`, `logout`, richer `health`)
  - `vercel.json` (rewrites for new Angel routes)
  - `tests/angelSession.test.js` (TOTP + missing-env + mocked session success)
  - `README.md` (activation checklist and endpoint docs)
- Validation:
  - `node --check api/angel.js`
  - `node --check api/_lib/angelSmartApi.js`
  - `node --test tests/angelSession.test.js tests/mockApi.test.js` (8/8 pass)
  - `node --test tests/*.test.js` (81/81 pass)
  - `curl https://portfolio-tracker-kappa-woad.vercel.app/api/angel/health` -> `ready: false` with explicit missing key list (expected until env is set)
  - Production after env setup:
    - `POST /api/angel/session` returns `connected: true`, `hasFeedToken: true`.
    - `GET /api/angel/session/status` returns `connected: true` for same client session via secure cookie persistence.
  - Post-fix note:
    - Fixed `FUNCTION_INVOCATION_FAILED` caused by sending request body with `GET` to SmartAPI profile endpoint.

## Angel Market Data Overlay Plan (Option 2) (2026-03-04)
- [x] Keep Zerodha (`kite-direct`) as holdings/positions source and decision baseline.
- [x] Add optional Angel market-data overlay for quotes (LTP/close) inside `kite-direct` provider.
- [x] Source Angel session from secure cookies on portfolio API requests without switching broker provider.
- [x] Add env/runtime flags and provider metadata to show when Angel overlay is active.
- [x] Add tests for overlay toggles and fallback behavior; run full regression suite.

## Angel Market Data Overlay Verify Plan Check-In
- Scope: only market data enrichment path; no order flow and no replacement of Zerodha portfolio ownership.
- Success criteria: with Angel session + flag enabled, portfolio quotes come from Angel when available, and fallback remains stable to Zerodha/mock when unavailable.

## Angel Market Data Overlay Review
- Code updates:
  - `api/_lib/brokers/kiteDirectProvider.js` (Angel quote overlay + fallback order + metadata)
  - `api/portfolio.js` (reads Angel session cookies alongside Zerodha session)
  - `api/_lib/portfolioService.js` (returns `marketDataProvider`, `angelOverlayActive`)
  - `adapterCore.js` + `app.js` (consumes/displays overlay metadata in Portfolio status chip)
  - `api/_lib/configHealth.js` + `.env.example` + `README.md` (config/docs updates)
  - `tests/kiteAngelOverlay.test.js` (overlay behavior + fallback tests)
- Validation:
  - `node --check api/_lib/brokers/kiteDirectProvider.js api/_lib/portfolioService.js api/portfolio.js adapterCore.js app.js api/_lib/configHealth.js`
  - `node --test tests/kiteAngelOverlay.test.js tests/providerFactory.test.js tests/mockApi.test.js` (10/10 pass)
  - `node --test tests/*.test.js` (83/83 pass)

## Phase 4 Advanced UI & Charting Plan (2026-03-05)
- [x] Add Phase 4 API contracts (`charts`, `peers`) and Vercel rewrites for new routes.
- [x] Implement `api/charts.js` with `normalized-returns` and `decision-markers` endpoints.
- [x] Implement `api/peers.js` with BharatFinTrack-style top-3 peer relative strength payload.
- [x] Extend snapshot storage helper with decision audit listing for marker overlay.
- [x] Extend `adapterCore.js` with chart/marker/peer payload validators and backend adapter methods.
- [x] Replace comparison canvas with Lightweight Charts in `index.html` + `app.js`.
- [x] Add AI decision marker overlay pipeline on comparison chart.
- [x] Add Peer Relative Strength panel (selector, list, chart) in comparison view.
- [x] Add/adjust styles for new chart containers, legend, marker pills, and peer panel responsiveness.
- [x] Add tests for charts API, peers API, and adapterCore chart payload validation.
- [x] Run syntax checks, targeted tests, full regression tests, and record review evidence.

## Phase 4 Verify Plan Check-In
- Scope: Phase 4 only (comparison visualization + marker overlay + peer RS + supporting API/adapter contracts).
- Safety: no trading execution changes; no order submission path changes.
- Compatibility: preserve existing nav/view wiring, portfolio/macro/network flows, and existing API envelopes (`meta.contractVersion`, `meta.traceId`).

## Phase 4 Advanced UI & Charting Review
- Code updates:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `adapterCore.js`
  - `api/charts.js`
  - `api/peers.js`
  - `api/_lib/snapshots.js`
  - `api/_lib/contracts.js`
  - `vercel.json`
  - `tests/chartsApi.test.js`
  - `tests/peersApi.test.js`
  - `tests/adapterCoreCharts.test.js`
- Validation:
  - `node --check app.js`
  - `node --check adapterCore.js`
  - `node --check api/charts.js`
  - `node --check api/peers.js`
  - `node --test tests/chartsApi.test.js tests/peersApi.test.js tests/adapterCoreCharts.test.js` (10/10 pass)
  - `node --test tests/*.test.js` (97/97 pass)
- Outcome:
  - Comparison view now runs on TradingView Lightweight Charts with live marker overlays.
  - Added peer relative-strength panel with top-3 competitor ranking and aligned multi-line RS chart.
  - New chart/marker/peer API contracts and adapter validators are covered by automated tests.

## Phase 5 Quant Engine Initialization Plan (2026-03-05)
- [x] Create isolated `/quant-engine` service scaffold (no edits to `api/` or `package.json`).
- [x] Add `requirements.txt` with FastAPI, Uvicorn, PyPortfolioOpt, vectorbt, pandas, numpy, and PKScreener-aligned dependencies.
- [x] Create FastAPI entrypoint `main.py` with app bootstrap and health-check endpoint.
- [x] Add placeholder routers:
  - `routers/allocation.py`
  - `routers/backtest.py`
  - `routers/technical.py`
- [x] Wire routers into the FastAPI app and validate Python syntax.
- [x] Document exact local virtualenv setup + run commands for endpoint testing.

## Phase 5 Verify Plan Check-In
- Scope: initialize only the isolated Python quant microservice scaffold.
- Boundary guardrail: do not modify existing Node/Vercel backend files under `api/` and do not modify root `package.json`.
- Outcome target: local `uvicorn` startup with healthy `/health` and placeholder feature route availability.

## Phase 5 Quant Engine Initialization Review
- Code updates:
  - `quant-engine/requirements.txt`
  - `quant-engine/main.py`
  - `quant-engine/routers/__init__.py`
  - `quant-engine/routers/allocation.py`
  - `quant-engine/routers/backtest.py`
  - `quant-engine/routers/technical.py`
- Validation:
  - `python3 -m py_compile quant-engine/main.py quant-engine/routers/allocation.py quant-engine/routers/backtest.py quant-engine/routers/technical.py` (pass)
- Outcome:
  - Added isolated FastAPI quant worker scaffold under `/quant-engine`.
  - Added Phase 5 placeholder endpoints for allocation, backtest, and technical ingestion.
  - Preserved Node backend boundary (`api/` and `package.json` untouched).

## Phase 5 Allocation Endpoint Plan (2026-03-05)
- [x] Implement `quant-engine/routers/allocation.py` with typed request/response schemas.
- [x] Fetch 1 year daily adjusted-close data via `yfinance` for requested tickers.
- [x] Compute MPT allocation with PyPortfolioOpt (`mean_historical_return`, `sample_cov`, `max_sharpe`, `clean_weights`).
- [x] Compute discrete allocation using latest prices and provided capital.
- [x] Return weights, discrete shares, remaining cash, and portfolio performance metrics.
- [x] Wire route activation in `quant-engine/main.py` for `POST /api/v1/quant/optimize-allocation`.
- [x] Run Python syntax validation for updated files.

## Phase 5 Allocation Verify Check-In
- Scope: allocation endpoint only (no backtest/technical changes in this step).
- Boundary guardrail: no edits to Node `api/` and no root `package.json` edits.

## Phase 5 Allocation Endpoint Review
- Code updates:
  - `quant-engine/routers/allocation.py`
  - `quant-engine/main.py`
- Validation:
  - `python3 -m py_compile quant-engine/routers/allocation.py quant-engine/main.py` (pass)
- Outcome:
  - Added live MPT optimizer endpoint with yfinance-backed data pull and discrete share output.
  - Endpoint mounted at `POST /api/v1/quant/optimize-allocation`.

## Phase 5 Backtest Endpoint Plan (2026-03-05)
- [x] Implement `quant-engine/routers/backtest.py` with typed request/response schemas for metrics + equity curve.
- [x] Fetch lookback daily close prices via `yfinance` for requested tickers.
- [x] Run vectorbt SMA momentum logic (`MA.run`, cross-above entries, cross-below exits).
- [x] Simulate portfolio using `vbt.Portfolio.from_signals` with initial capital.
- [x] Extract win rate, max drawdown, CAGR, Sharpe ratio.
- [x] Downsample equity curve to frontend-safe payload (~300 points max).
- [x] Wire router mount for `POST /api/v1/quant/backtests/thematic-rotation` in `quant-engine/main.py`.
- [x] Run Python syntax validation for updated files.

## Phase 5 Backtest Verify Check-In
- Scope: vectorbt thematic rotation endpoint only.
- Boundary guardrail: no edits under root Node `api/` and no root `package.json` edits.

## Phase 5 Backtest Endpoint Review
- Code updates:
  - `quant-engine/routers/backtest.py`
  - `quant-engine/main.py`
- Validation:
  - `python3 -m py_compile quant-engine/routers/backtest.py quant-engine/main.py` (pass)
- Outcome:
  - Added vectorbt thematic-rotation backtest endpoint with SMA(50/200) crossover signals and grouped cash-shared simulation.
  - Added downsampled equity curve output capped to ~300 points for frontend rendering.
  - Endpoint mounted at `POST /api/v1/quant/backtests/thematic-rotation`.

## Phase 5 Technical Scanner Endpoint Plan (2026-03-05)
- [x] Implement `quant-engine/routers/technical.py` request/response schemas for candlestick flags.
- [x] Add optional ticker-universe input with default index fallback (NIFTY50/NIFTY500).
- [x] Integrate PKScreener via subprocess with timeout-safe execution.
- [x] Parse scanner outputs (JSON/CSV/stdout) to extract symbol, pattern, signal, and date.
- [x] Handle long-running scans gracefully with explicit timeout responses.
- [x] Mount router path to `POST /api/v1/technical/candles/scan` in `quant-engine/main.py`.
- [x] Run Python syntax validation for updated files.

## Phase 5 Technical Scanner Verify Check-In
- Scope: technical candlestick scan endpoint only.
- Boundary guardrail: no edits under root Node `api/` and no root `package.json` edits.

## Phase 5 Technical Scanner Endpoint Review
- Code updates:
  - `quant-engine/routers/technical.py`
  - `quant-engine/main.py`
- Validation:
  - `python3 -m py_compile quant-engine/routers/technical.py quant-engine/main.py` (pass)
- Outcome:
  - Added candlestick technical scan endpoint with PKScreener subprocess execution and timeout handling.
  - Added parser pipeline for JSON/CSV/stdout outputs into `{symbol, pattern, signal, date}` flags.
  - Endpoint mounted at `POST /api/v1/technical/candles/scan`.

## Phase 5 Quant Gateway + UI Hookup Plan (2026-03-05)
- [x] Add `api/quant.js` Vercel proxy route forwarding allocation/backtest POST requests to `QUANT_ENGINE_URL`.
- [x] Add Vercel rewrites for quant proxy endpoints.
- [x] Extend `adapterCore.js` with quant normalizers and backend methods:
  - `fetchOptimalAllocation(tickers, capital)`
  - `fetchStrategyBacktest(tickers)`
- [x] Add comparison UI controls for 5-year backtest trigger + summary box.
- [x] Add portfolio UI controls for optimal sizing trigger + allocation results table.
- [x] Wire new UI handlers in `app.js` with loading/error states and dark-theme-consistent rendering.
- [x] Validate syntax and regression safety for touched files.

## Phase 5 Quant Gateway Verify Check-In
- Scope: Node quant proxy + frontend adapter + UI hookup only.
- Boundary guardrail: keep Python quant engine isolated, no quant libraries added to Node runtime.

## Phase 5 Quant Gateway + UI Hookup Review
- Code updates:
  - `api/quant.js`
  - `vercel.json`
  - `api/_lib/contracts.js`
  - `adapterCore.js`
  - `index.html`
  - `styles.css`
  - `app.js`
- Validation:
  - `node --check api/quant.js`
  - `node --check adapterCore.js`
  - `node --check app.js`
  - `node --test tests/*.test.js` (97/97 pass)
- Outcome:
  - Added Node quant proxy with `QUANT_ENGINE_URL` forwarding for allocation and thematic backtest routes.
  - Added frontend adapter methods for optimal sizing and strategy backtests.
  - Added comparison backtest action + summary metrics and portfolio optimal sizing action + allocation table UI.

## Phase 6 Research + NLP Routers Plan (2026-03-05)
- [x] Implement `quant-engine/routers/research.py` with transcript sync (PDF upload/URL -> chunk -> embeddings -> FAISS store).
- [x] Implement `quant-engine/routers/research.py` chat endpoint with similarity retrieval and grounded answer + citation chunks.
- [x] Implement `quant-engine/routers/commands.py` command interpretation endpoint returning strict mock-basket JSON.
- [x] Register `research` and `commands` routers in `quant-engine/main.py` under `/api/v1/research` and `/api/v1/commands`.
- [x] Update `quant-engine/requirements.txt` with Phase 6 dependencies (`pypdf`, `sentence-transformers`, `faiss-cpu`).
- [x] Validate Python syntax for all new/updated quant-engine router files.

## Phase 6 Verify Check-In
- Scope: Python quant-engine research and NLP parser routers only.
- Boundary guardrail: no Node/Vercel backend modifications for this step.

## Phase 6 Research + NLP Routers Review
- Code updates:
  - `quant-engine/routers/research.py`
  - `quant-engine/routers/commands.py`
  - `quant-engine/main.py`
  - `quant-engine/requirements.txt`
- Validation:
  - `python3 -m py_compile quant-engine/main.py quant-engine/routers/research.py quant-engine/routers/commands.py` (pass)
- Runtime note:
  - Local runtime smoke calls were not executed in this shell because `fastapi` is not installed in the current global Python environment; use the virtualenv install command below before endpoint testing.

## Phase 6 Frontend Integration Plan (2026-03-05)
- [x] Add Node proxy routes for research and commands (`api/research.js`, `api/commands.js`) forwarding to `QUANT_ENGINE_URL`.
- [x] Add Vercel rewrites for `/api/v1/research/earnings/chat`, `/api/v1/research/earnings/sync`, and `/api/v1/commands/interpret`.
- [x] Extend `adapterCore.js` with `sendEarningsQuery(symbol, query)` and `submitNlpCommand(commandText)`.
- [x] Add strict response normalizers for earnings chat and command interpretation payloads.
- [x] Add Command Palette modal shell to `index.html` with `commandPaletteOverlay`, `commandInput`, and `commandResults`.
- [x] Add Copilot Chat section to Portfolio Signal Rationale panel in `index.html`.
- [x] Add CSS for palette + copilot chat using existing design tokens/typography and no palette/font changes.
- [x] Wire `app.js` keyboard toggle (`Cmd/Ctrl + K`), command submit/loader, and mock basket render.
- [x] Wire Copilot chat submit/render path with citation highlighting from earnings-chat payload.
- [x] Run syntax checks for touched JS/API files and document review outcomes.

## Phase 6 Frontend Verify Check-In
- Scope: frontend + Node gateway integration only for Phase 6 (`research chat` and `NLP command parser`).
- Safety: preserve existing visual system (colors, typography, grid) and existing app view routing/portfolio flows.
- Boundary: no Python router changes in this step; only consume already live quant-engine endpoints.

## UX + Macro Reliability Patch Plan (2026-03-05)
- [x] Remove placeholder top-nav links (`Universe`, `Sectors`, `Signals`) from `index.html`.
- [x] Finish missing Phase 6 interaction handlers in `app.js` (Cmd/Ctrl+K toggle, command submit, copilot submit).
- [x] Extend macro context normalization to retain backend `reason`/`dbPath` metadata.
- [x] Add macro fallback behavior when backend returns neutral-without-events (`storage/db unavailable` or empty context).
- [x] Surface explicit macro fallback status in rationale panel to avoid misleading "Balanced for all" interpretation.
- [x] Run syntax checks for touched files and capture outcomes.

## Phase 6 Frontend + Macro Reliability Review
- Code updates:
  - `api/research.js`
  - `api/commands.js`
  - `vercel.json`
  - `api/_lib/contracts.js`
  - `adapterCore.js`
  - `index.html`
  - `styles.css`
  - `app.js`
  - `api/_lib/macroContextEngine.js`
- Validation:
  - `node --check app.js` (pass)
  - `node --check adapterCore.js` (pass)
  - `node --check api/research.js` (pass)
  - `node --check api/commands.js` (pass)
  - `node --check api/_lib/macroContextEngine.js` (pass)
  - `node --test tests/*.test.js` (pass, `97/97`)
- Outcome:
  - Command Palette and Copilot Chat frontend wiring is now fully active (`Cmd/Ctrl+K`, Enter submit, modal close, loading/error states).
  - Placeholder top-nav items (`Universe`, `Sectors`, `Signals`) removed.
  - Macro context now preserves backend `reason` metadata and applies symbol-level synthetic fallback when backend context is unavailable/empty, with explicit UI note to avoid misleading all-neutral interpretation.

## Vercel Hobby Function-Limit Hotfix Plan (2026-03-05)
- [x] Consolidate Python worker proxy routes into existing `api/quant.js` to reduce root serverless entrypoints.
- [x] Update `vercel.json` rewrites for research/commands to route through `api/quant`.
- [x] Remove redundant root serverless files `api/research.js` and `api/commands.js`.
- [x] Run syntax and regression checks to ensure no API contract breakage.
- [x] Document outcome and deployment-unblock evidence.

## Vercel Hobby Function-Limit Hotfix Review
- Code updates:
  - `api/quant.js`
  - `vercel.json`
  - deleted `api/research.js`
  - deleted `api/commands.js`
- Validation:
  - Root serverless entrypoints count: `12` (`api/*.js`)
  - `node --check api/quant.js` (pass)
  - `node --check app.js` (pass)
  - `node --check adapterCore.js` (pass)
  - `python3 -m json.tool vercel.json` (pass)
  - `node --test tests/*.test.js` (pass, `97/97`)
- Outcome:
  - Deployment blocker resolved for Vercel Hobby function cap (`<=12`).
  - Public API paths remain unchanged (`/api/v1/research/*`, `/api/v1/commands/interpret` now rewrite through `api/quant`).

## Data Adapter Bootstrap Resilience Patch (2026-03-05)
- [x] Add backend-bootstrap fallback to synthetic adapter in `app.js` init path.
- [x] Preserve a clear runtime warning when fallback occurs instead of hard-stop generic adapter failure.
- [x] Improve topbar error copy to include root error message in terminal catch.
- [x] Run syntax + regression checks and record outcomes.

## Data Adapter Bootstrap Resilience Review
- Code updates:
  - `app.js`
- Validation:
  - `node --check app.js` (pass)
  - `node --test tests/*.test.js` (pass, `97/97`)
- Outcome:
  - Backend bootstrap failures no longer hard-fail app startup.
  - App now auto-degrades to synthetic adapter with explicit warning: `Backend bootstrap failed (...). Using synthetic mode.`
  - Terminal catch now surfaces root error detail in topbar status instead of generic message-only failure.

## Lightweight Charts API Compatibility Hotfix (2026-03-05)
- [x] Add chart line-series compatibility helper supporting both `addLineSeries` and `addSeries`.
- [x] Add marker compatibility helper supporting both `series.setMarkers` and `createSeriesMarkers`.
- [x] Wire compare/peer chart renderers to use compatibility helper instead of direct `addLineSeries`.
- [x] Run syntax + regression checks and capture outcomes.

## Lightweight Charts API Compatibility Hotfix Review
- Code updates:
  - `app.js`
- Validation:
  - `node --check app.js` (pass)
  - `node --test tests/*.test.js` (pass, `97/97`)
- Outcome:
  - Fixed runtime crash `compareChartState.chart.addLineSeries is not a function`.
  - Comparison and peer charts now support both Lightweight Charts API variants (legacy `addLineSeries` and newer `addSeries`).
  - Marker overlays now use compatible marker path (`setMarkers` or `createSeriesMarkers` fallback).
