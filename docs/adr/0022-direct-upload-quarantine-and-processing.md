# 0022. Téléversement direct, quarantaine et traitement des fichiers

Statut : acceptée (2026-10-07)

## Contexte

Les membres envoient des photos, des couvertures, des logos, des images de publication et de projet, des PDF (pitch, one-pager) et des pièces justificatives. Un fichier envoyé par un client peut mentir sur son type, porter un virus, révéler la position de l'auteur (EXIF GPS) ou viser une faille d'un décodeur. Faire transiter les binaires par l'api occuperait ses processus et sa bande passante.

## Décision

- Le binaire ne passe jamais par l'api : elle délivre une URL `PUT` présignée vers `quarantine/<mediaId>` du bucket privé, dont la signature contient le type déclaré et la taille exacte (en-têtes signés `content-type` et `content-length`). Un `PUT` d'un autre type ou d'une autre taille est refusé par le stockage. R2 ne gérant pas les formulaires `POST` présignés (`content-length-range`), la taille est imposée exactement.
- La confirmation par le client émet un événement interne (`media.asset.uploaded.v1`) ; son handler met en file un job BullMQ dédié (`media.processing`), pour que le traitement ne s'exécute pas dans la transaction d'inbox du handler (ADR 0019).
- Le worker ne croit jamais le type déclaré : lecture plafonnée, antivirus (ADR 0023), type réel par les octets magiques, puis traitement selon le type. Les images sont décodées entièrement et ré-encodées à partir des pixels (aucune métadonnée conservée, orientation appliquée), en WebP et AVIF : mesuré à environ 70 ms pour deux variantes WebP et 310 ms pour deux variantes AVIF d'une image de 3000x2000, un coût acceptable dans le worker. Les PDF sont analysés par pdf.js (aucun script exécuté, délai de 30 s) et leur première page rendue en miniature.
- Clés de stockage dérivées de l'actif et d'une empreinte SHA-256 du contenu : un contenu ne change jamais sous une clé, les fichiers publics sont servis avec `Cache-Control: public, max-age=31536000, immutable`.
- Limites centralisées par usage dans `modules/media/domain/usages.ts` (types, taille, dimensions, pages, nombre par ressource, visibilité, variantes), publiées par `GET /v1/media/usages`.
- Statuts `pending`, `processing`, `ready`, `rejected`, `deleted` ; motifs de rejet stables. Suppression logique, puis purge des objets par une tâche planifiée ; un actif non attaché après `MEDIA_ORPHAN_TTL_HOURS` est supprimé.
- Les autres modules ne manipulent qu'un identifiant et passent par `MediaFacade` (`attach`, `detach`, `images`) ; la lecture d'un fichier privé est déléguée au module propriétaire de la ressource (`MediaReadAuthorizer`).

## Conséquences

- Le frontend enchaîne trois appels (demande, `PUT`, confirmation) puis suit le statut ; un fichier n'est utilisable qu'une fois `ready`.
- Le bucket privé doit autoriser le `PUT` depuis l'origine de l'application web (règle CORS de R2 en production ; MinIO l'autorise par défaut en local).
- Les originaux des images ne sont pas conservés, seulement leurs variantes : un changement de variantes demandera de redemander le fichier.
- Les GIF animés, SVG, HEIC et vidéos sont refusés.
