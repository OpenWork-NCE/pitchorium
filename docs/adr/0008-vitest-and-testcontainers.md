# 0008. Vitest et Testcontainers

Statut : acceptée (2026-10-07)

## Contexte

Le serveur utilise les décorateurs NestJS avec métadonnées. Les comportements critiques (outbox, inbox, idempotence, migrations) dépendent de PostgreSQL et de Redis réels.

## Décision

Vitest partout (Jest exclu), avec `unplugin-swc` pour émettre les métadonnées de décorateurs. Tests d'intégration avec Testcontainers (PostgreSQL 17 et Valkey démarrés une fois par exécution) et Supertest pour HTTP. Couverture à 100 % imposée sur le kernel.

## Conséquences

- Les tests d'intégration exigent Docker, localement comme en CI.
- Un seul outil de test pour tous les packages ; les fichiers de configuration sont en `.mts`.
