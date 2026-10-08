# @pitchorium/server

Monolithe modulaire NestJS : un code, deux processus (voir `docs/architecture/overview.md`).

```text
src/
  main.api.ts        api : HTTP /v1, Socket.IO, Swagger UI hors production
  main.worker.ts     worker : BullMQ, relais d'outbox, tâches planifiées, sonde de santé
  main.openapi.ts    export de openapi/openapi.json sans serveur réseau
  main.create-admin.ts  commande admin:create (rôle admin d'un compte existant)
  main.reconcile.ts     commande payments:reconcile (rapprochement des paiements à la demande)
  main.discovery-reindex.ts  commande discovery:reindex (reconstruction et contrôle de l'index de recherche)
  api-app.ts         configuration HTTP et Socket.IO de l'api, partagée avec les tests
  app.module.ts      racine de l'api
  worker.module.ts   racine du worker
  business-modules.ts  modules métier de chaque processus (forApi, forWorker)
  platform/          socle technique partagé (aucun import de module métier)
    kernel/          TypeScript pur : Money, IdGenerator, Clock, DomainEvent, DomainError, slugs
    config/          variables d'environnement validées par Zod, arrêt immédiat si invalides
    database/        provider Drizzle, TransactionManager (transaction courante via AsyncLocalStorage)
    outbox/ inbox/ idempotency/ queue/ maintenance/
    realtime/ storage/ mailer/ feature-flags/ audit/
    outbound/        client HTTP sortant protégé contre le SSRF (aperçus de liens, imports d'images)
    http/ observability/ health/ openapi/
  modules/           un dossier par module métier (domain, application, infrastructure, interface)
test/
  architecture/      règles de frontières
  integration/       Testcontainers et Supertest
scripts/             outils de développement
```

| Commande                                                                           | Effet                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:api` / `pnpm dev:worker`                                                 | Lance un processus en watch (SWC), avec `.env`                                                                                                              |
| `pnpm build` puis `pnpm start:api` / `pnpm start:worker`                           | Exécution compilée                                                                                                                                          |
| `pnpm test`                                                                        | Tests unitaires et d'architecture, couverture du kernel à 100 %                                                                                             |
| `pnpm test:integration`                                                            | Tests d'intégration et HTTP (Docker requis : PostgreSQL, Valkey, Mailpit et MinIO pour tous, ClamAV pour les tests media)                                   |
| `pnpm test:providers`                                                              | Sandboxes Stripe et Flutterwave (ADR 0054) : `STRIPE_TEST_SECRET_KEY`, `FLUTTERWAVE_TEST_SECRET_KEY`, facultatif `STRIPE_TEST_CONNECTED_ACCOUNT`            |
| `pnpm providers:stripe-test-account [--create \| --link <acct> \| --check <acct>]` | Compte connecté Stripe de test pour le test Checkout : création (métadonnée `pitchorium_test=checkout-account`), lien d'onboarding et données de test, état |
| `pnpm providers:cleanup`                                                           | Ferme les comptes connectés Stripe, supprime les endpoints de webhook Stripe et les sous-comptes Flutterwave marqués `pitchorium_test=provider-tests`       |
| `pnpm openapi:generate`                                                            | Écrit `openapi/openapi.json` à partir de `dist/`                                                                                                            |
| `pnpm outbox:ping`                                                                 | Insère un événement `platform.ping.v1` relayé par le worker                                                                                                 |
| `pnpm admin:create --email <email>`                                                | Attribue le rôle admin à un compte existant (idempotent)                                                                                                    |
| `pnpm payments:reconcile [--days N]`                                               | Rapprochement des paiements, écarts listés, code de sortie 1 s'il y en a ; ne corrige rien                                                                  |
| `pnpm discovery:reindex [--check]`                                                 | Reconstruit l'index de recherche et les suggestions depuis les façades, ou vérifie et répare la dérive (`--check`, code de sortie 1 s'il y en a une)        |
| `pnpm db:seed:dev`                                                                 | Données de démonstration (`scripts/dev-seed/`), idempotentes, refusées en production                                                                        |

Toutes les variables d'environnement sont décrites dans `.env.example`.
