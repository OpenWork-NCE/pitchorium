# Mise en œuvre sur une machine virtuelle

Guide de référence pour un premier déploiement sur une seule machine virtuelle Linux (2 vCPU, 4 Go de RAM au minimum, ClamAV en demandant environ 1,5 Go), avant le choix d'un hébergeur (question 24).

1. Installer Docker Engine et le plugin Compose ; ouvrir uniquement les ports 80 et 443.
2. Créer les DNS : `api.<domaine>` vers la machine, le domaine public des fichiers vers le bucket R2 (`docs/architecture/storage.md`).
3. Copier `infra/production/` sur la machine, créer `infra/production/.env` à partir de `docs/operations/environments.md` (colonne Production) ; les secrets viennent du gestionnaire de secrets, jamais du dépôt.
4. Choisir PostgreSQL et Redis managés (recommandé) en renseignant `DATABASE_URL` et `REDIS_URL`, ou lancer les services locaux avec `docker compose --profile self-hosted up -d postgres valkey` (sauvegardes à votre charge : `docs/operations/backup-and-restore.md`).
5. Renseigner `API_DOMAIN` (pour Caddy) et `PITCHORIUM_IMAGE` (image et version).
6. Migrations : `docker compose run --rm migrate`.
7. Flags et données de référence : `docker compose run --rm seed` ; puis, une fois le premier compte créé par l'application web, `docker compose run --rm migrate dist/main.create-admin.js --email <email>` lui donne le rôle `admin` (il se reconnecte et active la double authentification).
8. Démarrer : `docker compose up -d api worker caddy clamav`, vérifier `https://api.<domaine>/v1/health/ready`.
9. Mises à jour : nouvelle image, `docker compose run --rm migrate`, puis `docker compose up -d api worker`.
