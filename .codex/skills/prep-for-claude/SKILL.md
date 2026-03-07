# Prep for Claude (Codex Skill)

## Purpose
Bootstrap or refresh a repository so Claude has reliable project-native context.

## Use This Skill When
- starting a new codebase with Claude Code
- handoff quality is poor across sessions
- contributors keep repeating setup instructions in prompts

## Command
```bash
bash scripts/prep-for-claude.sh
```

## What This Skill Ensures
1. Root memory exists and is concise (`CLAUDE.md`).
2. Progressive docs exist (`docs/architecture.md`, `docs/decisions/`, `docs/runbooks/`).
3. Guardrail scaffolding exists (`.claude/hooks/`).
4. Reusable Codex skill scaffold exists (`.codex/skills/prep-for-claude/`).
5. Local module context exists for critical zones (`api/CLAUDE.md`, `quant-engine/CLAUDE.md`).
6. Claude handoff runbook exists (`docs/runbooks/claude-handoff.md`).

## Output Contract
After running, provide:
- created/updated file list
- any missing manual inputs
- next recommended verification commands
