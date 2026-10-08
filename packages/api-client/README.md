# @pitchorium/api-client

Client HTTP typé et hooks TanStack Query, générés par Orval à partir de `apps/server/openapi/openapi.json`.

- `src/generated/` : code généré et versionné. Ne pas modifier à la main.
- `src/http/fetcher.ts` : mutator Orval. `configureApiClient({ baseUrl, headers })` fixe l'origine de l'api et les en-têtes communs ; `headers` reçoit la méthode, le chemin et les en-têtes déjà posés, peut être asynchrone (cookies transmis côté serveur, `Idempotency-Key` d'une écriture) et n'écrase jamais un en-tête de l'appelant. Toute réponse non 2xx lève une `ApiProblemError` qui porte le document RFC 9457 et l'`X-Request-Id` de la réponse. L'interface affiche `problem.code` traduit via `@pitchorium/i18n` (namespace `errors`), jamais `title`.

| Commande                                                | Effet                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm api-client:generate` (racine)                     | Régénère l'OpenAPI du serveur puis le client                          |
| `pnpm --filter @pitchorium/api-client api-client:check` | Régénère et échoue si `src/generated/` diffère de la version commitée |
