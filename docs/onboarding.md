# Prise en main

Pour un développeur qui rejoint le projet. Compter une demi-journée.

## 1. Lire, dans cet ordre

1. `AGENTS.md` : règles du dépôt (commits, langues, frontières, définition de terminé).
2. `docs/architecture/overview.md`, puis `modules.md` et `conventions.md`.
3. Le cahier des charges (`docs/product/`, confidentiel, à demander : il n'est pas dans le dépôt) ; on le cite par numéro de section (§10.7).
4. `docs/open-questions.md` : ce qui est provisoire, et pourquoi.
5. Les ADR du domaine touché (`docs/adr/README.md`) et le `README.md` du module.

## 2. Lancer

```sh
corepack enable
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm infra:up && pnpm db:migrate && pnpm db:seed && pnpm db:seed:dev
pnpm dev
```

Vérifier : http://localhost:3000/v1/health/ready, Swagger UI sur http://localhost:3000/docs, Mailpit sur http://localhost:8025. Se connecter avec `aissatou.ba@demo.pitchorium.test` / `pitchorium-demo-2026`. Si le port 3000 est pris, `API_PORT=3100 pnpm dev:api`.

## 3. Se repérer dans le code

- Un module métier = `apps/server/src/modules/<module>/` avec `domain/` (règles pures, sans NestJS ni Drizzle), `application/` (services, ports), `infrastructure/` (Drizzle, prestataires), `interface/` (contrôleurs, handlers, processeurs), `index.ts` (seule surface lisible par les autres modules).
- Un module n'écrit que dans son schéma PostgreSQL, lit les autres par leur façade et réagit à leurs événements par l'outbox ; ESLint et `test/architecture/` le vérifient.
- Contrats d'API : `packages/contracts` (Zod) ; le document OpenAPI et le client Orval en sont générés.
- Services techniques : `apps/server/src/platform/` (base, Redis, files, outbox, inbox, stockage, emails, observabilité, HTTP).

## 4. Ajouter une fonctionnalité

1. Contrat Zod (entrées bornées) et codes d'erreur dans `packages/contracts`, textes dans `packages/i18n` (FR et EN).
2. Schéma et migration (`pnpm db:generate`), domaine testé, service, route avec `@RequireAction` (action ajoutée au registre de `access`) ou `@Public()` (alors aussi dans la liste de `route-inventory.spec.ts`).
3. Données personnelles : exportateur et effaceur du module enregistrés auprès de privacy, entrée dans le registre de conservation.
4. `pnpm build && pnpm api-client:generate` si les routes changent ; documentation dans le même commit.
5. Avant de commiter : les commandes de `AGENTS.md` ; avant de livrer : `pnpm verify:clean`.

## 5. Tests

- `pnpm test` : unitaires et architecture, sans Docker.
- `pnpm test:integration` : modules avec PostgreSQL, Valkey, Mailpit, MinIO en conteneurs.
- `pnpm test:e2e` : après `pnpm build`, api et worker réels.
- `pnpm test:providers` : vraies API de test des prestataires, avec leurs clés.

## 6. Exploitation

Déploiement, environnements, alertes, sauvegardes et runbooks : `docs/operations/` ; sécurité : `docs/security/` ; ce qu'il reste à faire avant la production : `docs/production-readiness.md`.
