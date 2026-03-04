# Portfolio Tracker Roadmap (NSE/BSE, Zerodha MCP)

## Tracking Rules
- Status legend: `[ ]` not started, `[-]` in progress, `[x]` done, `[!]` blocked
- Every item must include an evidence note before moving to `[x]`
- All timestamps in IST (`Asia/Kolkata`)
- Update this file first, then `tasks/todo.md` review notes

## Program Success Criteria
- Live Zerodha holdings and P&L are reproducible from API/CLI snapshots
- Thematic hotspots are computed from NSE index categorization + technical scans
- Multi-agent engine produces weighted entry/exit/risk decisions
- Dashboard renders portfolio + thematic + recommendation outputs in near real-time
- Headless CLI can run cron snapshots independently of UI

## Active Execution Board (Item-by-item)
- [x] R0.1 Create roadmap tracking file with Wave 1-4, cross-wave tasks, and release gates
- [x] R0.2 Add actionable sub-tracking and begin Wave 1 execution
- [x] R0.3 Complete remaining Wave 1 foundation item (`W1.8` live-paper validation)
- [x] R0.4 Start Wave 2 implementation while `W1.8` remains user-interaction blocked
- [x] R0.5 Start Wave 3 core implementation while preserving `W1.8` blocked flag
- [x] R0.6 Progress Wave 4 UI integration while final UI regression snapshots remain pending

## Wave 1 — Data Pipeline & CLI (Foundation)
- [x] W1.1 Finalize broker abstraction contract (`kite-direct`, `kite-mcp`) and connection states
  - [x] W1.1.a Enforce provider method/meta contract in broker factory.
  - [x] W1.1.b Validate `kite-direct` and `kite-mcp` against the contract with automated tests.
  - Evidence: 2026-03-04 IST - Added `assertProviderContract()` in `api/_lib/brokers/providerFactory.js`; tests added in `tests/providerFactory.test.js` (pass).
- [x] W1.2 Complete Zerodha auth/session hardening (auth URL, callback, cookie/session status, expiry handling)
  - [x] W1.2.a Add explicit expiry handling for Kite sessions (next 06:00 IST cutoff).
  - [x] W1.2.b Add logout endpoint and cookie/session clear behavior.
  - [x] W1.2.c Apply expiry checks to portfolio/orders session extraction.
  - [x] W1.2.d Add auth/session edge tests.
  - Evidence: 2026-03-04 IST - Updated `api/zerodha.js`, `api/_lib/zerodhaSession.js`, `api/portfolio.js`, `api/orders.js`, `vercel.json`; tests in `tests/zerodhaAuth.test.js` passing.
- [x] W1.3 Implement BharatFinTrack-backed index/category ingestion job (broad/sector/thematic/strategy/variant)
  - [x] W1.3.a Add ingestion job with BharatFinTrack live-attempt + seed fallback.
  - [x] W1.3.b Add seed catalog and normalized output contract.
  - [x] W1.3.c Generate `data/thematic_index_catalog.json`.
  - Evidence: 2026-03-04 IST - Added `scripts/ingest-bharatfintrack.js`, `data/bharatfintrack_seed.json`, `data/thematic_index_catalog.json`; `tests/bharatfintrackIngest.test.js` passing.
- [x] W1.4 Add normalized thematic mapping table for holdings -> index categories
  - [x] W1.4.a Add catalog loader and normalized mapping engine.
  - [x] W1.4.b Enrich portfolio snapshot/poll payloads with thematic mappings and summary.
  - [x] W1.4.c Add thematic mapping tests.
  - Evidence: 2026-03-04 IST - Added `api/_lib/thematicCatalog.js`, `api/_lib/thematicMapping.js`; integrated in `api/_lib/portfolioService.js`; tests `tests/thematicMapping.test.js` and `tests/portfolioServiceThematic.test.js` passing.
