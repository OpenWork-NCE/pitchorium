# Performance

Mesures du 2026-10-08 sur un poste de développement (AMD Ryzen 5 9600X, 6 cœurs, 30 Go), services de `infra/docker/compose.yaml`, données de démonstration (`pnpm db:seed:dev`), **un seul processus api** et un worker construits (`dist/`). Ce sont des ordres de grandeur, à refaire sur l'infrastructure de production choisie (question 24).

## Charge (k6)

`perf/k6/scenarios.js`, lancé par `pnpm perf:load` (k6 2.2.0 en conteneur, api sur `API_URL`, 60 s par défaut, `RATE_FACTOR` multiplie les débits). Dix membres de démonstration connectés ; limites anti-abus relevées pour la mesure (`RATE_LIMIT_MAX`, `PAYMENTS_*_PER_HOUR`), car toutes les requêtes viennent d'une seule adresse.

| Scénario                                      | Débit nominal | Objectif p95 | p95 ×1 (67 req/s) | p95 ×2,5 (167 req/s) | p95 ×5 (demandé 335 req/s) |
| --------------------------------------------- | ------------- | ------------ | ----------------- | -------------------- | -------------------------- |
| Fil (`GET /v1/feed`)                          | 20/s          | 300 ms       | 23 ms             | 25 ms                | 10,4 s                     |
| Recherche (`GET /v1/discovery/search`)        | 20/s          | 300 ms       | 15 ms             | 14 ms                | 4,2 s                      |
| Page projet (`GET /v1/projects/by-slug`)      | 20/s          | 300 ms       | 12 ms             | 12 ms                | 4,7 s                      |
| Création de contribution (prestataire simulé) | 2/s           | 800 ms       | 59 ms             | 29 ms                | 6,7 s                      |
| Envoi de message                              | 5/s           | 800 ms       | 41 ms             | 28 ms                | 7,5 s                      |

- ×1 et ×2,5 : tous les objectifs tenus, 100 % de réponses attendues (le seul échec compté est la sonde de préparation sur un projet dont le porteur ne peut pas encore recevoir de paiement).
- ×5 : un processus api plafonne vers **190 requêtes par seconde** (un cœur, Node.js) ; les requêtes attendent dans la file, aucune erreur. Montée en charge : plusieurs processus api derrière le proxy (sans état, Socket.IO par l'adaptateur Redis), à dimensionner sur le trafic réel.

## Volume de la recherche

`DISCOVERY_VOLUME_SCALE=20 pnpm --filter @pitchorium/server test:integration test/integration/discovery-volume.spec.ts` : **332 000 documents** dans `discovery.search_documents` (personnes, projets, événements, missions, organisations, deux audiences).

- Recherche avec faute de frappe par l'api (`?q=irigation`) : médiane **70 ms**, requête 59 ms.
- Plan : `Limit > Sort > Bitmap Heap Scan > BitmapOr > Bitmap Index Scan` sur `search_documents_document_idx` (GIN, texte) et `search_documents_name_trgm_idx` (GIN, trigrammes) : aucun parcours séquentiel.
- Suggestions d'un membre : 295 ms pour 250 suggestions en 5 listes, requête des candidats 14 ms (index `match_profiles_company_country_idx`, `match_profiles_entrepreneur_sector_idx`, plafond de candidats).
- En CI, l'échelle 1 (16 600 documents) garde les mêmes bornes (ADR 0066, 0068).

## Requêtes SQL (pg_stat_statements)

Extension préchargée par `infra/docker/compose.yaml` (`CREATE EXTENSION pg_stat_statements` une fois par base) ; en production, l'activer sur le PostgreSQL managé. Relevé après une minute de charge nominale :

- `UPDATE messaging.conversations SET last_sequence = last_sequence + 1` : 16,8 ms en moyenne, 363 ms au pire. Attendu : le numéro de séquence d'une conversation est attribué sous verrou de ligne (ADR 0056) et le test concentre tous les envois sur trois conversations. La contention est par conversation, pas globale.
- Lecture des fichiers (`media.assets` par identifiant) : 22 000 appels pour 4 000 requêtes (environ 5 par requête, une par image de carte), 0,01 ms chacun. Candidat à un regroupement si la latence du fil augmente.
- Suggestions (`discovery.suggestions`) : 4 280 appels, 0,26 ms en moyenne.
- Aucune autre requête au-dessus de 1 ms en moyenne hors connexion (`identity.sessions`, 10 ms, une fois par connexion).

## Pools et connexions

- PostgreSQL : `DATABASE_POOL_MAX` par processus (10 par défaut). Total = (processus api + processus worker) × pool, à garder sous `max_connections` moins une marge pour les migrations et l'administration (100 par défaut : au plus 8 processus à 10). Au-delà, un pooler (PgBouncer en mode transaction) devant PostgreSQL.
- Redis : une connexion de commandes par processus, plus celles de BullMQ (une par file et par worker) et de l'adaptateur Socket.IO ; le plan Redis doit accepter quelques dizaines de connexions par processus.
- Le worker traite chaque file avec la concurrence de son processeur ; la profondeur des files et le retard de l'outbox sont mesurés (`docs/operations/slo-and-alerts.md`).
