# Indian Thematic Market Tracker Prototype

Interactive thematic engine prototype that models:
- 2,486 stocks
- 26 core thematic heads
- 175 micro-clusters
- momentum windows: `1D`, `1W`, `1M`, `6M`, `YTD`

Market scope:
- India-only synthetic universe mapped to NSE/BSE context

## Run

```bash
python3 -m http.server 4173
```

Open:
- http://127.0.0.1:4173/index.html

## Streamlit Dashboard (Wave 4)

Install dashboard dependencies:

```bash
pip install -r requirements-streamlit.txt
```

Run Streamlit UI:

```bash
./scripts/run-streamlit-dashboard.sh
# or
python3 -m streamlit run streamlit_app.py
```

Default API base in the app sidebar:
- `http://127.0.0.1:4173/api/v1`

## Headless Portfolio CLI (Wave 1)

Use the CLI for cron-safe snapshots without loading the UI:

```bash
node scripts/portfolio-snapshot.js --mode summary --format table
node scripts/portfolio-snapshot.js --mode detailed --format json --export ./artifacts/portfolio-snapshot.json
node scripts/portfolio-snapshot.js --mode detailed --format table --export ./artifacts/portfolio-snapshot.csv
node scripts/portfolio-snapshot.js --eod --snapshot-date 2026-03-04
node scripts/run-eod-snapshot.js --snapshot-date 2026-03-04 --exchange all
node scripts/exchange-request-token.js --request-token <request_token>
node scripts/live-paper-validate.js --exchange all --export ./artifacts/live-paper-snapshot.json
node scripts/ingest-bharatfintrack.js --output ./data/thematic_index_catalog.json
node scripts/hotspots-snapshot.js --mode summary --format table --exchange all
node scripts/hotspots-snapshot.js --mode detailed --format json --exchange all --export ./artifacts/hotspots.json
node scripts/agents-analyze.js --prompt "evaluate my portfolio against current PSU bank thematic momentum" --format table --exchange all
node scripts/agents-analyze.js --prompt "evaluate my portfolio against current PSU bank thematic momentum" --format json --exchange all --export ./artifacts/agent-analysis.json
node scripts/replay-backfill.js --from 2026-03-01 --to 2026-03-03 --exchange all --hotspot-dir ./artifacts/backfill-hotspots
node scripts/harvest-macro-news.js --format table --per-source 40 --limit 25
node scripts/harvest-macro-news.js --format json --per-source 40 --limit 25 --export ./artifacts/macro-harvest.json
node scripts/macro-context-analyze.js --symbol SBIN --exchange all --format table
node scripts/macro-context-analyze.js --symbol SBIN --exchange all --format json --export ./artifacts/macro-context.json
```

Supported options:
- `--mode summary|detailed`
- `--exchange all|nse|bse`
- `--format table|json`
- `--provider kite-direct|kite-mcp`
- `--export <path>` (JSON in `json` mode, CSV in `table` mode)
- `--eod` and optional `--snapshot-date YYYY-MM-DD`

For cron-only EOD jobs, use:
- `node scripts/run-eod-snapshot.js --snapshot-date YYYY-MM-DD --exchange all`

For account-owner live-paper validation (requires `KITE_API_KEY` + `KITE_ACCESS_TOKEN`):
- `node scripts/exchange-request-token.js --request-token <request_token>` (writes `KITE_ACCESS_TOKEN` into `.env.local`)
- `node scripts/live-paper-validate.js --exchange all --export ./artifacts/live-paper-snapshot.json`

For hotspot snapshot exports:
- `node scripts/hotspots-snapshot.js --mode summary|detailed --format table|json --exchange all|nse|bse --refresh --export <path>`

For multi-agent analysis:
- `node scripts/agents-analyze.js --prompt "<natural language query>" --exchange all|nse|bse --format table|json --export <path>`

For replay/backfill of missed windows:
- `node scripts/replay-backfill.js --from YYYY-MM-DD [--to YYYY-MM-DD] --exchange all|nse|bse --hotspot-dir <path> [--no-skip-existing]`

For macro/regulatory harvesting (RBI/SEBI RSS into SQLite):
- `node scripts/harvest-macro-news.js --format table --per-source 40 --limit 25`
- `node scripts/harvest-macro-news.js --format json --db ./data/macro_events.db --export <path>`
- Uses SQLite file `./data/macro_events.db` (override with `MACRO_EVENTS_DB_PATH` or `--db`).
- Deduplication uses `INSERT OR IGNORE` with unique `url` in table `market_news`.
- Table schema:
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `source_type TEXT`
  - `title TEXT`
  - `content_text TEXT`
  - `url TEXT UNIQUE`
  - `published_date TEXT`
  - `priority_tags TEXT` (JSON string array)
  - `processed_by_llm INTEGER DEFAULT 0`

