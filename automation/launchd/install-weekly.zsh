#!/bin/zsh

set -euo pipefail

function fail() {
  print -u2 -- "Weekly LaunchAgent installation failed: $1"
  exit 1
}

INSTALL=false
if [[ ${1:-} == '--install' ]]; then
  INSTALL=true
elif [[ $# -gt 0 ]]; then
  fail "only --install is supported"
fi

SCRIPT_DIR=${0:A:h}
REPO_DIR=${SCRIPT_DIR:h:h}
PLIST_SOURCE="$SCRIPT_DIR/com.liuzel01.devops-vault.weekly.plist.example"
PLIST_DESTINATION="$HOME/Library/LaunchAgents/com.liuzel01.devops-vault.weekly.plist"
LABEL=com.liuzel01.devops-vault.weekly
USER_DOMAIN="gui/$(id -u)"

[[ -f "$PLIST_SOURCE" ]] || fail "missing plist example: $PLIST_SOURCE"
[[ -x "$REPO_DIR/scripts/run-scheduled-weekly.zsh" ]] || fail "scheduled Weekly script is not executable"
plutil -lint "$PLIST_SOURCE" >/dev/null || fail "plist example is invalid"

GENERATOR=$( /usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:DEVOPS_VAULT_WEEKLY_GENERATOR' "$PLIST_SOURCE" )
OPENCLAW_BIN=$( /usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:DEVOPS_VAULT_OPENCLAW_BIN' "$PLIST_SOURCE" )
[[ -x "$GENERATOR" ]] || fail "Weekly generator is not executable: $GENERATOR"
[[ -x "$OPENCLAW_BIN" ]] || fail "OpenClaw executable is not executable: $OPENCLAW_BIN"

print -- "LaunchAgent source: $PLIST_SOURCE"
print -- "LaunchAgent target: $PLIST_DESTINATION"
print -- "Weekly generator: $GENERATOR"
print -- "OpenClaw executable: $OPENCLAW_BIN"

if [[ "$INSTALL" != true ]]; then
  print -- "Dry-run only. Re-run with --install to install and bootstrap $LABEL."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
if launchctl print "$USER_DOMAIN/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "$USER_DOMAIN/$LABEL"
fi
install -m 644 "$PLIST_SOURCE" "$PLIST_DESTINATION"
launchctl bootstrap "$USER_DOMAIN" "$PLIST_DESTINATION"
launchctl print "$USER_DOMAIN/$LABEL" >/dev/null || fail "LaunchAgent was not loaded"
print -- "Installed and bootstrapped $LABEL. It runs Mondays at 09:10 local time."
