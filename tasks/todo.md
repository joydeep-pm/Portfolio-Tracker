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