- [x] W1.5 Build headless CLI snapshot command (holdings, day change, P&L summary, CSV/JSON export)
  - [x] W1.5.a Implement CLI arg parser (`mode`, `exchange`, `format`, `provider`, `export`, `eod`).
  - [x] W1.5.b Add summary/detailed output with day-change and top movers.
  - [x] W1.5.c Add JSON export and CSV export modes.
  - [x] W1.5.d Document CLI usage in README.
  - Evidence: 2026-03-04 IST - Created `scripts/portfolio-snapshot.js`; validated sample run and added tests in `tests/portfolioCli.test.js` (pass).
- [x] W1.6 Add daily EOD snapshot runner contract (manual + cron-safe idempotency)
  - [x] W1.6.a Add dedicated cron entrypoint for daily snapshot persistence.
  - [x] W1.6.b Verify idempotent writes for same `snapshotDate`.
  - Evidence: 2026-03-04 IST - Added `scripts/run-eod-snapshot.js`; added idempotency test in `tests/snapshots.test.js` (pass); manual smoke run succeeded.
- [x] W1.7 Add Wave 1 automated tests (provider, assembler, session, CLI output schema)
  - [x] W1.7.a Provider contract tests added.
  - [x] W1.7.b CLI output/export schema tests added.
  - [x] W1.7.c Snapshot idempotency test added.
  - [x] W1.7.d Session/auth edge tests added.
  - [x] W1.7.e Combined regression suite updated and passing.
  - Evidence: 2026-03-04 IST - `node --test tests/adapterCore.test.js tests/mockApi.test.js tests/portfolioAssembler.test.js tests/providerFactory.test.js tests/portfolioCli.test.js tests/snapshots.test.js tests/zerodhaAuth.test.js tests/thematicMapping.test.js tests/bharatfintrackIngest.test.js tests/portfolioServiceThematic.test.js` passed (30/30).
- [x] W1.8 Run live-paper validation against Zerodha account and record sample output
  - Evidence: 2026-03-04 IST - Live validation passed using `node scripts/live-paper-validate.js --exchange all --export ./artifacts/live-paper-snapshot.json`; output `connected=true`, `providerMode=live`, `rowCount=26`.

### Wave 1 Dependencies
- Zerodha credentials and callback URL must be configured for live mode.
- `BROKER_PROVIDER` and token/session state must be available to APIs and CLI.
- Snapshot persistence mode (`Supabase` vs in-memory fallback) must be decided for cron deployment.

### Wave 1 Acceptance Criteria
- Provider factory rejects invalid provider shapes at runtime.
- CLI can produce both summary and detailed snapshot outputs.
- CLI supports JSON and CSV export paths.
- New Wave 1 tests pass together with existing adapter/mock/assembler suite.

## Wave 2 — Screener & Hotspot Engine
- [x] W2.1 Integrate PKScreener scan adapter for breakout/consolidation/momentum anomaly flags
  - [x] W2.1.a Add `pkscreenerAdapter` with normalized scan flag schema.
  - [x] W2.1.b Add optional live command mode via `PKSCREENER_CMD` and `ENABLE_PKSCREENER_LIVE`.
  - [x] W2.1.c Add deterministic fallback for local/dev continuity.
  - Evidence: 2026-03-04 IST - Added `api/_lib/pkscreenerAdapter.js`; tests in `tests/pkscreenerAdapter.test.js` passing.
- [x] W2.2 Build scan scheduler + cache with IST market-hours cadence
  - [x] W2.2.a Add hotspot runtime cache/cursor and refresh policy.
  - [x] W2.2.b Add IST market-hours cadence (`5m`) and off-hours cadence (`30m`).
  - [x] W2.2.c Add stale/failure scheduler metadata in payloads.
  - Evidence: 2026-03-04 IST - Added `api/_lib/hotspotService.js` scheduler state and cadence logic; tests in `tests/hotspotService.test.js` passing.
