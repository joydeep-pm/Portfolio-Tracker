# API Module Context

## What lives here
- All Vercel serverless handlers that back `/api/v1/*` routes via rewrites.

## Guardrails
- Keep handlers thin: parsing, auth checks, proxying, envelope metadata.
- Shared logic belongs in `api/_lib/`.
- Preserve contract metadata (`meta.contractVersion`, `meta.traceId`).

## Validation
- For route changes, test both direct handler route (`/api/...`) and rewritten route (`/api/v1/...`).
