# Portfolio Tracker Handoff (New Thread)

## Timestamp
- IST: 2026-03-07
- Repo: `/Users/joy/Portfolio Tracker`
- Branch: `main`
- Latest commit: `a8ffe6e` (`feat: add pending alert enqueue flow for dispatch validation`)
- Production web URL: `https://portfolio-tracker-kappa-woad.vercel.app`
- Quant engine URL: `https://portfolio-tracker-if7l.onrender.com`

## Current Objective State
- Phase 4-7 stack exists (UI charting, quant worker, RAG/NLP, alerts automation).
- Vercel frontend/backend gateway is live.
- Quant-engine is deployed separately on Render (architecture boundary respected).
- Alert cron auth is configured and working (`200` confirmed on dispatch route).

## What Was Just Completed
1. **Angel auto-session bootstrap on frontend init**
   - Commit: `1d502e1`
   - File: `app.js`
   - Effect: app now attempts `POST /api/angel/session` automatically on startup, reducing manual reconnect friction.

2. **Alerts pending-queue test flow**
   - Commit: `a8ffe6e`
   - Files:
     - `quant-engine/routers/alerts.py` (new `POST /api/v1/alerts/enqueue`)
     - `api/alerts.js` (new `route=enqueue`)
     - `vercel.json` rewrite for `/api/v1/alerts/enqueue`
     - `index.html` + `app.js` (new button: `Create Pending Test Event`)
   - Effect: should allow deterministic `pending -> dispatch -> sent` validation from UI.

## Active Status
- `enqueue -> dispatch -> events` flow is now working on live.
- Verified on **2026-03-07**:
  - `POST https://portfolio-tracker-if7l.onrender.com/api/v1/alerts/enqueue` returned `queued:true`.
  - `POST https://portfolio-tracker-kappa-woad.vercel.app/api/alerts?route=enqueue` returned `queued:true`.
  - `dispatch` processed pending events and `events` showed `status:"sent"` with delivery rows.

## Required Next Action (First Thing In New Thread)
Re-run the same production checks below after any Render/Vercel deploy touching alerts routes:

```bash
# direct worker check
curl -sS -X POST "https://portfolio-tracker-if7l.onrender.com/api/v1/alerts/enqueue" \
  -H "Content-Type: application/json" \
  -d '{"title":"probe","body":"probe","channels":["telegram"],"event_type":"manual_validation","severity":"info"}'

# gateway check
curl -sS -X POST "https://portfolio-tracker-kappa-woad.vercel.app/api/alerts?route=enqueue" \
  -H "Content-Type: application/json" \
  -d '{"title":"probe","body":"probe","channels":["telegram"],"event_type":"manual_validation","severity":"info"}'
```

Expected enqueue response includes:
- `queued: true`
- `status: "pending"`
- `event_id` (integer)

Then in UI:
1. Click `Create Pending Test Event`
2. Click `Force Run Automation Engine`
3. Confirm `processed_events > 0` and event status transitions out of `pending`.

## Cron Status
- External cron-job.org path is set to call:
  - `GET /api/alerts?route=dispatch`
  - Header: `Authorization: Bearer <CRON_SECRET>`
- Manual curl returned `200`, so auth pipeline works.
- Note: `processed_events: 0` is valid when queue is empty.

## Security Note (Important)
- `CRON_SECRET` value was exposed in a screenshot during debugging.
- Rotate secret immediately:
  1. Generate new: `openssl rand -hex 32`
  2. Update Vercel `CRON_SECRET`
  3. Update cron-job.org Authorization header
  4. Redeploy Vercel

## Reality of Current Data Modes
- **Env ready != connected live feed** for Angel.
- Live market data requires valid runtime session cookies (`pt_angel_*`).
- App now auto-attempts session bootstrap on init, but if broker/session fails, data can still fallback.

## Deferred Roadmap Item (Do Not Pull Forward Yet)
- Future concept: **India AI Investment Committee** inspired by multi-agent research systems such as `virattt/ai-hedge-fund`, but adapted for NSE/BSE realities.
- Positioning:
  - research copilot and paper-trading decision layer
  - not autonomous live trading
  - not "hedge fund" branding
- Intended scope when the product is ready:
  1. theme agent
  2. fundamentals agent
  3. technicals agent
  4. earnings/news agent
  5. macro/policy agent
  6. risk manager
  7. portfolio allocator
  8. paper execution simulator
- India-specific constraints that must be respected:
  - NSE/BSE symbol mapping and corporate-action hygiene
  - brokerage/session reliability across Zerodha/Angel
  - India transaction cost modeling (STT, stamp duty, exchange charges, GST, brokerage, SEBI charges)
  - liquidity/slippage and lot-size constraints for Indian instruments
- Explicit prerequisites before starting:
  1. stabilize existing feature flows
  2. fix typography/readability issues
  3. improve feature discoverability and onboarding
  4. harden live data and broker session reliability
  5. replace heuristic trigger UX with a real trigger/event data model
  6. build repeatable backtest + paper-trade evaluation
- Build-order guidance:
  - start with ranking, explanation, and paper allocation
  - defer any real broker execution until paper results survive cost/slippage modeling

## Most Relevant Files for Next Thread
- `/Users/joy/Portfolio Tracker/app.js`
- `/Users/joy/Portfolio Tracker/index.html`
- `/Users/joy/Portfolio Tracker/api/alerts.js`
- `/Users/joy/Portfolio Tracker/vercel.json`
- `/Users/joy/Portfolio Tracker/quant-engine/routers/alerts.py`
- `/Users/joy/Portfolio Tracker/tasks/roadmap.md`
- `/Users/joy/Portfolio Tracker/docs/runbooks/claude-handoff.md`
- `/Users/joy/Portfolio Tracker/tasks/todo.md`
- `/Users/joy/Portfolio Tracker/tasks/lessons.md`

## Git Snapshot
- Recent commits:
  - `a8ffe6e` feat: add pending alert enqueue flow for dispatch validation
  - `1d502e1` fix: auto-bootstrap angel session on frontend init
  - `4d9cbe8` fix: improve cluster modal name realism and source transparency
  - `03dff8b` fix: make signals focus selector portfolio-holdings only
  - `3377ab0` chore: remove vercel cron for hobby-plan compatible deployments