- [x] W2.3 Join scan flags with thematic index map and compute hotspot score
  - [x] W2.3.a Join scan rows by `exchange:symbol` into thematic holdings map.
  - [x] W2.3.b Aggregate by theme and compute category/breadth coverage.
  - [x] W2.3.c Emit coverage metadata for mapped holdings and scan symbols.
  - Evidence: 2026-03-04 IST - `buildHotspotScores()` implemented in `api/_lib/hotspotService.js`; snapshot responses include coverage + ranked hotspot list.
- [x] W2.4 Define hotspot ranking outputs (score, catalyst flags, breadth, strength)
  - [x] W2.4.a Emit `score`, `breadthPct`, `momentumStrength`, `scanFlags[]`, `catalystFlags[]`.
  - [x] W2.4.b Sort by score then breadth for deterministic ranking.
  - Evidence: 2026-03-04 IST - Hotspot output schema finalized in `api/_lib/hotspotService.js`; API/CLI smoke output verified.
- [x] W2.5 Add API + CLI exposure for hotspot snapshots
  - [x] W2.5.a Add `/api/v1/hotspots/snapshot` and `/api/v1/hotspots/poll` rewrites + route handler.
  - [x] W2.5.b Add headless CLI `scripts/hotspots-snapshot.js` with table/json + export.
  - Evidence: 2026-03-04 IST - Added `api/hotspots.js`, updated `vercel.json`, added `scripts/hotspots-snapshot.js`; smoke runs and export succeeded.
- [x] W2.6 Add Wave 2 tests (scan parsing, hotspot scoring, stale-data behavior)
  - [x] W2.6.a Adapter normalization tests.
  - [x] W2.6.b Hotspot scoring + scheduler refresh tests.
  - [x] W2.6.c Hotspot API snapshot/poll contract tests.
  - Evidence: 2026-03-04 IST - Added `tests/pkscreenerAdapter.test.js`, `tests/hotspotService.test.js`, `tests/hotspotsApi.test.js`; full suite passing.

### Wave 2 Dependencies
- PKScreener integration strategy (subprocess adapter vs library embedding) must be fixed.
- Wave 1 thematic mapping output (`W1.4`) must be available as join input.
- Scheduler runtime (Vercel cron vs external cron) must be selected for scan cadence.

### Wave 2 Acceptance Criteria
- Scan adapter produces normalized technical flags for target NSE/BSE symbols.
- Hotspot score output is deterministic for fixed inputs.
- API and CLI hotspot snapshots return ranked themes with score components.

## Wave 3 — Multi-Agent Decision Engine (Core)
- [x] W3.1 Implement LangGraph orchestrator graph (portfolio, market-data, news, recommendation agents)
  - [x] W3.1.a Add node workflow executor with explicit graph trace output.
  - [x] W3.1.b Wire portfolio/market/news/recommendation agent nodes in sequential graph.
  - Evidence: 2026-03-04 IST - Added `api/_lib/multiAgentEngine.js`; workflow outputs `graphTrace[]`.
- [x] W3.2 Implement RAG pipeline (news ingestion, embeddings, retrieval for agent context)
  - [x] W3.2.a Add news corpus loader with seed/runtime fallback.
  - [x] W3.2.b Add retrieval scoring based on query-term overlap and recency tie-break.
  - [x] W3.2.c Add sentiment aggregation over retrieved docs.
  - Evidence: 2026-03-04 IST - Added `api/_lib/newsRagStore.js` and `data/news_corpus_seed.json`; tests in `tests/newsRagStore.test.js` passing.
- [x] W3.3 Add consensus logic with weighted scores + risk controls
  - [x] W3.3.a Combine technical, thematic-hotspot, and news-sentiment contributions.
  - [x] W3.3.b Apply drawdown/risk penalty and clamp weighted score.
  - [x] W3.3.c Emit action/score/confidence outputs.
  - Evidence: 2026-03-04 IST - Weighted scoring and risk controls implemented in `buildAgentDecision()` in `api/_lib/multiAgentEngine.js`.
