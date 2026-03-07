#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/decisions docs/runbooks .claude/hooks .codex/skills/prep-for-claude api quant-engine

required_files=(
  "CLAUDE.md"
  "docs/architecture.md"
  "docs/decisions/README.md"
  "docs/runbooks/README.md"
  "docs/runbooks/claude-handoff.md"
  "api/CLAUDE.md"
  "quant-engine/CLAUDE.md"
  ".claude/settings.json"
  ".claude/hooks/README.md"
  ".codex/skills/prep-for-claude/SKILL.md"
)

missing=0
for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"
    missing=1
  else
    echo "OK: $file"
  fi
done

echo ""
echo "Prep for Claude check complete."
if [[ $missing -eq 1 ]]; then
  echo "Some required files are missing. Re-run scaffolding or create them manually."
  exit 1
fi

echo "All required Claude scaffolding files are present."
