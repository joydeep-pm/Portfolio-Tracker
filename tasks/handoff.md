# Portfolio Tracker Handoff (New Thread)

## Timestamp
- IST: 2026-03-04
- Repo: `/Users/joy/Portfolio Tracker`
- Branch: `main`
- Latest commit: `f7cd67d` (`Add network connectivity dashboard tab with live API probes`)
- Production URL: `https://portfolio-tracker-kappa-woad.vercel.app`

## Objective Snapshot
Build an Indian equities command center with:
- Zerodha as portfolio source of truth (holdings/positions)
- Angel One as market-data engine (quotes/history) where connected
- Macro/regulatory context agent (RBI/SEBI/news)
- Thematic hotspot + multi-agent recommendation workflows
- UI-first operations with headless CLI fallback

## What Is Implemented

### Wave Status
- Wave 1: complete (provider abstraction, Zerodha auth/session, CLI snapshots, EOD contract, thematic mapping)
- Wave 2: complete (PKScreener adapter, hotspot scoring/scheduler, hotspot API+CLI)
- Wave 3: complete (intent router, orchestrator, news RAG, weighted consensus)
- Wave 4: complete (Streamlit dashboard + existing web UI integration)
- Cross-wave: contracts, tracing, backfill/replay, safety guardrails all in place

### Latest Shipped (important)
1. Themes/Comparison switched to Angel live market path with fallback diagnostics.
2. Seeded Angel symbol-token map added to avoid serverless token-discovery throttling.
3. Macro context 500 fixed and per-symbol specificity improved.
4. New **Network** tab added in UI to show provider/API connectivity end-to-end.

## Current Live Data Routing (Truth Table)
1. Portfolio holdings/positions:
- Primary: Zerodha session (`/api/zerodha/session/status` + portfolio bootstrap)
- If Zerodha disconnected: read-only/demo behavior

2. Themes + Comparison market feed:
- Primary: Angel live (`source: angel-live`) when Angel session is connected
- Fallback: mock market payload when Angel session unavailable/fails

3. Portfolio market overlay (LTP/returns enrichment):
- Uses Angel session if connected (overlay active)
- Falls back safely when Angel unavailable

4. Macro & Regulatory Context:
- Uses harvested news + SQLite-backed analysis
- Fail-open neutral payload if storage/feed unavailable

## Network Dashboard (new)
- UI path: Top nav -> `Network`
- Shows:
  - Provider connection cards
  - Data-flow source cards
  - Endpoint diagnostics table (status, HTTP, latency, source, note)
- Auto-refresh every 30s while view is active
- Manual refresh button included

## Key Endpoints For First-Minute Verification
1. `GET /api/zerodha/session/status`
2. `GET /api/angel/health`
3. `GET /api/angel/session/status`
4. `GET /api/v1/market/bootstrap?exchange=all&debug=1`
5. `GET /api/v1/portfolio/bootstrap?exchange=all`
6. `GET /api/v1/macro/context?exchange=all&limit=16&includeProcessed=1`

## Expected Checks
1. Themes live check:
- `/api/v1/market/bootstrap?...` should show `source: "angel-live"` when Angel session is active.
- If it shows `mock`, inspect `debug.liveFallbackReason`.

2. Portfolio truth check:
- `/api/v1/portfolio/bootstrap` should reflect real Zerodha-connected rows when session valid.

3. Macro check:
- Macro panel should vary by selected symbol and not return identical generic output unless no events exist.

## Known Operational Reality
1. If Angel session cookies are absent/expired, Themes/Comparison can revert to fallback mode.
2. Live mode depends on active session context (not just env vars).
3. Zerodha and Angel are intentionally split: Zerodha=portfolio ownership, Angel=market data enrichment.

## Next Thread Priority (Recommended)
1. Enforce persistent Angel live availability:
- Add robust server-side session refresh/warm path so Themes rarely fall back.

2. Tighten fallback visibility:
- Add stronger UI warnings when any surface is running fallback/mock.

3. Expand market breadth:
- Validate/add remaining symbol tokens for consistent cluster coverage.

4. Harden ops:
- Add cron-driven health snapshot artifact (connectivity + source mode) for audit trail.

## Test/Validation Status
- Full suite last run: `node --test tests/*.test.js` -> `87/87` passing
- Syntax checks passed for touched API/frontend files
- Production deployed and aliased after latest commit

## Files Most Relevant For Continuation
- `/Users/joy/Portfolio Tracker/app.js`
- `/Users/joy/Portfolio Tracker/index.html`
- `/Users/joy/Portfolio Tracker/styles.css`
- `/Users/joy/Portfolio Tracker/api/market.js`
- `/Users/joy/Portfolio Tracker/api/comparison.js`
- `/Users/joy/Portfolio Tracker/api/portfolio.js`
- `/Users/joy/Portfolio Tracker/api/angel.js`
- `/Users/joy/Portfolio Tracker/api/_lib/angelLiveMarket.js`
- `/Users/joy/Portfolio Tracker/api/_lib/macroContextEngine.js`
- `/Users/joy/Portfolio Tracker/tasks/roadmap.md`
- `/Users/joy/Portfolio Tracker/tasks/todo.md`

## Security Note
- Do not commit or echo secrets in logs/handoff.
- Keep credentials only in Vercel/local env (`ANGEL_*`, `KITE_*`).
