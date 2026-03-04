# Portfolio Tracker Handoff

## System Role & Objective
You are an elite Staff Software Engineer and Quant Developer. We are building a highly sophisticated, multi-agent portfolio tracker, thematic screener, and decision-making engine for the Indian stock market (NSE/BSE). The system will interface directly with my Zerodha Kite account via the Model Context Protocol (MCP).

## Product Vision
The goal is to move beyond simple P&L tracking. This tool must act as an autonomous financial analyst, monitoring live holdings, analyzing thematic hotspots in the broader market, executing advanced technical screens, and presenting actionable, data-driven entry/exit decisions based on market sentiment and sector momentum.

## Reference Architectures & Feature Extraction

### 1. Agentic Orchestration & LangGraph (mohdasif2294/portfolio-copilot)
- Extract LangGraph workflow and RAG architecture.
- Replicate multi-agent setup for:
  - Portfolio Analysis
  - Screener.in data integration
  - Watchlist Suggestions
- Use Zerodha Kite data as the account source.

### 2. Real-time Research & Sentiment (rooneyrulz/agentic-stock-research-system)
- Replicate multi-agent consensus logic.
- Integrate workflows for:
  - Market Data Agent
  - News Analyst Agent
  - Recommendation Agent
- Produce weighted entry/exit scoring with explicit risk management.

### 3. Thematic Prompt Routing (mayankthole/Dhan-MCP-Trades)
- Adapt natural language routing from Dhan flows to Zerodha MCP.
- Support contextual commands such as:
  - "evaluate my portfolio against current PSU bank thematic momentum"

### 4. Technical Screening Engine (pkjmesra/PKScreener)
- Integrate PKScreener as backend scanning engine.
- Detect:
  - Breakouts
  - Consolidations
  - Momentum anomalies
- Feed technical flags into the LLM context window.

### 5. Categorization & Indexing (debpal/BharatFinTrack)
- Implement BharatFinTrack data structures for NSE equity index categorization.
- Build "Thematic Hotspots" module that maps Zerodha holdings against sector/thematic performance.

### 6. Dashboard & UI (sandeepkumar0801/Ai-portfolio-analyzer-and-trading)
- Use Streamlit architecture as frontend baseline.
- Replicate:
  - Real-time P&L calculations
  - Interactive charting
  - Sector-breakdown visuals
- Inject multi-agent outputs into recommendation panels.

### 7. Headless/CLI Fallback (sd416/zerodha-portfolio)
- Extract lightweight data parsing logic.
- Build modular CLI script for headless cron snapshots of portfolio day changes without Streamlit.

## Execution Roadmap
Do not build everything at once. Execute in four sequential waves.

### Wave 1: Data Pipeline & CLI (Foundation)
- Set up Zerodha Kite connection.
- Implement BharatFinTrack categorizations.
- Build lightweight CLI parser (sd416/zerodha-portfolio pattern).
- Verify live P&L data flow.

### Wave 2: Screener & Hotspot Engine
- Integrate PKScreener logic for automated NSE technical scans.
- Cross-reference technical outputs with thematic indices.
- Identify and rank thematic market hotspots.

### Wave 3: Multi-Agent Decision Engine (Core)
- Implement MCP + LangGraph orchestration.
- Build research, sentiment, and portfolio agents (portfolio-copilot + agentic-stock-research-system patterns).
- Feed Wave 1 + 2 data into agent reasoning.
- Adapt Dhan NLP routing for Zerodha-triggered workflows.

### Wave 4: Streamlit Dashboard (UI)
- Build frontend using Ai-portfolio-analyzer-and-trading style.
- Connect UI to backend agents.
- Render thematic hotspots, AI risk scoring, and interactive charts.

## Current Delivery Status (2026-03-04 IST)

### Completed
- Wave 1 foundation delivered except live-paper validation:
  - broker abstraction + provider contract tests
  - Zerodha auth/session hardening (`auth-url`, `callback`, `session-status`, `logout`)
  - BharatFinTrack ingestion + holdings thematic mapping
  - headless CLI (`portfolio-snapshot`, `run-eod-snapshot`)
- Wave 2 delivered:
  - PKScreener-style scan adapter
  - hotspot scheduler/cache/scoring
  - hotspot API + CLI (`/api/v1/hotspots/*`, `scripts/hotspots-snapshot.js`)
- Wave 3 delivered:
  - intent router + LangGraph-style orchestrator
  - news RAG + weighted consensus + risk controls
  - agent API + CLI (`/api/v1/agents/*`, `scripts/agents-analyze.js`)
- Wave 4 delivered:
  - Streamlit dashboard (`streamlit_app.py`) with portfolio/hotspot/agent panels
  - desktop/mobile regression snapshots captured in `artifacts/ui/`
- Cross-wave delivered:
  - trace IDs + contract metadata across legacy and new APIs
  - replay/backfill engine (`api/_lib/backfillService.js`, `scripts/replay-backfill.js`)
  - config/secrets workflow (`.env.example`, `scripts/config-health.js`)

### Test Status
- Full automated suite passing: `node --test tests/*.test.js` -> `63/63` pass.

### Remaining Blockers / Next Step
- Live-paper validation completed on 2026-03-04 IST:
  - `connected=true`, `providerMode=live`, `rowCount=26`
  - artifact: `artifacts/live-paper-snapshot.json`
- Production deployment + smoke checks completed on 2026-03-04 IST:
  - alias: `https://portfolio-tracker-kappa-woad.vercel.app`
  - smoke artifact: `artifacts/production-smoke.json`
- All release gates (`G1`..`G5`) are complete.
