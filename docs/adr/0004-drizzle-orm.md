# 0004. Drizzle ORM

Statut : acceptée (2026-10-07)

## Contexte

Le besoin est un accès SQL typé, proche de PostgreSQL (schémas, `FOR UPDATE SKIP LOCKED`, index partiels, full-text), avec des migrations SQL lisibles.

## Décision

Drizzle ORM 0.45.3 et drizzle-kit 0.31.11 (dernières versions stables ; la 1.0 est encore en release candidate), avec le pilote `pg` (node-postgres), instrumenté par OpenTelemetry. `@pitchorium/db` est le seul point d'entrée Drizzle : les opérateurs sont réexportés par `@pitchorium/db/orm`, car le serveur (CommonJS) importerait sinon une seconde copie de drizzle-orm aux types incompatibles.

## Conséquences

- Migrations générées par `drizzle-kit generate`, versionnées et vérifiées en CI (`db:check`, absence de migration non générée).
- Pas de génération d'identifiants ni de dates par défaut en base pour les données métier : l'application les fournit.
- La migration vers drizzle 1.0 sera une décision séparée une fois la version stable publiée.
