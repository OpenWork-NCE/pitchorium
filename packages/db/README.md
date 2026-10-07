# @pitchorium/db

Client Drizzle partagé, schémas PostgreSQL, migrations et seed.

- `src/schemas/<module>.ts` : un `pgSchema` par module métier. Les tables d'un module y sont déclarées et seul ce module importe `@pitchorium/db/schemas/<module>` (règle ESLint).
- `src/schemas/platform.ts` : tables techniques (`outbox_events`, `inbox_messages`, `idempotency_keys`, `audit_log`, `feature_flags`).
- `migrations/` : migrations SQL générées par drizzle-kit et versionnées. La migration initiale crée aussi les extensions `pg_trgm`, `unaccent` et `citext`. Le journal des migrations appliquées est la table `drizzle.__drizzle_migrations`.

| Commande (racine)  | Effet                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate` | Génère une migration à partir des schémas (`--name <nom>` recommandé via `pnpm --filter @pitchorium/db db:generate --name <nom>`) |
| `pnpm db:check`    | Vérifie la cohérence du dossier `migrations/`                                                                                     |
| `pnpm db:migrate`  | Applique les migrations sur `DATABASE_URL`                                                                                        |
| `pnpm db:seed`     | Crée les feature flags manquants sans modifier leur état                                                                          |

`db:migrate` et `db:seed` lisent `apps/server/.env` s'il existe ; une variable `DATABASE_URL` déjà définie dans l'environnement est prioritaire.
