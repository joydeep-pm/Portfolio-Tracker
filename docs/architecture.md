# Architecture Overview

## System Shape
- Frontend SPA (`app.js`) renders Themes, Comparison, Portfolio, Signals, Network, Alerts.
- Frontend talks to backend through adapter contracts (`adapterCore.js`) using `/api/v1/*` paths.
- Vercel rewrites map `/api/v1/*` to root serverless handlers in `api/*.js`.
- Python `quant-engine` is a separate runtime boundary for heavy quant/research/alerts operations.

## Runtime Data Planes
- Market plane: `/api/market`, `/api/charts`, `/api/peers`, `/api/hotspots`
- Portfolio plane: `/api/portfolio`, `/api/orders`, `/api/zerodha`, `/api/angel`
- Intelligence plane: `/api/macro`, `/api/agents`, `/api/quant`, `/api/alerts`

## Safety/Operational Notes
- Vercel hobby function count is constrained; route-family multiplexing is used.
- Local watcher limits can cause `EMFILE`; `.vercelignore` and shell limits are required.
- Live-vs-fallback visibility is mandatory in UI and CLI outputs.
