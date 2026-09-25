#!/bin/zsh

set -euo pipefail

function fail() {
  print -u2 -- "Scheduled Daily failed: $1"
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

if [[ "$DRY_RUN" == true ]]; then
  exec "$DEVOPS_VAULT_NODE" scripts/generate-daily.mjs
fi

: "${DEVOPS_VAULT_DAILY_GENERATOR:?DEVOPS_VAULT_DAILY_GENERATOR must point to the OpenClaw-to-Markdown adapter}"
[[ -x "$DEVOPS_VAULT_DAILY_GENERATOR" ]] || fail "DEVOPS_VAULT_DAILY_GENERATOR is not executable"

gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated; run gh auth login before enabling scheduled PR creation"
git fetch origin main
git merge --ff-only origin/main

BODY_FILE=$(mktemp -t devops-vault-daily)
trap 'rm -f "$BODY_FILE"' EXIT

# Contract: the external adapter receives one output path and writes only Markdown body content.
# It is responsible for invoking the configured OpenClaw skill and must not write into this repository.
"$DEVOPS_VAULT_DAILY_GENERATOR" "$BODY_FILE"
[[ -s "$BODY_FILE" ]] || fail "OpenClaw adapter produced an empty Daily body"

exec "$DEVOPS_VAULT_NODE" scripts/generate-daily.mjs --body-file "$BODY_FILE" --execute --push --create-pr
