#!/usr/bin/env sh
# Lighthouse CI on the production build of the end-to-end tests (ADR 0090): mobile profile,
# budgets of lighthouserc.cjs. Chrome is found by chrome-launcher (CHROME_PATH to choose it).
set -eu
cd "$(dirname "$0")/.."
NEXT_DIST_DIR=.next-e2e \
  NEXT_PUBLIC_SITE_URL=http://localhost:3201 \
  NEXT_PUBLIC_API_URL=http://localhost:3299 \
  NEXT_PUBLIC_CDN_URL=http://localhost:3299/files \
  NEXT_PUBLIC_VERCEL_ANALYTICS=false \
  NEXT_PUBLIC_SENTRY_DSN= \
  ./node_modules/.bin/next build
# Signed in for the member space, then as a visitor for the public pages of resources.
./node_modules/.bin/lhci collect
LHCI_VISITOR=1 ./node_modules/.bin/lhci collect --additive
./node_modules/.bin/lhci assert
exec ./node_modules/.bin/lhci upload
