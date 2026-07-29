#!/usr/bin/env bash
#
# Run every check and exit non-zero if any fails.
#
# This exists because `npm run verify | tail -4` silently discards the exit
# code — the pipeline reports tail's status, not the check's — and that let a
# commit through on a red run three separate times in this project. Piping
# *this* is safe: the summary is short enough not to need truncating, and the
# status is the last thing printed as well as the exit code.
set -uo pipefail

fail=0
run() {
  printf '\n\033[1m▸ %s\033[0m\n' "$1"; shift
  if "$@"; then :; else fail=1; printf '\033[31m  FAILED\033[0m\n'; fi
}

run "typecheck" npx tsc --noEmit
run "unit tests" npx vitest run --reporter=dot
run "browser checks" npm run --silent smoke
# Typography was measured by a script nobody ran. Sprint 13's side panel took
# the HUD prompt from 58ch to 32ch — out of the band the script exists to
# enforce — and every check stayed green for a whole sprint.
run "typography" npm run --silent type -- --strict

if [ "$fail" -eq 0 ]; then
  printf '\n\033[32mall checks passed\033[0m\n'
else
  printf '\n\033[31mVERIFY FAILED\033[0m\n'
fi
exit "$fail"