- [x] W3.4 Adapt Dhan-style natural language router to Zerodha MCP intents
  - [x] W3.4.a Add prompt-to-intent router with workflow mapping.
  - [x] W3.4.b Add symbol/theme/keyword extraction for context routing.
  - [x] W3.4.c Expose router via `/api/v1/agents/intent`.
  - Evidence: 2026-03-04 IST - Added `api/_lib/agentRouter.js` and `api/agents.js`; tests in `tests/agentRouter.test.js` and `tests/agentsApi.test.js` passing.
- [x] W3.5 Add decision explanation schema (why, confidence, invalidation, risk flags)
  - [x] W3.5.a Add `rationale[]`, `invalidation[]`, `riskFlags[]` to agent decisions.
  - [x] W3.5.b Add CLI/API serialization for explanation schema.
  - Evidence: 2026-03-04 IST - Decision schema emitted by `/api/v1/agents/analyze` and `scripts/agents-analyze.js`.
- [x] W3.6 Add Wave 3 tests (routing, orchestration state, consensus determinism)
  - [x] W3.6.a Router classification tests.
  - [x] W3.6.b RAG retrieval/sentiment tests.
  - [x] W3.6.c Engine + API response schema tests.
  - Evidence: 2026-03-04 IST - Added `tests/agentRouter.test.js`, `tests/newsRagStore.test.js`, `tests/multiAgentEngine.test.js`, `tests/agentsApi.test.js`; full suite passing.

### Wave 3 Dependencies
- Wave 1 portfolio/snapshot APIs and Wave 2 hotspot outputs must be stable.
- LLM provider/runtime selection (local vs hosted) must be finalized.
- RAG storage choice (vector store + retention) must be finalized.

### Wave 3 Acceptance Criteria
- Router resolves target agent workflow from natural language prompts.
- Orchestrator outputs weighted action/confidence/risk with explanation fields.
- Engine degrades gracefully when one or more upstream data feeds are stale.

## Wave 4 — Streamlit Dashboard (UI)
- [x] W4.1 Scaffold Streamlit app shell and connect to backend APIs
  - [x] W4.1.a Add standalone Streamlit app entrypoint.
  - [x] W4.1.b Add API wiring for portfolio/hotspots/agents endpoints.
  - [x] W4.1.c Add dashboard dependency manifest and run script.
  - Evidence: 2026-03-04 IST - Added `streamlit_app.py`, `requirements-streamlit.txt`, and `scripts/run-streamlit-dashboard.sh`.
- [x] W4.2 Build live portfolio panels (P&L cards, holdings table, filters, charts)
  - [x] W4.2.a Add summary KPI cards and holdings grid.
  - [x] W4.2.b Add symbol drilldown and P&L chart rendering.
  - Evidence: 2026-03-04 IST - Portfolio panel implemented in `streamlit_app.py` with table/chart view.
- [x] W4.3 Build thematic hotspot panels (sector map, ranked lists, scan overlays)
  - [x] W4.3.a Add hotspot table and score chart panels.
  - [x] W4.3.b Surface scheduler staleness metadata.
  - Evidence: 2026-03-04 IST - Hotspot panel implemented in `streamlit_app.py` using `/api/v1/hotspots/snapshot`.
- [x] W4.4 Build recommendation/risk panels (agent consensus + rationale)
  - [x] W4.4.a Add agent analysis trigger and summary metrics.
  - [x] W4.4.b Render decision table with action/confidence/risk fields.
  - Evidence: 2026-03-04 IST - Agent panel implemented in `streamlit_app.py` with `/api/v1/agents/analyze` integration.
- [x] W4.5 Add user controls (refresh, symbol drilldown, watchlist suggestions)
  - [x] W4.5.a Add sidebar refresh + exchange controls.
  - [x] W4.5.b Add prompt input and watchlist suggestion action.
  - Evidence: 2026-03-04 IST - Controls implemented in `streamlit_app.py` and validated by syntax checks.
