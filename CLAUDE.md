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

## Approach
- When given a task, implement the ACTUAL CODE — do not produce planning documents or implementation plans unless explicitly asked to plan.
- Start with the user's specific scope. Do not expand to enterprise-grade solutions (Prisma DB, multi-sprint plans) when the user wants focused utility fixes.
- If you're unsure about scope, ask — don't spend context exploring broadly.

## TypeScript
- This is a TypeScript-first codebase. Always run `tsc --noEmit` after edits to catch type errors before committing.
- When adding analytics events, enum values, or union types, check the valid type definitions first — don't assume string literals are valid.
- Watch for useEffect dependency ordering and variable-before-declaration issues.

## UI/Design Implementation
- When user provides visual references or screenshots, implement BOLD changes — not incremental/subtle tweaks. Match the reference's overall aesthetic, not just individual tokens.
- Never declare a UI revamp complete without the user seeing it on-device. Subtle changes will be rejected.
- When redesigning, change ALL affected screens for consistency — partial screen updates create worse UX than the original.

## Task Completion
- Never declare a phase, milestone, or checklist complete unless every checkbox/item has been verified. If the user provides a checklist, check off items one by one.
- Before saying 'done', re-read the original request and verify each requirement was addressed.

## React Native / Expo
- After code changes, always verify the Metro bundler can serve the bundle. For physical Android devices, run `adb reverse tcp:8081 tcp:8081` before testing.
- Google OAuth on Expo Android: use the **web** client ID approach, not native Android client ID, unless explicitly using bare workflow with native modules.
- If the app shows a blank/white screen, check: (1) Metro connectivity, (2) import errors, (3) navigation container mounting.

## Deployment
- Vercel deployments often require manual dashboard configuration (root directory, repo visibility). Do NOT promise autonomous Vercel deployment. Instead, provide the user with exact steps to configure in the Vercel dashboard after pushing code.
- Always verify the deployment target and auth requirements before attempting deploy commands.
