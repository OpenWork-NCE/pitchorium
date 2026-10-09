#!/usr/bin/env sh
# Production build of the end-to-end tests (.next-e2e) against the stub api: the variables of
# e2e/support/serve.mjs and playwright.config.ts. Served by the stub suite (E2E_SKIP_BUILD=1),
# Lighthouse CI and check:bundles --views; the CI builds it once per run (ADR 0124).
set -eu
cd "$(dirname "$0")/.."
NEXT_DIST_DIR=.next-e2e \
  NEXT_PUBLIC_SITE_URL=http://localhost:3201 \
  NEXT_PUBLIC_API_URL=http://localhost:3299 \
  NEXT_PUBLIC_CDN_URL=http://localhost:3299/files \
  NEXT_PUBLIC_VERCEL_ANALYTICS=false \
  NEXT_PUBLIC_SENTRY_DSN= \
  exec ./node_modules/.bin/next build