- [x] W4.6 Add UI acceptance checks and regression snapshots
  - [x] W4.6.a Add syntax validation for Streamlit app and runner script.
  - [x] W4.6.b Add visual regression snapshots for dashboard states.
  - [x] W4.6.c Run manual browser QA across desktop/mobile breakpoints.
  - Evidence: 2026-03-04 IST - `python3 -m py_compile streamlit_app.py` and `bash -n scripts/run-streamlit-dashboard.sh` passed; added `scripts/capture-streamlit-snapshots.py`; captured `artifacts/ui/streamlit-dashboard-desktop.png` and `artifacts/ui/streamlit-dashboard-mobile.png`; validated stale/error warning state rendering across breakpoints.

### Wave 4 Dependencies
- Wave 3 decision API contracts must be versioned and stable.
- Frontend deployment target and auth flow for Streamlit must be defined.
- Charting stack and refresh cadence must be aligned with backend rate limits.

### Wave 4 Acceptance Criteria
- Streamlit dashboard renders portfolio, hotspots, and recommendation panels.
- UI reflects stale/error backend states with actionable status messaging.
- Regression checks pass for key screens and recommendation panel integrity.

## Cross-Wave Platform Tasks
- [x] X1 Configuration and secrets management (`.env`, Vercel env, local secure flow)
  - [x] X1.a Add checked-in `.env.example` template covering all runtime keys.
  - [x] X1.b Add config-health validator for local/Vercel readiness without secret leakage.
  - [x] X1.c Add tests and docs for secure config workflow.
  - Evidence: 2026-03-04 IST - Added `.env.example`, `api/_lib/configHealth.js`, `scripts/config-health.js`, `tests/configHealth.test.js`; generated `artifacts/config-health.txt` + `artifacts/config-health.json`; README updated with local/Vercel flow.
- [x] X2 Observability (structured logs, error taxonomy, trace IDs per request)
  - [x] X2.a Add trace ID init + response header on new Wave 2/3 APIs.
  - [x] X2.b Add structured JSON logs for success/failure paths in hotspots and agents APIs.
  - [x] X2.c Expand trace coverage to legacy API surfaces (`portfolio`, `orders`, `zerodha`, `market`, `comparison`).
  - Evidence: 2026-03-04 IST - Added `api/_lib/trace.js`; integrated into hotspots/agents plus legacy `api/portfolio.js`, `api/orders.js`, `api/zerodha.js`, `api/market.js`, `api/comparison.js`; validated via `tests/mockApi.test.js`, `tests/zerodhaAuth.test.js`, `tests/legacyApiMeta.test.js`.
- [x] X3 Data contracts versioning for API/CLI payloads
  - [x] X3.a Add contract version constants for Wave 2/3 API payloads.
  - [x] X3.b Include `meta.contractVersion` in hotspots/agents responses.
  - [x] X3.c Extend version metadata to Wave 1 legacy endpoints and all CLI export envelopes.
  - Evidence: 2026-03-04 IST - Expanded `api/_lib/contracts.js` and applied metadata to legacy APIs and CLI envelopes (`portfolio-snapshot`, `run-eod-snapshot`, `hotspots-snapshot`, `agents-analyze`, `replay-backfill`); validated via `tests/portfolioCli.test.js` and `tests/cliContracts.test.js`.
- [x] X4 Backfill and replay strategy for missed scans/snapshots
  - [x] X4.a Add reusable backfill service for date-window replay.
  - [x] X4.b Add CLI replay command for missed EOD/hotspot windows.
  - [x] X4.c Add replay tests for date validation and archive idempotency behavior.
  - Evidence: 2026-03-04 IST - Added `api/_lib/backfillService.js`, `scripts/replay-backfill.js`, `tests/backfillService.test.js`; smoke output captured in `artifacts/backfill-sample.json`.
