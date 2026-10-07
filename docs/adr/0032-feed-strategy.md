# 0032. Stratégie du fil

Statut : acceptée (2026-10-07), complétée le 2026-10-08 (actualités de projet)

## Contexte

Le fil montre d'abord le réseau du membre, puis une découverte éditorialisée si le réseau est vide, jamais un fil mondial anonyme (§10.3). Au lancement, le nombre de membres et de suivis par membre est modeste ; il faut une stratégie simple, correcte (visibilité, blocages, masquage, modération appliqués à la lecture) et un chemin d'évolution.

## Décision

- Fan-out à la lecture. Les suivis viennent de network (membres et organisations, le lecteur inclus) ; pour chaque auteur suivi, une sous-requête `LATERAL` lit au plus `limit` publications par l'index partiel `posts_member_feed_idx (author_id, created_at, id) WHERE deleted_at IS NULL AND organization_id IS NULL` (idem pour les organisations), puis les résultats sont fusionnés et coupés. Le coût est borné par le nombre d'auteurs suivis multiplié par la taille de page, quel que soit le volume de la table. Les filtres (modération, `connections` réservé aux connexions du lecteur, blocages, publications masquées) sont appliqués dans la sous-requête.
- Actualités de projet (complément du 2026-10-08) : le module projects enregistre auprès de content une source (`ProjectUpdatesFeedSource`) qui donne, pour le lecteur, les actualités visibles des projets qu'il suit, les plus récentes d'abord, avant la position du curseur. La phase `network` fusionne ces actualités et les publications sur la même clé (date, identifiant) ; le constat « réseau trop maigre » les compte aussi. content ne lit aucune table de projects.
- Pagination par curseur opaque (date, identifiant), qui porte aussi la phase (`network`, puis `featured`) et le constat « réseau trop maigre » fait à la première page.
- Complément éditorial : si le réseau compte moins de `CONTENT_FEED_EDITORIAL_THRESHOLD` publications (10, provisoire), le fil continue, après les publications du réseau, avec les mises en avant (`featured_at`, index partiel) `public` ou `members`, hors réseau du lecteur.
- Contrat polymorphe versionné : `schemaVersion: 1`, éléments `post`, `repost`, `featured` et `project_update` (ajouté le 2026-10-08) ; types réservés `project`, `suggestion`. Un client ignore un type inconnu, ce qui permet aux modules projects et discovery d'en ajouter sans rupture ; un changement incompatible d'un type existant incrémente `schemaVersion`.
- Mesure (test d'intégration `feed-volume.spec.ts`, PostgreSQL 17 en conteneur, 1 000 membres, 50 000 publications, lecteur suivant 200 membres) : la requête du fil n'utilise que `posts_member_feed_idx` (aucun parcours séquentiel de `posts`, vérifié par `EXPLAIN`), environ 2 ms d'exécution ; `GET /v1/feed` répond en 10 ms en médiane sur un poste de développement, avec un plafond de 500 ms vérifié en CI.

## Chemin d'évolution

Passer à un fan-out à l'écriture (table `feed_entries` par lecteur, alimentée par un handler de `content.post.created.v1`) ou hybride (écriture pour les auteurs ordinaires, lecture pour les auteurs très suivis) quand l'un de ces seuils est atteint :

- p95 de `GET /v1/feed` au-delà de 200 ms en production ;
- lecteurs suivant plus de 2 000 auteurs actifs (le coût de la lecture croît avec le nombre d'auteurs suivis) ;
- plus de 50 lectures de fil par seconde soutenues sur la base principale (une réplique en lecture est la première étape).

Le contrat de l'API ne change pas : seule la source des identifiants de la page change.

## Conséquences

- Aucune écriture supplémentaire à la publication ; un suivi, un blocage ou un masquage prend effet à la lecture suivante.
- Les compteurs (réactions, commentaires, repartages) sont agrégés à la lecture pour la page affichée (20 publications), sans compteur dénormalisé.
