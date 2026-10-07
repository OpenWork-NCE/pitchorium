# Décisions d'architecture

Un fichier par décision, numéroté, au format Contexte / Décision / Conséquences. Une décision remplacée n'est pas supprimée : son statut indique l'ADR qui la remplace.

| ADR                                            | Décision                              |
| ---------------------------------------------- | ------------------------------------- |
| [0001](0001-modular-monolith-two-processes.md) | Monolithe modulaire à deux processus  |
| [0002](0002-one-postgres-schema-per-module.md) | Un schéma PostgreSQL par module       |
| [0003](0003-zod-as-contract-source.md)         | Zod comme source unique des contrats  |
| [0004](0004-drizzle-orm.md)                    | Drizzle ORM                           |
| [0005](0005-postgres-search-behind-port.md)    | Recherche PostgreSQL derrière un port |
| [0006](0006-outbox-and-inbox.md)               | Outbox et inbox                       |
| [0007](0007-money-minor-units-and-ledger.md)   | Argent en unités mineures et ledger   |
| [0008](0008-vitest-and-testcontainers.md)      | Vitest et Testcontainers              |
| [0009](0009-express-http-adapter.md)           | Adaptateur HTTP Express               |
| [0010](0010-eslint-boundaries.md)              | Frontières vérifiées par ESLint       |
| [0011](0011-minio-community-images.md)         | Images MinIO communautaires en local  |
| [0012](0012-runtime-and-version-choices.md)    | Runtime et choix de versions          |