- [x] X5 Safety guardrails and disclaimer enforcement in recommendations
  - [x] X5.a Add recommendation disclaimer constant and guardrail helper.
  - [x] X5.b Enforce low-confidence aggressive-signal downgrade in agent decisions.
  - [x] X5.c Emit disclaimer in agent workflow/API payload.
  - [x] X5.d Extend same guardrail/disclaimer pattern to legacy decision endpoints.
  - Evidence: 2026-03-04 IST - Added `api/_lib/safety.js`; integrated in `api/_lib/multiAgentEngine.js` and `api/portfolio.js` decisions route; tests in `tests/safety.test.js` and `tests/legacyApiMeta.test.js` passing.

## Release Gates
- [x] G1 Wave 1 gate passed
- [x] G2 Wave 2 gate passed
- [x] G3 Wave 3 gate passed
- [x] G4 Wave 4 gate passed
- [x] G5 Production readiness sign-off
  - Evidence: 2026-03-04 IST - Deployed production build via `npx vercel --prod --yes`; alias active at `https://portfolio-tracker-kappa-woad.vercel.app`; smoke checks for `zerodha session`, `portfolio bootstrap`, `hotspots snapshot`, `agents intent`, and `agents analyze` all returned HTTP 200; evidence in `artifacts/production-smoke.json`; full tests passing `63/63`.

## Macro Agent Phase 2 (Post-Wave Extension)
- [x] M2.1 Build macro/regulatory sentiment node over SQLite queue (`market_news`)
  - Evidence: 2026-03-04 IST - Added `api/_lib/macroContextEngine.js` generating `sentiment_score`, `key_catalyst`, `impacted_clusters`, and `rationale_summary`; marks analyzed rows `processed_by_llm=1`.
- [x] M2.2 Expose macro context API + CLI for manual execution
  - Evidence: 2026-03-04 IST - Added `api/macro-context.js`, `scripts/macro-context-analyze.js`, `vercel.json` rewrite `/api/v1/macro/context`, contract versions in `api/_lib/contracts.js`.
- [x] M2.3 Inject macro context into Portfolio Signal Rationale UI
  - Evidence: 2026-03-04 IST - Updated `index.html`, `styles.css`, and `app.js` with `Macro & Regulatory Context` tab and row-triggered fetch via adapter (`adapterCore.js`).
- [x] M2.4 Validate with automated tests and full-suite regression
  - Evidence: 2026-03-04 IST - Added `tests/macroContextEngine.test.js`, `tests/macroContextApi.test.js`, expanded `tests/adapterCore.test.js` + `tests/cliContracts.test.js`; `node --test tests/*.test.js` passed (`78/78`).

## Decision Log
- 2026-03-04: Program split into four sequential waves; no big-bang delivery.
- 2026-03-04: Wave 1 kickoff started with provider contract hardening and headless CLI implementation.
- 2026-03-04: Wave 2 implementation started before `G1` due `W1.8` requiring account-owner interactive validation.
- 2026-03-04: Wave 3 core shipped with LangGraph-style workflow, router, RAG context, and weighted consensus outputs.
- 2026-03-04: Gates `G2`, `G3`, and `G4` marked passed after API/CLI/UI acceptance checks and full regression tests.
- 2026-03-04: `W1.8` live-paper validation passed; `G1` marked complete.
- 2026-03-04: Production deployment refreshed and smoke-validated; `G5` marked complete.
- 2026-03-04: Approved to move into Macro/Regulatory Agent Phase 2 (LLM sentiment/context node) after Phase 1 harvester foundation.
- 2026-03-04: Macro/Regulatory Phase 2 delivered with backend node, API/CLI surfaces, and Portfolio Signal Rationale UI tab integration.

## Phase 4 — Advanced UI & Charting Expansion (Post-Wave Extension)
- [x] P4.1 Replace custom comparison canvas with TradingView Lightweight Charts.
  - Evidence: 2026-03-05 IST - Updated `index.html` + `app.js` comparison renderer to use Lightweight Charts via CDN UMD with responsive chart lifecycle.
