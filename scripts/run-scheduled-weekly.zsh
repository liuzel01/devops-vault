#!/bin/zsh

set -euo pipefail

function fail() {
  print -u2 -- "Scheduled Weekly failed: $1"
  exit 1
}

DRY_RUN=false
if [[ ${1:-} == '--dry-run' ]]; then
  DRY_RUN=true
elif [[ $# -gt 0 ]]; then
  fail "only --dry-run is supported"
fi

: "${DEVOPS_VAULT_DIR:?DEVOPS_VAULT_DIR must point to the repository}"
: "${DEVOPS_VAULT_NODE:?DEVOPS_VAULT_NODE must point to a Node.js executable}"

[[ -d "$DEVOPS_VAULT_DIR/.git" ]] || fail "DEVOPS_VAULT_DIR is not a Git repository"
[[ -x "$DEVOPS_VAULT_NODE" ]] || fail "DEVOPS_VAULT_NODE is not executable"

cd "$DEVOPS_VAULT_DIR"
[[ $(git branch --show-current) == main ]] || fail "scheduled generation must start from main"
[[ -z $(git status --porcelain) ]] || fail "worktree is not clean"

# Schedule runs on Monday and always covers the ISO week that ended the day before.
ISO_WEEK=$("$DEVOPS_VAULT_NODE" -e '
const date = new Date();
date.setDate(date.getDate() - 7);
date.setHours(0, 0, 0, 0);
date.setDate(date.getDate() + 4 - (date.getDay() || 7));
const yearStart = new Date(date.getFullYear(), 0, 1);
const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
console.log(`${date.getFullYear()}-W${String(week).padStart(2, "0")}`);
')

if [[ "$DRY_RUN" == true ]]; then
  exec "$DEVOPS_VAULT_NODE" scripts/generate-weekly.mjs --week "$ISO_WEEK"
fi

: "${DEVOPS_VAULT_WEEKLY_GENERATOR:?DEVOPS_VAULT_WEEKLY_GENERATOR must point to the OpenClaw-to-Markdown adapter}"
[[ -x "$DEVOPS_VAULT_WEEKLY_GENERATOR" ]] || fail "DEVOPS_VAULT_WEEKLY_GENERATOR is not executable"

gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated; run gh auth login before enabling scheduled PR creation"
git fetch origin main
git merge --ff-only origin/main

BODY_FILE=$(mktemp -t devops-vault-weekly)
trap 'rm -f "$BODY_FILE"' EXIT

# Contract: the external adapter receives one output path and writes only Markdown body content.
# It is responsible for invoking the configured OpenClaw skill and must not write into this repository.
"$DEVOPS_VAULT_WEEKLY_GENERATOR" "$BODY_FILE" "$ISO_WEEK"
[[ -s "$BODY_FILE" ]] || fail "OpenClaw adapter produced an empty Weekly body"

exec "$DEVOPS_VAULT_NODE" scripts/generate-weekly.mjs --week "$ISO_WEEK" --body-file "$BODY_FILE" --execute --push --create-pr
