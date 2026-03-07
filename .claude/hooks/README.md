# Claude Hooks (Guardrails)

Use this directory for deterministic guardrails that should always execute.

Recommended hooks for this repo:
- post-edit: lightweight syntax checks on touched JS files
- pre-commit: contract/test smoke for touched API routes
- protect-paths: block accidental edits to sensitive files unless explicitly requested

Keep hooks fast and idempotent.