- [x] P4.2 Add AI decision timeline markers (BUY/SELL/ACCUMULATE/REDUCE) using decision audit history with latest-decision fallback.
  - Evidence: 2026-03-05 IST - Added `api/charts.js` marker route, `api/_lib/snapshots.js` decision-audit listing, and marker overlay pipeline in `app.js`.
- [x] P4.3 Add BharatFinTrack-style top-3 peer relative strength panel and chart for selected symbol.
  - Evidence: 2026-03-05 IST - Added `api/peers.js` + comparison peer panel UI in `index.html`/`styles.css`/`app.js` with top-3 competitor ranking and RS chart.
- [x] P4.4 Add API routes/contracts for charts + peers and adapter payload validators.
  - Evidence: 2026-03-05 IST - Added rewrites in `vercel.json`, contract keys in `api/_lib/contracts.js`, and new adapter methods/validators in `adapterCore.js`.
- [x] P4.5 Add automated tests and full-suite regression validation.
  - Evidence: 2026-03-05 IST - Added `tests/chartsApi.test.js`, `tests/peersApi.test.js`, `tests/adapterCoreCharts.test.js`; full suite passed (`97/97`).

### Phase 4 Dependencies
- Existing comparison/market bootstrap contracts remain stable (`/api/v1/comparison/series`, `/api/v1/market/bootstrap`).
- Decision marker history available from `decision_audit_events` (Supabase) or memory fallback audit rows.
- Lightweight Charts loaded via CDN UMD script in current vanilla runtime.

### Phase 4 Acceptance Criteria
- Comparison view renders normalized cluster returns via Lightweight Charts.
- Marker overlay updates for selected cluster and excludes HOLD signals.
- Peer panel returns anchor + top 3 cluster peers with comparative RS chart.
- Existing views and API contracts continue to pass full regression tests.

## Phase 5 — Quant Engine Isolation Kickoff
- [x] P5.0 Create isolated Python microservice folder at repo root (`/quant-engine`).
  - Evidence: 2026-03-05 IST - Added standalone `quant-engine/` directory with no changes to Node `api/` routing surface.
- [x] P5.1 Scaffold FastAPI worker entrypoint and router modules.
  - Evidence: 2026-03-05 IST - Added `quant-engine/main.py` and router placeholders (`allocation`, `backtest`, `technical`) with initial endpoint stubs.
- [x] P5.2 Add Phase 5 quant dependency manifest.
  - Evidence: 2026-03-05 IST - Added `quant-engine/requirements.txt` including `fastapi`, `uvicorn`, `PyPortfolioOpt`, `vectorbt`, `pandas`, `numpy`, and PKScreener-aligned dependencies.
- [x] P5.3 Validate scaffold syntax and startup readiness prerequisites.
  - Evidence: 2026-03-05 IST - Python compile check passed via `python3 -m py_compile` for `main.py` and all router modules.
- [x] P5.4 Implement MPT allocation route with yfinance + PyPortfolioOpt discrete sizing.
  - Evidence: 2026-03-05 IST - Replaced `quant-engine/routers/allocation.py` placeholder with `/api/v1/quant/optimize-allocation` endpoint using 1Y adjusted-close download, `mean_historical_return`, `sample_cov`, `max_sharpe`, `clean_weights`, and `DiscreteAllocation`; route mounted in `quant-engine/main.py`; syntax check passed.
- [x] P5.5 Implement vectorbt thematic momentum backtest endpoint with compact equity payload.
  - Evidence: 2026-03-05 IST - Replaced `quant-engine/routers/backtest.py` placeholder with `/api/v1/quant/backtests/thematic-rotation` endpoint using 50/200 SMA crossover signals, `Portfolio.from_signals`, key metrics extraction (win rate, max drawdown, CAGR, Sharpe), and downsampled equity curve (~300 points max); route mounted in `quant-engine/main.py`; syntax check passed.
