# Déploiement

L'hébergeur n'est pas choisi (question 24) : ce guide est neutre vis-à-vis du fournisseur. Il suppose des conteneurs OCI, un PostgreSQL 17 et un Redis compatibles (managés ou non), deux buckets compatibles S3 (Cloudflare R2) et un nom de domaine avec TLS.

## Image

`Dockerfile` (racine) : construction multi-étapes (`node:24.19.0-bookworm-slim` pour l'installation et la compilation, `pnpm deploy --prod` du serveur), exécution sur `gcr.io/distroless/nodejs24-debian13:nonroot`, figée par empreinte (sans shell ni gestionnaire de paquets, utilisateur `nonroot`, uid 65532 ; Node.js 24.21.0 à l'exécution, même version majeure et même ABI que la compilation en 24.19.0). L'image Debian 12 a été écartée : Trivy y relevait des vulnérabilités d'OpenSSL corrigées dans Debian 13. Taille : environ 700 Mo décompressés, dont 360 Mo de dépendances (pdf.js, canvas et sharp pour les médias, Sentry). Une seule image, trois commandes :

| Commande                                    | Rôle                                      |
| ------------------------------------------- | ----------------------------------------- |
| `dist/main.api.js` (défaut)                 | api HTTP et Socket.IO, `API_PORT`         |
| `dist/main.worker.js`                       | worker, sonde `WORKER_HEALTH_PORT`        |
| `dist/main.migrate.js`                      | tâche de release : migrations, puis fin   |
| `dist/main.seed.js`                         | flags et données de référence, idempotent |
| `dist/main.create-admin.js --email <email>` | premier administrateur                    |

Le `HEALTHCHECK` de l'image interroge `GET /v1/health/live` de l'api ; le worker se sonde sur `http://127.0.0.1:<WORKER_HEALTH_PORT>/health/live` (`infra/production/compose.yaml`). La lecture prête (`/v1/health/ready`, `/health/ready`) vérifie PostgreSQL, Redis et le stockage. La CI construit l'image et l'analyse avec Trivy.

## Versions

release-please (`.github/workflows/release-please.yaml`, `release-please-config.json`) tient une pull request de version à partir des Conventional Commits : version sémantique (avant 1.0, une fonctionnalité incrémente la version mineure), `CHANGELOG.md`. Rien n'est publié tant qu'un mainteneur ne la fusionne pas ; la fusion crée l'étiquette `v<version>` et la release GitHub. La première, `v0.1.0`, est préparée et non publiée.

## Ordre d'une mise en production

1. Construire et pousser l'image (étiquette = version, par exemple `0.1.0`, et empreinte).
2. Lancer la tâche de release `dist/main.migrate.js` avec l'environnement de production, une seule fois, et attendre sa réussite.
3. Déployer le worker, puis l'api (ou les deux), en remplaçant les instances une à une ; l'arrêt propre (SIGTERM) termine les requêtes et les tâches en cours.
4. Vérifier `/v1/health/ready`, les métriques et les journaux.

## Migrations sans interruption (expand et contract)

Une version de l'application tourne pendant un temps avec le schéma de la suivante. Toute migration doit donc être compatible avec le code précédent :

- **Expand** (version N) : ajouter colonnes nullables ou avec défaut, tables, index (`CREATE INDEX` sur une grosse table : à créer hors migration avec `CONCURRENTLY`, puis à déclarer) ; le code N écrit dans l'ancien et le nouveau champ si besoin.
- **Migration des données** : tâche idempotente du worker ou commande, par lots.
- **Contract** (version N+1 ou plus tard) : retirer l'ancien champ une fois qu'aucune version déployée ne le lit.
- Jamais dans la même version : renommer ou supprimer une colonne lue par la version en production, ajouter une contrainte `NOT NULL` sans défaut sur une table remplie.
- Une migration n'est jamais modifiée après sa publication ; `pnpm db:check` vérifie la cohérence du journal.

## Référence sur une machine virtuelle

`infra/production/compose.yaml` : api, worker, Caddy (TLS automatique, en-têtes) et ClamAV, PostgreSQL et Redis managés de préférence (des services locaux sont fournis en option, profil `self-hosted`). Voir `docs/operations/vm-guide.md`.

## Proxys de confiance et adresse des visiteurs

La limitation de débit de l'api compte une requête par session, puis par adresse du visiteur relayée par le serveur du web, puis par adresse de la requête (ADR 0114 et 0115). Les adresses ne sont justes que si les proxys sont déclarés :

- api : `TRUST_PROXY_HOPS` = nombre de proxys devant l'api (Caddy dans la référence : `1` ; un CDN devant Caddy : `2`). Chacun doit ajouter l'adresse qu'il voit à `X-Forwarded-For` (Caddy le fait par défaut ; Cloudflare aussi, et donne `CF-Connecting-IP`).
- web : `WEB_TRUST_PROXY_HOPS` = nombre de proxys devant le serveur Next.js (Vercel : `1`, la plateforme réécrit `X-Forwarded-For` ; un conteneur derrière un reverse proxy : `1`, plus un par CDN). À `0`, le web ne relaie aucune adresse : sans proxy, `X-Forwarded-For` vient du client et ne prouve rien.
- `WEB_CLIENT_ADDRESS_SECRET` : même valeur dans l'api et dans le web, 32 caractères au moins, dans le gestionnaire de secrets ; la changer dans les deux à la fois (un écart fait seulement compter les visiteurs sur l'adresse du serveur du web jusqu'au déploiement suivant).
- Le web joint l'api par son réseau privé de préférence (`API_INTERNAL_URL`) ; l'api ne doit jamais faire confiance à `X-Forwarded-For` au-delà de ses propres proxys.

## Environnements

`docs/operations/environments.md` liste chaque variable, son type et sa valeur en local, en staging et en production.
