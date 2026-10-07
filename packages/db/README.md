# @pitchorium/db

Client Drizzle partagé, schémas PostgreSQL, migrations et seed.

- `src/schemas/<module>.ts` : un `pgSchema` par module métier. Les tables d'un module y sont déclarées et seul ce module importe `@pitchorium/db/schemas/<module>` (règle ESLint).
- `src/schemas/identity.ts` (modèles Better Auth avec locale et fuseau horaire, acceptations légales), `access.ts` (rôles), `profiles.ts` (profils, volets, historique des identifiants, données de référence), `media.ts` (fichiers), `organizations.ts` (organisations, membres, invitations, vérification), `network.ts` (suivis, connexions et demandes, blocages, réglages, vues de profil), `content.ts` (publications et repartages, mentions, commentaires, réactions, enregistrements, publications masquées, vues quotidiennes), `impact.ts` (versions de la méthodologie, évaluations), `payments.ts` (comptes de versement, revues KYC, contributions, remboursements, litiges, ledger en partie double, contributions hors plateforme, notifications des prestataires, rapprochements et écarts, état du prestataire simulé), `engagement.ts` (projection des contributions, journal du temps partagé), `messaging.ts` (conversations, participants et leur état, messages numérotés, introductions, réglages), `notifications.ts` (notifications agrégées, livraisons idempotentes, préférences, digests, adresses supprimées, emails de messages non lus en attente), `projects.ts` (projets, historique des slugs, équipe, paliers, contreparties et réservations, contributions appliquées et leurs annulations, actualités, manifestations d'intérêt).
- `src/seeds/` : données de référence (pays ISO 3166-1 et régions UN M49, secteurs CITI/ISIC rév. 4 provisoires, stades provisoires).
- `src/schemas/platform.ts` : tables techniques (`outbox_events`, `inbox_messages`, `idempotency_keys`, `audit_log`, `feature_flags`).
- `src/orm.ts` : réexporte drizzle-orm sous `@pitchorium/db/orm`. Les autres packages importent Drizzle uniquement par ce chemin : le serveur, en CommonJS, chargerait sinon une seconde copie aux types incompatibles.
- `migrations/` : migrations SQL générées par drizzle-kit et versionnées. La migration initiale crée aussi les extensions `pg_trgm`, `unaccent` et `citext`. Le journal des migrations appliquées est la table `drizzle.__drizzle_migrations`.

| Commande (racine)  | Effet                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:generate` | Génère une migration à partir des schémas (`--name <nom>` recommandé via `pnpm --filter @pitchorium/db db:generate --name <nom>`) |
| `pnpm db:check`    | Vérifie la cohérence du dossier `migrations/`                                                                                     |
| `pnpm db:migrate`  | Applique les migrations sur `DATABASE_URL`                                                                                        |
| `pnpm db:seed`     | Crée les feature flags manquants sans modifier leur état, met à jour les données de référence (upsert, sans suppression)          |

`db:migrate` et `db:seed` lisent `apps/server/.env` s'il existe ; une variable `DATABASE_URL` déjà définie dans l'environnement est prioritaire.
