# Module content

Fil d'actualité (cahier des charges §10.3) : publications, repartages, mentions, aperçus de liens, réactions, commentaires, enregistrements, masquage, statistiques de visibilité et fil composé à la lecture. Le signalement relève du module trust, le transfert en message du module messaging, la traduction à la demande du module localization.

## Publications (ADR 0031)

- Texte de 3 000 caractères, jusqu'à 9 images (usage media `post_image`) ou un document PDF (`post_document`), un lien http ou https avec aperçu ; au moins l'un des quatre.
- Texte alternatif de chaque image (accessibilité, WCAG 1.1.1), écrit par l'auteur : `images: [{ mediaId, alt }]` à la création, 1 000 caractères au plus (`POST_IMAGE_ALT_MAX_LENGTH`), lu dans `images[].alt` (`null` sans texte) et modifié par `imageAlts` (`PATCH`, une image absente de la publication répond `CONTENT_MEDIA_NOT_IN_POST`) ; un changement de texte alternatif ne marque pas la publication « modifiée ». Titre du document (`documentTitle`, 200 caractères, le nom du fichier par défaut côté web), lu dans `document.title` et modifiable.
- Visibilité `public`, `members` (défaut) ou `connections`. `public` exige la page publique de l'auteur ; si l'auteur la désactive, ses publications publiques sont lues comme `members` immédiatement, puis réécrites `members` par le worker (handler de `profiles.profile.visibility-changed.v1`) et leurs fichiers rendus privés. Réactiver la page ne rétablit rien.
- Publication au nom d'une organisation par un `owner` ou un `admin` (`organizationId`) : `public` ou `members` ; elle apparaît dans le fil des abonnés de l'organisation.
- Fichiers (ADR 0026) : images dans le bucket public seulement pour une publication `public`, URL présignées sinon ; document toujours privé, lu par `GET /v1/media/{mediaId}/download-url` par qui peut voir la publication (`MediaReadAuthorizer` du type de ressource `post`).
- Mentions `@identifiant` d'un membre ou `@slug` d'une organisation (membre d'abord en cas d'homonymie), 20 au plus, résolues en identifiants stables à l'écriture et affichées avec l'identifiant et le nom actuels ; un membre de part et d'autre d'un blocage est inconnu de l'auteur et de ses lecteurs (ADR 0029) : son jeton reste du texte et sa mention n'est pas affichée.
- Langue déclarée par l'auteur (ISO 639-1), sinon détectée (`franc-min`, 10 caractères au moins, sans le wolof), sinon `undetermined` ; stockée pour la traduction à la demande.
- Rattachement à un projet (`projectId`) validé par le module projects (`registerProjectLinkValidator`) : seule l'équipe d'un projet publié y rattache une publication (`CONTENT_PROJECT_NOT_FOUND` sinon). La page du projet liste ses publications par la façade (`projectPosts`), selon ce que le lecteur peut voir.
- Modification du texte, de la visibilité, de la langue (horodatage `editedAt` visible), de l'option de commentaires, des textes alternatifs ou du titre du document (l'option de commentaires et les textes alternatifs ne marquent pas `editedAt`) ; suppression logique par l'auteur, les fichiers sont détachés puis supprimés par le nettoyage des orphelins.
- Repartage avec commentaire facultatif : le repartage d'un repartage vise l'original ; un repartage n'élargit jamais l'audience de l'original (`public` : toute visibilité ; `members` : `members` ou `connections` ; `connections` : par son auteur seulement). L'original invisible pour le lecteur donne `repostOf: null`.

## Aperçus de liens (ADR 0033)

À la création, l'aperçu est `pending` ; le worker (job `link-preview`, file `content.processing`) lit la page par le client protégé contre le SSRF (`platform/outbound` : http et https, ports par défaut, adresses publiques vérifiées après résolution DNS et connexion à l'adresse vérifiée, 3 redirections vérifiées, `CONTENT_LINK_PREVIEW_TIMEOUT_MS`, `CONTENT_LINK_PREVIEW_MAX_BYTES`, `text/html` seulement), extrait titre, description et site des balises Open Graph (repli sur `<title>` et `description`), puis confie l'image au module media (usage `link_preview`) : les lecteurs ne chargent jamais l'image depuis le site tiers. Un refus donne `failed` ; le lien reste affiché.

## Réactions, commentaires, enregistrements

