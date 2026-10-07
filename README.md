# Pitchorium

Plateforme professionnelle de réseau et de financement à impact entre l'Afrique, les Caraïbes et la diaspora européenne.
Ce dépôt est un monorepo pnpm et Turborepo : un serveur NestJS (api et worker) et des packages partagés.
Le frontend (`apps/web`) fera l'objet d'une étape ultérieure.

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- pnpm 12.9.1 (`corepack enable` active la version déclarée dans `packageManager`)
- Docker avec Docker Compose v2

## Démarrage local

```sh
pnpm install
cp apps/server/.env.example apps/server/.env
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm db:seed:dev
pnpm dev
```

`pnpm db:seed:dev` (facultatif, refusé si `NODE_ENV=production`) ajoute des données de démonstration pour le développement du frontend : 14 membres fictifs (Afrique, Caraïbes, diaspora) avec profils et volets, 3 organisations, connexions, suivis, deux demandes en attente, publications, repartages, commentaires et réactions. Comptes : `<identifiant avec des points>@demo.pitchorium.test` (par exemple `aissatou.ba@demo.pitchorium.test`, `kofi.mensah@demo.pitchorium.test`), mot de passe `pitchorium-demo-2026`. Les photos, couvertures, logos et images sont déposés en quarantaine : le worker (`pnpm dev`) les traite comme de vrais téléversements. Le script est idempotent : une nouvelle exécution n'insère rien.

- api : http://localhost:3000/v1/health/ready, Swagger UI sur http://localhost:3000/docs, authentification sur http://localhost:3000/v1/auth (Better Auth) ; les emails de vérification arrivent dans Mailpit
- worker : sonde sur http://localhost:3001/health/ready ; `pnpm --filter @pitchorium/server outbox:ping` écrit un événement technique que le worker relaie et journalise
- Mailpit : http://localhost:8025, console MinIO : http://localhost:9001, ClamAV (clamd) sur le port 3310, interrogé par le worker pour les fichiers envoyés

## Scripts

| Script                              | Rôle                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                          | Lance l'api et le worker en mode watch                              |
| `pnpm dev:api` / `pnpm dev:worker`  | Lance un seul des deux processus                                    |
| `pnpm build`                        | Compile tous les packages et le serveur                             |
| `pnpm lint`                         | ESLint, dont les règles de frontières entre modules                 |
| `pnpm typecheck`                    | Vérification TypeScript sans émission                               |
| `pnpm test`                         | Tests unitaires et tests HTTP sans dépendance externe               |
| `pnpm test:integration`             | Tests d'intégration (Testcontainers, Docker requis)                 |
| `pnpm format` / `pnpm format:check` | Prettier en écriture ou en vérification                             |
| `pnpm db:generate`                  | Génère une migration Drizzle à partir des schémas                   |
| `pnpm db:migrate`                   | Applique les migrations sur `DATABASE_URL`                          |
| `pnpm db:seed`                      | Seed idempotent (feature flags, données de référence)               |
| `pnpm db:seed:dev`                  | Données de démonstration idempotentes (développement uniquement)    |
| `pnpm db:check`                     | Vérifie la cohérence des migrations                                 |
| `pnpm admin:create --email <email>` | Attribue le rôle admin à un compte existant (idempotent)            |
| `pnpm i18n:check`                   | Vérifie l'alignement des clés de traduction sur le français         |
| `pnpm openapi:generate`             | Exporte `apps/server/openapi/openapi.json` sans démarrer de serveur |
| `pnpm api-client:generate`          | Régénère le client Orval à partir de l'OpenAPI                      |
| `pnpm infra:up` / `pnpm infra:down` | Démarre ou arrête l'infrastructure locale                           |
| `pnpm check:box-drawing`            | Échoue si un fichier suivi contient un caractère U+2500 à U+257F    |

## Documentation

- Cahier des charges et lecture du périmètre : `docs/product/`, document client confidentiel conservé hors du dépôt (ignoré par git)
- [Vue d'ensemble de l'architecture](docs/architecture/overview.md)
- [Modules métier](docs/architecture/modules.md)
- [Conventions](docs/architecture/conventions.md)
- [Stockage objet et configuration Cloudflare R2](docs/architecture/storage.md)
- [Graphe social et fil d'actualité](docs/architecture/social-graph-and-feed.md)
- [Décisions d'architecture (ADR)](docs/adr/README.md)
- [Questions ouvertes](docs/open-questions.md)
- [Infrastructure locale](infra/docker/README.md), [serveur](apps/server/README.md), [base de données](packages/db/README.md), [i18n](packages/i18n/README.md), [emails](packages/emails/README.md), [client d'API](packages/api-client/README.md)