For macro/regulatory context analysis (Phase 2 node):
- `node scripts/macro-context-analyze.js --symbol <ticker> --exchange all|nse|bse --format table|json --limit <n>`
- The analysis reads `market_news` queue, computes `sentiment_score`, selects a `key_catalyst`, maps `impacted_clusters`, and emits a 2-sentence `rationale_summary`.
- Queue behavior: analyzed rows are marked `processed_by_llm = 1` (use `--include-processed` to force historical fallback).
- Use `--include-prompt-draft` only when you need the full LLM/system prompt text for debugging.

JSON CLI outputs include metadata:
- `meta.contractVersion`
- `meta.generatedAt`

Environment/secrets health check:
- Copy `.env.example` to `.env.local` and fill required values.
- Run `node scripts/config-health.js --format table` (or `--format json`) to validate local + runtime env readiness without printing raw secrets.
- For Vercel deployments, mirror the same keys in project environment settings (`vercel env add <KEY>`), then redeploy.

## BharatFinTrack Ingestion + Holdings Thematic Mapping

The Wave 1 ingestion job creates a normalized thematic catalog:

```bash
node scripts/ingest-bharatfintrack.js --output ./data/thematic_index_catalog.json
```

Behavior:
- Attempts live extraction from Python `BharatFinTrack` package.
- Falls back to `data/bharatfintrack_seed.json` when package/runtime is unavailable.
- Produces `data/thematic_index_catalog.json` used by backend holdings-to-theme mapping.

Portfolio snapshots now include:
- `thematicMappings`: normalized records with `{ symbol, exchange, index_category, index_name, index_id, sector_tag, source, asOf }`
- `thematicSummary`: aggregate mapping coverage by category
- `thematicCatalogSource`: source identifier for traceability

## PKScreener-style Hotspot Engine (Wave 2)

Hotspot service includes:
- Scan adapter with `breakout`, `consolidation`, and `momentum_anomaly` flag normalization.
- IST-aware scheduler cache (5 minutes market-hours, 30 minutes off-hours).
- Thematic join over holdings mappings and ranked hotspot scoring.

Runtime modes:
- Default synthetic adapter (`synthetic-pkscreener`) for local/dev.
- Optional live command adapter via:
  - `ENABLE_PKSCREENER_LIVE=true`
  - `PKSCREENER_CMD='<command that prints JSON rows>'`

## Multi-Agent Decision Engine (Wave 3)

Implemented components:
- Intent router for natural-language prompts (Dhan-style prompt routing adapted for Zerodha context).
- LangGraph-style node workflow runner with agent sequence tracing:
  - `portfolio_agent`
  - `market_data_agent`
  - `news_analyst_agent`
  - `recommendation_agent`
- Weighted consensus decision outputs:
  - `action`, `confidence`, `weightedScore`
  - `riskFlags`, `rationale`, `invalidation`
- Lightweight RAG layer for news context retrieval from local corpus (`data/news_corpus.json` with seed fallback).

News corpus defaults:
- Seed file: `data/news_corpus_seed.json`
- Runtime corpus: `data/news_corpus.json` (optional override)

## Features

- Generated universe at the requested scale
- Indian-market taxonomy (BFSI, PSU, defence, rail-logistics, chemicals, etc.)
- Heatmap matrix grouped by thematic head and cluster
- Search over heads, clusters, stock names, symbols, and exchange tags
- Mode filters: all, movers, laggards
- Cluster drill-down modal with stock-level momentum
- Live momentum simulation with pause/resume control
- Comparison view with multi-select cluster combinations (up to 8 at once)
- Timeframe controls (`1D`, `5D`, `1M`, `6M`, `YTD`)
- Exchange filters (`All`, `NSE`, `BSE`)
- Normalized real-time line chart and relative-strength scan panel

## UI Variant & Branding

Themes and Portfolio now ship with the `data-command` visual variant (Slate + Teal, Satoshi, scan-first layout) to keep the product identity distinct and operational.

Runtime UI config:

```html
<script>
  window.PORTFOLIO_TRACKER_CONFIG = {
    uiVariant: "data-command",        // "data-command" | "classic"
    enableComparisonClassic: true     // keep Comparison mostly unchanged in this phase
  };
</script>
```

Scope in this phase:
- Redesigned: `Themes`, `Portfolio`, shared top shell tokens
- Mostly unchanged: `Comparison` behavior/layout (inherits shell token updates only)

