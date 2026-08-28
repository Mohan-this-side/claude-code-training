#!/usr/bin/env bash
#
# Block `git push` unless the merchant console's tests and build pass.
#
# CLAUDE.md already says to run the checks before pushing. That is guidance,
# and guidance gets skipped exactly when it matters — long sessions, after a
# compaction, under time pressure. This is enforcement: it runs before the
# tool call, every time, and a non-zero exit stops the push.
#
# Wired as a PreToolUse hook on Bash in .claude/settings.json.
# Escape hatch for a genuine emergency: NORTHWIND_SKIP_PREPUSH=1 git push ...

set -uo pipefail

payload="$(cat)"

# Only Bash calls are interesting; everything else passes straight through.
case "$payload" in
  *'"tool_name"'*'"Bash"'*) ;;
  *) exit 0 ;;
esac

# And only pushes. Reads, commits, and branch work are none of our business.
case "$payload" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

if [ "${NORTHWIND_SKIP_PREPUSH:-0}" = "1" ]; then
  echo "pre-push-check: skipped via NORTHWIND_SKIP_PREPUSH=1." >&2
  exit 0
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
console="$repo_root/build-battle/merchant-console"

if [ ! -d "$console" ]; then
  # Not a checkout that contains the console. Nothing to check, so allow.
  exit 0
fi

if [ ! -d "$console/node_modules" ]; then
  cat >&2 <<'MSG'
pre-push-check: dependencies are not installed, so the checks could not run.

  cd build-battle/merchant-console && npm ci

Allowing the push rather than blocking on a missing install — but nothing
was verified.
MSG
  exit 0
fi

run_check() {
  local label="$1"
  shift
  local output
  if ! output="$("$@" 2>&1)"; then
    {
      echo "pre-push-check: BLOCKED — $label failed, so the push did not run."
      echo
      echo "$output" | tail -n 40
      echo
      echo "Fix it and push again, or set NORTHWIND_SKIP_PREPUSH=1 if this is"
      echo "genuinely an emergency and you intend to push a red branch."
    } >&2
    exit 2
  fi
}

cd "$console" || exit 0

run_check "npm test" npm test --silent
run_check "npm run build" npm run build
run_check "npm run lint" npm run lint --silent

echo "pre-push-check: tests, build and lint all passed. Pushing." >&2
exit 0