- Réactions `like`, `bravo`, `insightful`, `support` (J'aime, Bravo, Pertinent, Soutien) sur les publications et les commentaires, une par membre et par cible, modifiable ; compteurs par type agrégés à la lecture.
- Commentaires de 1 250 caractères (provisoire) et réponses sur un seul niveau (`CONTENT_REPLY_DEPTH` pour une réponse à une réponse) ; email vérifié exigé ; modification par l'auteur, suppression par l'auteur ou par l'auteur de la publication ; l'auteur peut désactiver les commentaires.
- Enregistrer une publication (liste paginée `GET /v1/me/saved-posts`), la masquer de son propre fil.
- Blocage (ADR 0029) : un membre bloqué de part et d'autre ne voit ni les publications ni les commentaires de l'autre, et ne peut ni commenter, ni réagir (404 comme pour une publication inconnue), ni mentionner l'autre (texte simple).

## Fil (ADR 0032)

- Fan-out à la lecture : publications et repartages des membres suivis (les connexions créent un suivi mutuel) et du lecteur, publications des organisations suivies, du plus récent au plus ancien, pagination par curseur ; filtres de visibilité, blocages, publications masquées et modération.
- Complément éditorial : si le réseau produit moins de `CONTENT_FEED_EDITORIAL_THRESHOLD` publications (10, provisoire), le fil continue avec les publications mises en avant par un `moderator` ou un `admin` (`public` ou `members`, hors réseau du lecteur), puis avec au plus `FEED_SUGGESTIONS_MAX` (10, provisoire) suggestions expliquées du module discovery (éléments `suggestion`, source enregistrée par `registerFeedSuggestionSource`, curseur par rang). Jamais de fil mondial anonyme.
- Actualités des projets suivis : éléments `project_update`, fournis par le module projects (`registerProjectUpdatesFeedSource`) et fusionnés avec les publications du réseau, du plus récent au plus ancien.
- Événements des organisateurs suivis (membres et organisations) : éléments `event`, fournis par le module events (`registerEventsFeedSource`) et fusionnés de même ; le constat « réseau trop maigre » les compte aussi.
- Contrat versionné (`schemaVersion: 1`) et polymorphe : éléments `post`, `repost`, `featured`, `project_update`, `event` et `suggestion` (ajoutés sans changer de version : le client ignore un type inconnu) ; `project` reste réservé au module projects.

## Statistiques (ADR 0034)

Chaque lecture d'une publication par un autre membre (fil ou page) ajoute le lecteur à un HyperLogLog Redis par publication et par jour ; la tâche `consolidate-post-views` (toutes les 10 minutes) écrit les comptes d'aujourd'hui et d'hier dans `post_daily_views`. Lecture par l'auteur seulement (`GET /v1/posts/{postId}/stats`).

## Modération

`moderation_status` (`visible`, `hidden`, `removed`) des publications et des commentaires, modifiable par la façade pour le module trust ; une publication `hidden` reste visible de son auteur seulement. Mise en avant éditoriale par l'interface unique de l'administration (`PUT|DELETE /v1/admin/highlights/post/{postId}`, `moderator` ou `admin` avec double authentification, journal d'audit), par `ContentFacade.setPostFeatured`.

## Routes

- `GET /v1/feed` (`content.feed.read`)
- `POST /v1/posts` (`content.post.create`, `Idempotency-Key`), `GET /v1/posts/{postId}` (`content.post.read`), `GET /v1/public/posts/{postId}` (public, `Cache-Control: public, max-age=60`)
- `PATCH /v1/posts/{postId}` (`content.post.update`), `DELETE /v1/posts/{postId}` (`content.post.delete`) : auteur (`PostResolver` ; une publication que le membre ne peut pas lire répond `404`, comme une absente, `test/integration/idor.spec.ts`)
- `POST /v1/posts/{postId}/reposts` (`content.post.repost`, `Idempotency-Key`)
- `PUT|DELETE /v1/posts/{postId}/reaction`, `PUT|DELETE /v1/comments/{commentId}/reaction` (`content.reaction.set`)
- `POST /v1/posts/{postId}/comments` (`content.comment.create`, `Idempotency-Key`), `GET /v1/posts/{postId}/comments`, `GET /v1/comments/{commentId}/replies` (`content.post.read`), `PATCH /v1/comments/{commentId}` (`content.comment.update`, auteur), `DELETE /v1/comments/{commentId}` (`content.comment.delete`, auteur du commentaire ou de la publication, `CommentResolver`)
- `PUT|DELETE /v1/posts/{postId}/save`, `GET /v1/me/saved-posts` (`content.post.save`), `PUT|DELETE /v1/posts/{postId}/hide` (`content.post.hide`)
- `GET /v1/posts/{postId}/stats` (`content.post.stats.read`, auteur)

## Schéma `content`

`posts` (textes alternatifs des images par identifiant de média, titre du document ; index partiels du fil par membre et par organisation, des mises en avant, des repartages, de l'image d'aperçu, des publications d'un projet), `post_mentions`, `comments` (index des commentaires de premier niveau et des réponses), `reactions` (clé : cible et membre), `saved_posts`, `hidden_posts`, `post_daily_views`.

## Façade publique (`index.ts`)

`ContentFacade` : `setPostModerationStatus`, `setCommentModerationStatus`, `registerProjectLinkValidator`, `registerProjectUpdatesFeedSource`, `registerEventsFeedSource`, `registerFeedSuggestionSource`, `projectPosts`, `visiblePosts` (publications telles qu'un lecteur les voit, pour une publication partagée en message), `postAuthorId`, `commentAuthorId`, `commentPostId` ; interfaces `ProjectLinkValidator`, `ProjectUpdatesFeedSource`, `EventsFeedSource`, `FeedSuggestionSource`, type `FeedEntry` ; classes d'événements.

## Événements émis

| Type                          | Agrégat     | Payload                                                          |
| ----------------------------- | ----------- | ---------------------------------------------------------------- |
| `content.post.created.v1`     | publication | `authorId`, `organizationId`, `visibility`, `hasLink`            |
| `content.post.updated.v1`     | publication | `authorId`, `fields`                                             |
| `content.post.deleted.v1`     | publication | `authorId`                                                       |
| `content.post.reposted.v1`    | repartage   | `authorId`, `repostOfId`, `originalAuthorId`                     |
| `content.mention.created.v1`  | publication | `authorId`, `targetType`, `targetId`                             |
| `content.reaction.added.v1`   | cible       | `userId`, `targetType`, `targetAuthorId`, `reaction`             |
| `content.reaction.changed.v1` | cible       | `userId`, `targetType`, `targetAuthorId`, `reaction`, `previous` |
| `content.reaction.removed.v1` | cible       | `userId`, `targetType`, `targetAuthorId`, `previous`             |
| `content.comment.created.v1`  | commentaire | `postId`, `authorId`, `parentId`, `postAuthorId`                 |
| `content.comment.updated.v1`  | commentaire | `postId`, `authorId`, `parentId`, `postAuthorId`                 |
| `content.comment.deleted.v1`  | commentaire | `postId`, `authorId`, `parentId`, `postAuthorId`, `deletedBy`    |

Un repartage émet `content.post.reposted.v1` (pas `content.post.created.v1`). Destinés aux notifications (étape ultérieure).

## Événements consommés

- `content.post.created.v1` avec lien : mise en file de l'aperçu (handler `content.queue-link-preview`).
- `media.asset.ready.v1` et `media.asset.rejected.v1` (usage `link_preview`) : attachement de l'image d'aperçu ou abandon (handler `content.link-preview-image`).
- `profiles.profile.visibility-changed.v1` (page publique désactivée) : retrait des publications publiques (handler `content.withdraw-public-posts`).

## Dépendances

identity (indirectement, par le garde d'access), profiles (cartes, page publique, identifiants des mentions), organizations (rôle de l'auteur, cartes, slugs des mentions), network (suivis, connexions, blocages), media (images, document, aperçu, autorisation de lecture), projects (rattachement et actualités du fil, par enregistrement : content ne dépend pas de projects).

## Données personnelles (RGPD)

Export : publications et repartages, commentaires, réactions, publications enregistrées et masquées. Suppression : réactions, enregistrements, masquages et mentions supprimés ; publications supprimées avec leurs commentaires (les repartages d'autres membres perdent le lien) ; un commentaire auquel d'autres ont répondu devient une pierre tombale vide sous le pseudonyme ; les fichiers suivent l'effaceur de media. Contrats enregistrés auprès du module privacy (`infrastructure/content-personal-data.ts`, ADR 0074).
