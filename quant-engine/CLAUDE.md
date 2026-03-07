# Quant Engine Context

## Purpose
Python boundary for heavy compute/research/alerts functionality that should not run in Vercel Node runtime.

## Guardrails
- Keep Python dependencies and runtime config isolated under `quant-engine/`.
- Expose stable JSON contracts consumed by root Node gateway (`/api/quant`, `/api/alerts`).
- Avoid coupling to root Node package/dependency graph.

## Ops Note
- Deploy independently from frontend/gateway.
- Verify endpoint compatibility with `api/quant.js` and `api/alerts.js` route map.
