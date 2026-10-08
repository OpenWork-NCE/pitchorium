#!/usr/bin/env sh
# Runs the end-to-end tests of the web app in the official Playwright image, the environment of
# the CI job: same Chromium, same fonts, so the reference screenshots compare equal. Arguments go
# to `playwright test` (for instance --update-snapshots after an intended visual change).
set -eu

image="mcr.microsoft.com/playwright:v1.64.0-noble"
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

exec docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI="${CI:-}" \
  -e PLAYWRIGHT_IMAGE=1 -v "$root:/work" -w /work/apps/web \
  "$image" node_modules/.bin/playwright test "$@"
