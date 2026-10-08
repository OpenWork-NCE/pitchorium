# One image, three commands (docs/operations/deployment.md):
#   api      node dist/main.api.js       (default)
#   worker   node dist/main.worker.js
#   migrate  node dist/main.migrate.js   (release task, before api and worker)

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
ENV CI=true TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm build \
  && pnpm --filter @pitchorium/server deploy --prod /out \
  && rm -rf /out/src /out/test /out/scripts /out/openapi /out/*.mts /out/eslint.config.mjs /out/tsconfig*.json

# Distroless: no shell, no package manager, the nonroot user (uid 65532).
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=nonroot:nonroot /out /app
USER nonroot
EXPOSE 3000 3001
# Readiness of the api; the worker command overrides it with its probe (WORKER_HEALTH_PORT).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/v1/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["dist/main.api.js"]