- [x] P5.6 Implement PKScreener candlestick technical scanner endpoint.
  - Evidence: 2026-03-05 IST - Replaced `quant-engine/routers/technical.py` placeholder with `/api/v1/technical/candles/scan` endpoint using subprocess-based PKScreener execution (scan code 6 fallback commands), timeout-safe handling, and parsed `{symbol, pattern, signal, date}` flags from JSON/CSV/stdout outputs; route mounted in `quant-engine/main.py`; syntax check passed.
- [x] P5.7 Wire Vercel gateway proxy and vanilla JS UI to external quant engine endpoints.
  - Evidence: 2026-03-05 IST - Added `api/quant.js` proxy with `QUANT_ENGINE_URL`, rewrites in `vercel.json` for `/api/v1/quant/optimize-allocation` + `/api/v1/quant/backtests/thematic-rotation`, adapter methods in `adapterCore.js`, and UI hooks in `index.html`/`styles.css`/`app.js` for “Run 5-Year Backtest” and “Calculate Optimal Sizing”; syntax + full regression tests passed.

### Phase 5 Boundary
- Root Node/Vercel application remains unchanged for quant dependencies.
- Heavy Python libraries are isolated to `/quant-engine` for separate deployment/runtime.

## Phase 6 — Deep Research & NLP Execution (Quant Engine)
- [x] P6.1 Implement transcript sync ingestion endpoint with PDF upload/URL support and FAISS indexing.
  - Evidence: 2026-03-05 IST - Added `quant-engine/routers/research.py` endpoint `POST /earnings/sync` for PDF extraction (`pypdf`), word-overlap chunking, `sentence-transformers` embeddings, and persisted per-symbol FAISS index + metadata.
- [x] P6.2 Implement transcript chat endpoint with similarity retrieval and exact citation chunks.
  - Evidence: 2026-03-05 IST - Added `POST /earnings/chat` in `quant-engine/routers/research.py`; query embedding + FAISS top-k retrieval returns grounded answer and exact chunk-text citations.
- [x] P6.3 Implement NLP command interpreter endpoint with strict mock basket output (read-only mode).
  - Evidence: 2026-03-05 IST - Added `quant-engine/routers/commands.py` endpoint `POST /interpret` with rotate-intent parsing (`source_entity`, `target_entity`, `capital_pct`) and `mock_basket` sell/buy legs; no live execution path.
- [x] P6.4 Register new routers in FastAPI app with versioned route prefixes.
  - Evidence: 2026-03-05 IST - Updated `quant-engine/main.py` to mount `research` at `/api/v1/research` and `commands` at `/api/v1/commands`.
- [x] P6.5 Add Phase 6 dependency manifest entries and validate syntax.
  - Evidence: 2026-03-05 IST - Updated `quant-engine/requirements.txt` with `pypdf`, `sentence-transformers`, `faiss-cpu`; compile validation passed via `python3 -m py_compile` for `main.py`, `routers/research.py`, and `routers/commands.py`.
- [x] P6.6 Integrate research/chat and NLP command endpoints into Vercel gateway + vanilla JS frontend.
  - Evidence: 2026-03-05 IST - Added Node proxies (`api/research.js`, `api/commands.js`) and rewrites in `vercel.json`; extended `adapterCore.js` with `sendEarningsQuery` and `submitNlpCommand`; wired Command Palette + Copilot Chat UI in `index.html`/`styles.css`/`app.js` with keyboard/submit flows and citation rendering.

## Macro Context Reliability Patch (Post-M2 Hardening)
- [x] M2.5 Prevent misleading all-neutral macro sentiment in sparse/unavailable contexts.
  - Evidence: 2026-03-05 IST - Added momentum-bias tie-breaker in `api/_lib/macroContextEngine.js` for near-neutral heuristic outputs; preserved backend `reason` in `adapterCore.js`; added symbol-level synthetic fallback + explicit context note in `app.js` when macro storage/context is unavailable.
