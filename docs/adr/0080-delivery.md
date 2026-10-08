# 0080. Livraison : image, analyses et versions

Statut : acceptée (2026-10-08).

## Contexte

Le backend doit pouvoir être déployé chez un hébergeur encore inconnu (question 24), sans dépendre d'un outil propriétaire, et prouver à chaque changement qu'il ne publie ni secret, ni dépendance vulnérable ou sous licence incompatible.

## Décision

- Une seule image OCI (`Dockerfile`) : compilation sur `node:24.19.0-bookworm-slim`, `pnpm deploy --prod` du serveur, exécution sur `gcr.io/distroless/nodejs24-debian13:nonroot` figée par empreinte (sans shell, uid 65532). Commandes : api (défaut), worker, tâche de release des migrations, seed, création du premier administrateur.
- La CI construit l'image et échoue sur une vulnérabilité haute ou critique corrigeable (Trivy), publie un SBOM CycloneDX, cherche les secrets dans tout l'historique (gitleaks), audite les dépendances de production (`pnpm audit`, seuil haut, exceptions motivées dans `pnpm-workspace.yaml`), refuse les licences GPL et AGPL à l'exécution et lance CodeQL.
- Les pairs optionnels de Better Auth présents dans l'espace de travail (Next.js, drizzle-kit) ne sont pas résolus dans le serveur (`overrides`).
- Versions sémantiques par release-please à partir des Conventional Commits ; la pull request de version n'est fusionnée que par un mainteneur.
- Référence de déploiement neutre : `infra/production/compose.yaml` (une machine virtuelle, Caddy pour TLS), PostgreSQL et Redis managés par défaut.

## Conséquences

- Node.js d'exécution suit l'image distroless (24.21.0 au 2026-10-08) : même version majeure que la compilation, à revérifier à chaque mise à jour d'empreinte.
- Une alerte Trivy sur l'image de base se corrige en mettant à jour son empreinte ; une alerte sans correctif publié n'échoue pas la CI (`--ignore-unfixed`) et se suit dans les rapports.
- L'image pèse environ 700 Mo décompressés, surtout pour le traitement des médias (pdf.js, canvas, sharp) et Sentry.
