#!/usr/bin/env sh
# Runs the stories of the design system as tests (play functions and accessibility, both themes)
# in the official Playwright image, as in the CI: same Chromium and fonts. Arguments go to vitest.
set -eu

image="mcr.microsoft.com/playwright:v1.64.0-noble"
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

exec docker run --rm --init --ipc=host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" \
  -v "$root:/work" -w /work/apps/web \
  "$image" node_modules/.bin/vitest run --project stories-light --project stories-dark "$@"
