# @pitchorium/api-client

Client HTTP typé et hooks TanStack Query, générés par Orval à partir de `apps/server/openapi/openapi.json`.

- `src/generated/` : code généré et versionné. Ne pas modifier à la main.
- `src/http/fetcher.ts` : mutator Orval. `configureApiClient({ baseUrl, headers })` fixe l'origine de l'api et les en-têtes communs ; toute réponse non 2xx lève une `ApiProblemError` qui porte le document RFC 9457. L'interface affiche `problem.code` traduit via `@pitchorium/i18n` (namespace `errors`), jamais `title`.

| Commande                                                | Effet                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm api-client:generate` (racine)                     | Régénère l'OpenAPI du serveur puis le client                          |
| `pnpm --filter @pitchorium/api-client api-client:check` | Régénère et échoue si `src/generated/` diffère de la version commitée |
