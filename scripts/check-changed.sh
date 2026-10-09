#!/usr/bin/env sh
# Level 1 of the verification (docs/architecture/testing.md): lint, typecheck and unit tests of
# the packages changed since CHANGED_BASE (origin/main by default, uncommitted changes included)
# and of the packages that depend on them. The tests run after the static checks: the boundary
# tests of the server write files that break the rules into src/ for the time of a test.
# Other arguments go to `turbo run`.
set -eu
filter="...[${CHANGED_BASE:-origin/main}]"
pnpm turbo run lint typecheck --filter="$filter" "$@"
exec pnpm turbo run test --filter="$filter" "$@"