## Backend Integration (NSE/BSE Adapter Hooks v1)

The app supports two runtime data modes through a global config object:

```html
<script>
  window.PORTFOLIO_TRACKER_CONFIG = {
    dataMode: "backend", // "backend" | "synthetic"
    apiBaseUrl: "/api/v1",
    authToken: "YOUR_BEARER_TOKEN",
    uiVariant: "data-command", // "data-command" | "classic"
    enableComparisonClassic: true
  };
</script>
```

Defaults (when omitted) are:
- `dataMode: "synthetic"`
- `apiBaseUrl: "/api/v1"`
- `authToken: "public-client-token"`
- `uiVariant: "data-command"`
- `enableComparisonClassic: true`

If `dataMode` is `backend` but token/config is invalid, the UI shows an adapter warning and automatically falls back to synthetic mode.

### Backend endpoints

`GET /market/bootstrap`
- query: `exchange=all|nse|bse`, `window=1D|5D|1M|6M|YTD`, `include=taxonomy,stocks,momentum`
- response:

```json
{
  "asOf": "2026-03-01T09:47:10+05:30",
  "cursor": "1740802630_8891",
  "heads": [],
  "clusters": [],
  "stocks": []
}
```

`GET /market/poll`
- query: `cursor=<lastCursor>`, `exchange=all|nse|bse`
- response:

```json
{
  "asOf": "2026-03-01T09:47:15+05:30",
  "cursor": "1740802635_8899",
  "updates": {
    "stocks": [],
    "clusters": [],
    "heads": []
  }
}
```

`GET /comparison/series`
- query: `clusterIds=cluster-1,cluster-9`, `window=1D|5D|1M|6M|YTD`, `exchange=all|nse|bse`, `points=<n>`
- response:

```json
{
  "asOf": "2026-03-01T09:47:15+05:30",
  "window": "1M",
  "exchange": "all",
  "seriesByClusterId": {
    "cluster-1": [{ "ts": "2026-03-01T09:46:15+05:30", "value": 1.2 }]
  }
}
```

`GET /hotspots/snapshot`
- query: `exchange=all|nse|bse`, `refresh=true|false`
- response includes: `hotspots[]`, `coverage`, `scheduler`, `cursor`

`GET /hotspots/poll`
- query: `exchange=all|nse|bse`, `cursor=<lastCursor>`
- response includes: `updates.hotspots[]`, `updates.coverage`, `scheduler`

`GET /agents/intent`
- query: `prompt=<natural language query>`
- response includes: `intent`, `route`, `symbols`, `themeHints`, `keywords`, `meta`

`POST /agents/analyze`
- body: `{ "prompt": "<query>", "exchange": "all|nse|bse" }`
- response includes: `intent`, `summary`, `decisions[]`, `graphTrace[]`, `meta`

`GET /macro/harvest`
- query: `perSource=<n>`, `limit=<n>`
- response includes: `fetchedCount`, `insertedCount`, `duplicateCount`, `latest[]`, `dbPath`

`GET /macro/latest`
- query: `limit=<n>`
- response includes: `items[]`, `count`, store `meta`

`GET|POST /macro/context`
- query/body: `symbol`, `exchange=all|nse|bse`, `theme|themeHint`, `limit`, `includeProcessed`, `includePromptDraft`
- response includes: `sentiment_score`, `key_catalyst`, `impacted_clusters[]`, `rationale_summary`, `source_events[]`, `meta`

Response metadata:
- `meta.contractVersion`: payload contract identifier
- `meta.traceId`: request trace identifier (also returned in `x-trace-id` response header)

Legacy API routes now include the same metadata envelope:
- `/api/v1/portfolio/*`
- `/api/v1/orders/*`
- `/api/zerodha/*`
- `/api/v1/market/*`
- `/api/v1/comparison/*`

Safety behavior:
- Low-confidence aggressive signals are downgraded to `HOLD`.
- Agent responses include a mandatory educational disclaimer.
- `GET /api/v1/portfolio/decisions` now includes the same disclaimer and guardrail application.

## Streamlit Regression Snapshots

Capture reproducible desktop/mobile dashboard snapshots:

```bash
python3 scripts/capture-streamlit-snapshots.py --url http://127.0.0.1:8501 --output-dir artifacts/ui
```

Output files:
- `artifacts/ui/streamlit-dashboard-desktop.png`
- `artifacts/ui/streamlit-dashboard-mobile.png`

### Auth contract

Backend mode sends:
- `Accept: application/json`
- `Authorization: Bearer <authToken>`

