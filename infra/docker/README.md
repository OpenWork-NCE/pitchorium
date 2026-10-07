# Infrastructure locale

`pnpm infra:up` démarre les services et attend qu'ils soient sains, puis lance `minio-init`. `pnpm infra:down` les arrête sans supprimer les volumes (`docker compose -f infra/docker/compose.yaml down -v` pour repartir de zéro).

| Service      | Image                                      | Ports (127.0.0.1)                 | Identifiants                                                         |
| ------------ | ------------------------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| `postgres`   | `postgres:17.11-alpine`                    | 5432                              | `pitchorium` / `pitchorium`, bases `pitchorium` et `pitchorium_test` |
| `valkey`     | `valkey/valkey:9.0.6-alpine`               | 6379                              | aucun                                                                |
| `minio`      | `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` | 9000 (S3), 9001 (console)         | `pitchorium` / `pitchorium-secret`                                   |
| `minio-init` | `pgsty/mc:RELEASE.2026-09-16T00-00-00Z`    | aucun                             | crée `pitchorium-public` (lecture anonyme) et `pitchorium-private`   |
| `mailpit`    | `axllent/mailpit:v1.31.4`                  | 1025 (SMTP), 8025 (interface web) | aucun                                                                |

- `postgres/init/01-init.sh` crée la base de test et active `pg_trgm`, `unaccent` et `citext` à la première initialisation du volume. La migration initiale crée aussi ces extensions.
- Valkey tourne avec `maxmemory-policy noeviction`, exigé par BullMQ.
- MinIO ne publie plus d'images Docker depuis octobre 2025 : les images utilisées sont celles du fork communautaire Pigsty (voir `docs/adr/0011-minio-community-images.md`).
