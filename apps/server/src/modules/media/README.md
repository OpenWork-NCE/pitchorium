# Module media

Fichiers et leurs métadonnées (cahier des charges §10.1, §10.3, §11.1, §13) : photos de profil et de couverture, logos et couvertures d'organisation, images et documents de publication, galerie, documents et images d'actualité de projet, pièces d'une manifestation d'intérêt, pièces jointes de message, pièces justificatives (vérification d'organisation, KYC des porteurs et contributions hors plateforme, module payments). Les autres modules ne manipulent qu'un `mediaId`, par la façade. Pas d'hébergement vidéo (ADR 0024).

## Cycle de vie (ADR 0022)

1. `POST /v1/media/uploads` : usage, type et taille déclarés. Contrôles : type et taille de l'usage, limite de demandes par heure (`MEDIA_UPLOAD_REQUESTS_PER_HOUR`), quota du membre (`MEDIA_QUOTA_MAX_FILES`, `MEDIA_QUOTA_MAX_BYTES`, sous verrou par membre). Création d'un actif `pending` et d'une URL `PUT` présignée vers `quarantine/<mediaId>` du bucket privé ; le type et la taille exacte font partie de la signature.
2. Le client envoie le fichier directement au stockage, puis `POST /v1/media/{mediaId}/confirm` (idempotent) : statut `processing` et événement interne `media.asset.uploaded.v1`, qui met en file le job `process` (file `media.processing`).
3. Traitement par le worker, hors transaction (ADR 0019), idempotent :
   - lecture plafonnée à la taille maximale de l'usage ;
   - antivirus ClamAV (ADR 0023) ;
   - type réel lu dans les octets magiques (`file-type`) : il doit être autorisé et égal au type déclaré ;
   - images (`sharp`) : décodage complet, dimensions minimales et maximales de l'usage, orientation EXIF appliquée aux pixels, aucune métadonnée conservée (EXIF, GPS), variantes de l'usage en WebP et AVIF ;
   - PDF (`pdfjs-dist`) : structure et arbre des pages, nombre de pages maximal, miniature de la première page en WebP et AVIF ; le PDF lui-même est conservé ;
   - résultat : `ready` ou `rejected` avec un motif stable, dans une transaction courte avec son événement ; les fichiers produits vont dans le bucket public ou privé selon la visibilité de l'usage, sous des clés dérivées de l'identifiant et d'une empreinte SHA-256 du contenu (`media/<mediaId>/<variante>-<empreinte>.webp`) ; l'original en quarantaine est supprimé. Un échec au dernier essai rejette avec `processing_failed`.
4. Attachement à une ressource par la façade (`attach`, `detach`), dans la limite par ressource de l'usage. Un actif non attaché depuis `MEDIA_ORPHAN_TTL_HOURS` (jamais confirmé, rejeté, jamais attaché ou détaché) est supprimé par la tâche `delete-orphans` (toutes les 30 minutes).
5. Suppression logique (`DELETE /v1/media/{mediaId}` sur un actif non attaché, ou nettoyage), puis physique par la tâche `purge-deleted` (toutes les 5 minutes).

Motifs de rejet : `upload_missing`, `type_not_allowed`, `type_mismatch`, `size_exceeded`, `size_mismatch` (taille stockée différente de la taille déclarée), `malware_detected`, `image_unreadable`, `image_too_small`, `image_too_large`, `pdf_unreadable`, `pdf_too_many_pages`, `import_failed`, `processing_failed`.

## Usages (`domain/usages.ts`, valeurs provisoires)

| Usage                       | Types                | Taille max | Dimensions (min / max) | Pages max | Par ressource | Visibilité | Variantes                                         |
| --------------------------- | -------------------- | ---------- | ---------------------- | --------- | ------------- | ---------- | ------------------------------------------------- |
| `avatar`                    | JPEG, PNG, WebP      | 5 Mo       | 200x200 / 8000x8000    |           | 1             | ressource  | `large` 400x400, `small` 128x128 (recadrées)      |
| `profile_cover`             | JPEG, PNG, WebP      | 8 Mo       | 1200x300 / 10000x10000 |           | 1             | ressource  | `large` 1584x396, `small` 792x198 (recadrées)     |
| `organization_logo`         | JPEG, PNG, WebP      | 5 Mo       | 200x200 / 8000x8000    |           | 1             | public     | `large` 400x400, `small` 128x128 (sans recadrage) |
| `organization_cover`        | JPEG, PNG, WebP      | 8 Mo       | 1200x300 / 10000x10000 |           | 1             | public     | comme `profile_cover`                             |
| `post_image`                | JPEG, PNG, WebP      | 10 Mo      | 200x200 / 10000x10000  |           | 9             | ressource  | `large` 1600, `medium` 800 de large               |
| `post_document`             | PDF                  | 20 Mo      |                        | 50        | 5             | privé      | miniature `thumbnail` 800 de large                |
| `project_gallery`           | JPEG, PNG, WebP      | 10 Mo      | 600x400 / 10000x10000  |           | 20            | ressource  | `large`, `medium`, `thumbnail` 400x300            |
| `project_document`          | PDF                  | 20 Mo      |                        | 50        | 10            | privé      | miniature                                         |
| `project_update_image`      | JPEG, PNG, WebP      | 10 Mo      | 200x200 / 10000x10000  |           | 6             | ressource  | `large` 1600, `medium` 800 de large               |
| `project_interest_document` | PDF                  | 20 Mo      |                        | 50        | 3             | privé      | miniature                                         |
| `message_attachment`        | JPEG, PNG, WebP, PDF | 10 Mo      | 1x1 / 10000x10000      | 50        | 5             | privé      | `large` 1600, `thumbnail` 400 ; miniature (PDF)   |
| `verification_document`     | JPEG, PNG, PDF       | 10 Mo      | 600x600 / 10000x10000  | 100       | 10            | privé      | `large` 2000 ; miniature (PDF)                    |
| `link_preview`              | JPEG, PNG, WebP      | 5 Mo       | 100x100 / 10000x10000  |           | 1             | ressource  | `large` 1200, `small` 400 de large                |

`GET /v1/media/usages` publie ces limites. Les SVG, GIF et HEIC ne sont pas acceptés.

Visibilité (ADR 0026) : `public` et `privé` sont fixes ; `ressource` signifie que les fichiers sont publics seulement tant que la ressource à laquelle ils sont attachés est publique (profil avec page publique, publication `public`, projet publié). Les documents PDF sont toujours privés.

## Accès

- Fichiers publics : URL sous `S3_PUBLIC_BASE_URL` (domaine CDN), `Cache-Control: public, max-age=31536000, immutable` (clés dérivées de l'empreinte du contenu). Un fichier qui quitte le bucket public (ressource devenue privée, actif supprimé) est purgé du CDN par le job `purge-cdn` (port `CdnCache`, Cloudflare en production, ADR 0026).
- Images privées affichées par un autre module : `images()` de la façade renvoie des URL présignées de 10 minutes, identiques pendant une fenêtre de 5 minutes (cache du navigateur) ; le module appelant ne les demande que pour les ressources visibles par le lecteur.
- Déplacement entre buckets : à l'attachement (`resourceVisibility`) et à chaque changement de visibilité de la ressource (`setResourceVisibility`), la façade enregistre le bucket cible et émet `media.asset.visibility-requested.v1` ; le worker copie les fichiers (job `move`), bascule le bucket dans une transaction courte si la cible n'a pas changé, puis supprime la source. La purge d'un actif supprimé vide les deux buckets.
- Fichiers privés : `GET /v1/media/{mediaId}/download-url` (action `media.read`) renvoie une URL présignée de lecture valable `MEDIA_DOWNLOAD_URL_TTL_SECONDS`, au propriétaire ou à un membre que le module propriétaire de la ressource autorise (`MediaReadAuthorizer` enregistré par `registerReadAuthorizer`) ; sinon 404, comme pour un fichier inexistant.
- Modération : `moderation_status` (`none`, `flagged`, `removed`) modifiable par `setModerationStatus` ; un fichier `removed` n'est plus servi.

## Import d'une image de lien

Usage `link_preview` : le module content demande l'import (`requestImport`) de l'image Open Graph d'un lien publié ; le worker la télécharge par le client HTTP protégé contre le SSRF (`platform/outbound`, ADR 0033 : http et https, ports par défaut, adresses publiques seulement après résolution DNS, 3 redirections au plus, délai `MEDIA_IMPORT_TIMEOUT_MS`, taille maximale de l'usage), puis applique le même traitement qu'à un téléversement. Les lecteurs ne chargent jamais l'image depuis le site tiers.

## Import d'une photo de fournisseur OAuth

`requestImport` crée un actif `pending` de source `import` et émet `media.asset.requested.v1` ; le worker télécharge l'image (https, hôtes Google et LinkedIn listés dans `PROVIDER_PHOTO_HOSTS`, sans redirection, délai `MEDIA_IMPORT_TIMEOUT_MS`, taille maximale de l'usage) puis applique le même traitement. Un refus rejette avec `import_failed`.

