# 0011. Images MinIO communautaires en local

Statut : acceptée (2026-10-07)

## Contexte

Le stockage local doit être MinIO. MinIO a cessé de publier ses images Docker (Docker Hub et Quay) en octobre 2025, puis archivé l'édition communautaire en 2026 : `minio/minio` n'est plus téléchargeable.

## Décision

Utiliser les images du fork communautaire Pigsty, figées : `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` et `pgsty/mc:RELEASE.2026-09-16T00-00-00Z`. MinIO n'est utilisé qu'en local ; la production utilise Cloudflare R2.

## Conséquences

- Le code ne dépend que de l'API S3 (port `ObjectStorage`) : remplacer MinIO par un autre émulateur S3 (RustFS, Garage, SeaweedFS) ne toucherait que `infra/docker/compose.yaml`.
- Ce choix est à réévaluer si le fork cesse d'être maintenu.
