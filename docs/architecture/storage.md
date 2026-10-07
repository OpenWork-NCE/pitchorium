# Stockage objet et configuration Cloudflare R2

Le port `ObjectStorage` (`apps/server/src/platform/storage`) parle le protocole S3 : MinIO en local et dans les tests d'intégration, Cloudflare R2 en production. Il n'utilise que des opérations documentées comme prises en charge par R2.

## Mécanismes et compatibilité R2

Vérifié le 2026-10-07 dans la documentation officielle de R2 ([API S3](https://developers.cloudflare.com/r2/api/s3/api/), [URL présignées](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/)).

| Mécanisme                     | Opération S3 utilisée                                                                                                | État dans R2                                                                                                                                                         | Conséquence dans le code                                                                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Téléversement direct          | `PUT` présigné (`PutObject`), en-têtes signés                                                                        | `PUT` présigné pris en charge ; `POST` de formulaire avec policy non pris en charge ; un `Content-Type` différent du type signé est refusé (`SignatureDoesNotMatch`) | `PUT` présigné uniquement, `content-type` et `content-length` dans `X-Amz-SignedHeaders`. R2 ne documente pas explicitement le refus d'une taille différente : le worker rejette en plus un fichier dont la taille stockée diffère de la taille déclarée (`size_mismatch`). |
| Lecture d'un fichier privé    | `GET` présigné (`GetObject`)                                                                                         | Pris en charge sur le domaine S3 du compte, pas sur un domaine personnalisé ; durée de 1 seconde à 7 jours                                                           | URL signée sur `S3_ENDPOINT` (domaine S3 du compte), jamais sur `S3_PUBLIC_BASE_URL`. Les paramètres `response-content-*` ne sont pas documentés pour R2 : le port ne les utilise pas.                                                                                      |
| Lecture d'un fichier public   | Domaine personnalisé du bucket public                                                                                | Pris en charge, avec le cache de Cloudflare                                                                                                                          | `S3_PUBLIC_BASE_URL` pointe vers le domaine personnalisé.                                                                                                                                                                                                                   |
| Suppression                   | `DeleteObject`, un appel par clé (8 en parallèle)                                                                    | `DeleteObject` et `DeleteObjects` pris en charge ; aucun en-tête de somme de contrôle n'est documenté pour `DeleteObjects`                                           | Le SDK AWS impose une somme CRC32 (`x-amz-checksum-crc32`) sur `DeleteObjects`, opération à somme obligatoire : le port utilise `DeleteObject`, sans somme de contrôle, qui répond 204 pour une clé absente.                                                                |
| Écriture par le worker        | `PutObject` avec `Content-Type` et `Cache-Control`                                                                   | Pris en charge (métadonnées système)                                                                                                                                 | Le client S3 ne calcule de somme de contrôle que lorsqu'elle est obligatoire (`requestChecksumCalculation: 'WHEN_REQUIRED'`).                                                                                                                                               |
| Déplacement entre buckets     | `CopyObject` (source `x-amz-copy-source` dans l'autre bucket, `x-amz-metadata-directive: REPLACE`), puis suppression | Pris en charge, y compris d'un bucket à l'autre ; `Content-Type` et `Cache-Control` pris en charge                                                                   | Utilisé quand la visibilité d'une ressource change (ADR 0026) : copie avec les métadonnées du bucket cible, puis suppression de la source. Aucune somme de contrôle n'est envoyée (`x-amz-checksum-algorithm` non pris en charge par R2 sur `CopyObject`).                  |
| Lecture et existence (worker) | `GetObject`, `HeadObject`, `HeadBucket` (sonde de santé)                                                             | Pris en charge                                                                                                                                                       |                                                                                                                                                                                                                                                                             |
| CORS                          | Règles du bucket (tableau de bord ou `wrangler`)                                                                     | Pris en charge, y compris pour les URL présignées appelées depuis un navigateur                                                                                      | Configuration de production ci-dessous ; MinIO l'autorise par défaut en local.                                                                                                                                                                                              |

## Configuration de production

### Buckets

- Un bucket public (`S3_BUCKET_PUBLIC`) relié à un domaine personnalisé, par exemple `media.<domaine>` (domaine à fournir, voir `docs/open-questions.md`). L'accès public par l'URL `r2.dev` reste désactivé.
- Un bucket privé (`S3_BUCKET_PRIVATE`), sans domaine personnalisé ni accès public : quarantaine des téléversements et fichiers privés, lus seulement par URL présignée.
- Une même juridiction pour les deux buckets (la juridiction UE garde les données dans l'Union).

### Variables d'environnement

| Variable                                   | Valeur de production                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `S3_ENDPOINT`                              | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (ou `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` en juridiction UE) |
| `S3_REGION`                                | `auto`                                                                                                                    |
| `S3_FORCE_PATH_STYLE`                      | `false` (R2 accepte les deux styles d'adressage)                                                                          |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Jeton d'API R2 « Object Read & Write » limité aux deux buckets                                                            |
| `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`    | Noms des deux buckets                                                                                                     |
| `S3_PUBLIC_BASE_URL`                       | `https://media.<domaine>` (domaine personnalisé du bucket public)                                                         |

### Purge du CDN

Le domaine personnalisé du bucket public est servi par le cache de Cloudflare. Les fichiers publics sont mis en cache un an (`public, max-age=31536000, immutable`, clés dérivées de l'empreinte du contenu) ; un fichier qui quitte le bucket public est purgé par le worker (job `purge-cdn`, ADR 0026), par l'API de purge par URL ([Purge Cached Content](https://developers.cloudflare.com/api/resources/cache/methods/purge/), vérifié le 2026-10-08 : `POST /zones/{zone_id}/purge_cache` avec `files`, 100 URL par requête sur les offres Free, Pro et Business).

| Variable               | Valeur de production                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CDN_PURGE_PROVIDER`   | `cloudflare` (obligatoire en production)                                                                                           |
| `CLOUDFLARE_ZONE_ID`   | Identifiant de la zone du domaine personnalisé du bucket public                                                                    |
| `CLOUDFLARE_API_TOKEN` | Jeton d'API dédié au worker, permission « Zone > Cache Purge > Purge » sur cette seule zone, aucune autre permission ni autre zone |

Une réponse `success: true` signifie que Cloudflare a accepté la purge ; la confirmation se lit dans l'en-tête `CF-Cache-Status: MISS` d'une URL purgée.

### CORS

Bucket privé : le navigateur y envoie le fichier par `PUT` présigné et lit les fichiers privés par `GET` présigné.

```json
[
  {
    "AllowedOrigins": ["https://<domaine de l'application web>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Bucket public : lecture des images depuis l'application web (balises `img` sans CORS ; règle utile pour un `fetch` ou un `canvas`).

```json
[
  {
    "AllowedOrigins": ["https://<domaine de l'application web>"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": [],
    "MaxAgeSeconds": 86400
  }
]
```

Application : tableau de bord R2, bucket, Settings, CORS Policy, ou `npx wrangler r2 bucket cors set <bucket> --file cors.json`.

### Règle de cycle de vie recommandée

Sur le bucket privé, une règle qui supprime les objets du préfixe `quarantine/` après 2 jours, en filet de sécurité du nettoyage applicatif (le worker supprime l'original après traitement, et les téléversements jamais confirmés après `MEDIA_ORPHAN_TTL_HOURS`).

## Non vérifié

Aucun test ne s'exécute contre un vrai compte R2 ni contre l'API de Cloudflare (aucun compte n'est disponible ; la purge est vérifiée avec un adaptateur espion et l'adaptateur Cloudflare avec un `fetch` simulé) : la compatibilité repose sur la documentation ci-dessus et sur les tests d'intégration contre MinIO. À vérifier lors de la mise en production : un `PUT` présigné d'une taille différente de la taille signée doit être refusé par R2 ; à défaut, le contrôle `size_mismatch` du worker s'applique.