## Routes

- `GET /v1/media/usages` (public)
- `POST /v1/media/uploads` (`media.upload`, `Idempotency-Key`)
- `POST /v1/media/{mediaId}/confirm` (`media.upload`)
- `GET /v1/media/{mediaId}` (`media.read`, propriétaire)
- `GET /v1/media/{mediaId}/download-url?variant=` (`media.read`)
- `DELETE /v1/media/{mediaId}` (`media.delete`, propriétaire, actif non attaché)

## Schéma `media`

`assets` : propriétaire, usage, source (`upload`, `import`), statut, visibilité, type et taille déclarés puis réels, empreinte, dimensions ou pages, clés stockées (`files`), motif de rejet, statut de modération, ressource attachée (type et identifiant d'un autre module, sans clé étrangère), dates.

## Façade publique (`index.ts`)

`MediaFacade` : `attach` (avec `resourceVisibility`), `detach`, `describe` (propriétaire, usage, statut, ressource, nombre de pages d'un PDF), `images` (URL publiques ou présignées par identifiant), `setResourceVisibility`, `setModerationStatus`, `requestImport`, `registerReadAuthorizer` ; types `MediaReadAuthorizer`, `MediaImage`, `MediaResourceRef` ; classes d'événements.

## Événements émis

| Type                                  | Payload                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `media.asset.requested.v1`            | `usage`, `source`, `ownerId`                                            |
| `media.asset.uploaded.v1`             | `usage` (interne : déclenche le job)                                    |
| `media.asset.visibility-requested.v1` | `visibility` (interne : déclenche le job `move`)                        |
| `media.asset.cdn-purge-requested.v1`  | `keys`, `reason` (`unpublished`, `deleted`) (interne : job `purge-cdn`) |
| `media.asset.ready.v1`                | `usage`, `source`, `ownerId`                                            |
| `media.asset.rejected.v1`             | `usage`, `source`, `ownerId`, `reason`                                  |
| `media.asset.deleted.v1`              | `usage`, `ownerId`, `reason` (`owner_request`, `orphan_cleanup`)        |

## Événements consommés

`media.asset.uploaded.v1`, `media.asset.requested.v1` (source `import`) : mise en file du traitement ; `media.asset.visibility-requested.v1` : mise en file du déplacement ; `media.asset.cdn-purge-requested.v1` : mise en file de la purge du CDN (handler `media.queue-processing`).

## Dépendances

Aucun module métier. Les modules propriétaires de ressources appellent la façade et enregistrent leurs autorisations de lecture.