### Polling, retry, staleness

- Backend mode polling cadence:
  - market hours (IST weekdays 09:15–15:30): every 5s
  - off-hours: every 60s
  - hidden tab: interval x2
- Retry backoff on failures: `5s -> 10s -> 20s -> ...` (capped at `60s`)
- Stale state triggers when:
  - 2+ consecutive poll failures, or
  - no successful update for >20s during market hours
- UI behavior on failures:
  - keeps last good data visible
  - shows status chip (`Data delayed • retrying` or temporary sync issue)

## Mock API Mode (Activation Bridge)

Until broker account activation is complete, this repo now includes local/mock contract endpoints compatible with the frontend adapter:

- `GET /api/v1/market/bootstrap`
- `GET /api/v1/market/poll`
- `GET /api/v1/comparison/series`

These endpoints return realistic NSE/BSE-shaped payloads and allow end-to-end adapter flow testing before live Angel credentials are usable.
When an Angel session is connected (`pt_angel_*` cookies present), `/api/v1/market/*` and `/api/v1/comparison/series` switch to Angel-backed live mode and only fall back to mock mode if live fetch fails.
The live market service uses `data/angel_symbol_tokens.seed.json` to resolve symbol tokens without runtime `searchScrip` dependency (useful when SmartAPI throttles search from serverless IPs).

### Frontend config for mock mode

```html
<script>
  window.PORTFOLIO_TRACKER_CONFIG = {
    dataMode: "backend",
    apiBaseUrl: "/api/v1",
    authToken: "mock-token"
  };
</script>
```

The mock backend ignores token validation, but a non-empty token is still required by the frontend adapter contract.

## Angel Health Check Endpoint

Use one-click readiness validation before attempting real Angel session generation:

- `GET /api/angel/health`
- `POST /api/angel/session` (creates or refreshes live Angel session)
- `GET /api/angel/session/status` (connected/disconnected state)
- `POST /api/angel/logout` (clears local/remote Angel session)

Response includes env presence checks for:
- `ANGEL_API_KEY`
- `ANGEL_HISTORICAL_API_KEY` (optional; falls back to `ANGEL_API_KEY` when omitted)
- `ANGEL_CLIENT_CODE`
- `ANGEL_PIN`
- `ANGEL_TOTP_SECRET`

`/api/angel/health` verifies configuration and current session state.  
`/api/angel/session` authenticates against SmartAPI `loginByPassword` using server-side TOTP generation.

### SmartAPI Activation Checklist

1. Set these in Vercel Project Settings -> Environment Variables:
   - `ANGEL_API_KEY`
   - `ANGEL_HISTORICAL_API_KEY` (recommended for dedicated historical app key)
   - `ANGEL_CLIENT_CODE`
   - `ANGEL_PIN`
   - `ANGEL_TOTP_SECRET` (base32 secret from SmartAPI TOTP setup)
2. Redeploy.
3. Call:
   - `POST /api/angel/session`
   - `GET /api/angel/session/status`
4. Expect `connected: true` and non-empty `hasFeedToken`.

### Option 2: Zerodha Portfolio + Angel Market Data

This repo now supports keeping Zerodha as the portfolio source while overlaying Angel market quotes:

- Holdings/positions source: Zerodha (`kite-direct`)
- Quote source (LTP/close): Angel when Angel session is active
- Returns source (`1W`, `1M`, `6M`, `YTD`): Angel candle API when Angel session is active
- Fallback: Zerodha quote/history paths, then demo values

How to use:

1. Keep `BROKER_PROVIDER=kite-direct`.
2. Ensure Angel env vars are present (`ANGEL_API_KEY`, `ANGEL_HISTORICAL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PIN`, `ANGEL_TOTP_SECRET`).
3. Create Angel session:
   - `POST /api/angel/session`
4. Call portfolio endpoints as usual:
   - `GET /api/v1/portfolio/bootstrap`
   - `GET /api/v1/portfolio/poll`

For Themes/Comparison live mode, keep `data/angel_symbol_tokens.seed.json` updated with required symbols.  
If you explicitly want runtime token search fallback, set `ENABLE_ANGEL_DYNAMIC_SEARCH=true` (default is disabled).

Portfolio payload now includes:
- `marketDataProvider` (`angel`, `kite`, or `demo`)
- `angelOverlayActive` (`true|false`)

## Zerodha Session Notes

- Zerodha session is treated as expired at the next `06:00 IST` cutoff.
- `GET /api/zerodha/session/status` returns `expired` and emits warnings when re-login is required.
- `POST /api/zerodha/logout` clears in-memory session and auth cookies.
