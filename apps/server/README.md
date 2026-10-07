# @pitchorium/server

Monolithe modulaire NestJS : un code, deux processus (voir `docs/architecture/overview.md`).

```text
src/
  main.api.ts        api : HTTP /v1, Socket.IO, Swagger UI hors production
  main.worker.ts     worker : BullMQ, relais d'outbox, tâches planifiées, sonde de santé
  main.openapi.ts    export de openapi/openapi.json sans serveur réseau
  app.module.ts      racine de l'api
  worker.module.ts   racine du worker
  business-modules.ts
  platform/          socle technique partagé (aucun import de module métier)
    kernel/          TypeScript pur : Money, IdGenerator, Clock, DomainEvent, DomainError
    config/          variables d'environnement validées par Zod, arrêt immédiat si invalides
    database/        provider Drizzle, TransactionManager (transaction courante via AsyncLocalStorage)
    outbox/ inbox/ idempotency/ queue/ maintenance/
    realtime/ storage/ mailer/ feature-flags/ audit/
    http/ observability/ health/ openapi/
  modules/           un dossier par module métier (domain, application, infrastructure, interface)
test/
  architecture/      règles de frontières
  integration/       Testcontainers et Supertest
scripts/             outils de développement
```

| Commande                                                 | Effet                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev:api` / `pnpm dev:worker`                       | Lance un processus en watch (SWC), avec `.env`                  |
| `pnpm build` puis `pnpm start:api` / `pnpm start:worker` | Exécution compilée                                              |
| `pnpm test`                                              | Tests unitaires et d'architecture, couverture du kernel à 100 % |
| `pnpm test:integration`                                  | Tests d'intégration et HTTP (Docker requis)                     |
| `pnpm openapi:generate`                                  | Écrit `openapi/openapi.json` à partir de `dist/`                |
| `pnpm outbox:ping`                                       | Insère un événement `platform.ping.v1` relayé par le worker     |

Toutes les variables d'environnement sont décrites dans `.env.example`.
