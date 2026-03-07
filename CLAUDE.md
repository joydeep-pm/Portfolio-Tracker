# CLAUDE.md

## Purpose
Portfolio Tracker is an India-market intelligence workspace that combines:
- live thematic market view (NSE/BSE)
- portfolio decisioning (Zerodha ownership, Angel market overlay)
- signals workflows (macro, technical, research, alerts)

Primary business requirement: when requested, enforce **live non-synthetic** market generation at `175` micro-clusters and `2486` stocks.

## Repo Map
- `app.js`, `index.html`, `styles.css`: primary frontend app shell and workflows
- `adapterCore.js`: frontend adapter contracts and backend normalizers
- `api/`: Vercel serverless gateway routes (`market`, `charts`, `peers`, `portfolio`, `orders`, `macro`, `alerts`, `quant`, etc.)
- `api/_lib/`: shared backend logic (brokers, mapping, contracts, traces, decision helpers)
- `quant-engine/`: Python service boundary for quant/research/alerts heavy logic
- `scripts/`: operational CLIs (ingest, snapshots, backfills, health checks)
- `data/`: generated and seed catalogs (including thematic catalog)
- `tests/`: Node test suite
- `tasks/`: active plans, handoff notes, lessons learned
- `docs/`: architecture, decisions, and runbooks for progressive context

## Rules + Commands
- Keep Node/Vercel gateway in root `api/`; keep Python-heavy logic in `quant-engine/`.
- Do not silently claim live mode; verify source and mode in outputs.
- For strict live catalog generation use:
  - `node scripts/ingest-bharatfintrack.js --target-stocks 2486 --target-clusters 175 --require-live --output ./data/thematic_index_catalog.json`
- Local functional run:
  - `npx vercel dev --listen 4173`
- Regression tests:
  - `node --test tests/*.test.js`
- When touching critical flows, update:
  - `tasks/todo.md` (plan + review)
  - `tasks/handoff.md` (thread continuity)
  - `tasks/lessons.md` (prevent repeated mistakes)
- For full critical-audit context and execution checklist, start at:
  - `docs/runbooks/claude-handoff.md`
