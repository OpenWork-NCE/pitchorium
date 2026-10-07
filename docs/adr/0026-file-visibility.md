# 0026. Visibilité des fichiers

Statut : acceptée (2026-10-07). Tranche la question ouverte 35.

## Contexte

Les usages de fichiers avaient une visibilité fixe : les images (photo, couverture, images de publication et de projet) allaient dans le bucket public, servi par le CDN, et les documents dans le bucket privé. Or une publication peut être réservée aux membres ou aux connexions (§10.3), et un profil n'est public que par sa page publique, désactivée par défaut (ADR 0017). Une image dans le bucket public est lisible par quiconque obtient son URL, sans contrôle d'accès. La visibilité des PDF de pitch et des one-pagers restait à trancher (question ouverte 35).

## Décision

- Les PDF attachés à une publication ou à un projet (`post_document`, `project_document`) sont toujours privés : servis par URL présignée courte (`GET /v1/media/{mediaId}/download-url`), après le contrôle délégué au module propriétaire de la ressource (`MediaReadAuthorizer`). Leur miniature est une image privée.
- Les images suivent la visibilité de leur ressource : règle `resource` des usages `avatar`, `profile_cover` (le profil est public seulement par sa page publique), `post_image` (publication `public`) et `project_gallery` (projet publié, module projects). Le logo et la couverture d'une organisation restent publics (page publique par défaut, ADR 0025) ; les pièces jointes de message et les pièces justificatives restent privées.
- Une image d'usage `resource` est traitée dans le bucket privé. Le module propriétaire donne la visibilité de la ressource à l'attachement (`attach({ resourceVisibility })`) et à chaque changement (`setResourceVisibility(resource, visibility)`). La façade enregistre le bucket cible (`target_visibility`) dans la transaction de l'appelant et émet l'événement interne `media.asset.visibility-requested.v1`.
- Le worker déplace les fichiers (job `move`) : copie côté serveur vers l'autre bucket avec les métadonnées du bucket cible, hors transaction (ADR 0019) ; transaction courte qui bascule le bucket seulement si la cible n'a pas changé entre-temps ; suppression de la source, ou des copies si la demande a été annulée. Jusqu'à la bascule, les fichiers restent servis depuis la source. Le job est idempotent.
- `MediaFacade.images()` donne l'URL publique d'un fichier public et une URL présignée de 10 minutes (`PRIVATE_IMAGE_URL_TTL_SECONDS`) pour un fichier privé : le module appelant ne demande que les images des ressources visibles par le lecteur. La signature est datée du début d'une fenêtre de 5 minutes : la même URL est renvoyée pendant la fenêtre, et le navigateur peut la garder en cache.
- En-têtes de cache : un fichier d'usage toujours public garde `public, max-age=31536000, immutable` ; un fichier public d'usage `resource` est servi avec `public, max-age=3600`, car il peut redevenir privé ; un fichier privé avec `private, no-store`.

## Conséquences

- Une image d'une publication réservée aux membres n'est jamais lisible sans session : son URL présignée expire en 10 minutes au plus.
- Un fichier redevenu privé peut rester dans le cache du CDN une heure au plus après son déplacement ; une purge par l'API de Cloudflare (jeton de zone) n'est pas implémentée.
- Les URL présignées ne profitent pas du cache du CDN : chaque lecture d'une image privée est servie par le stockage.
- Le module propriétaire d'une ressource doit appeler `setResourceVisibility` à chaque changement de visibilité ; un oubli laisse les fichiers dans l'ancien bucket.
- Les images publiques attachées avant cette décision restent dans le bucket public jusqu'au prochain changement de visibilité de leur ressource (aucune donnée de production à ce jour).
