# 0027. Modèle de suivi générique

Statut : acceptée (2026-10-07)

## Contexte

On suit un membre ou une organisation (§10.2), et bientôt un projet (§10.5 « actualité de campagne suivie », module projects). Le module network ne doit dépendre ni d'organizations ni de projects, et l'ajout d'un type de cible ne doit pas demander de migration de structure.

## Décision

- Une seule table `network.follows` : abonné, `target_type` (texte), `target_id` (UUID), origine, date. Clé primaire sur les trois premiers.
- Registre de types (`FollowTargetRegistry`) : chaque module propriétaire enregistre au démarrage un `FollowTargetType` par la façade de network (`registerFollowTargetType`) : `resolve(clé publique)` valide la cible par sa propre façade, `describe(ids)` donne le nom, le sous-titre et l'image. network enregistre `member`, organizations enregistre `organization`, projects enregistrera `project`.
- L'API adresse une cible par `{targetType}/{targetKey}` (identifiant public d'un membre, identifiant d'une organisation) ; un type non enregistré répond 404 comme une cible inconnue. Le type est une chaîne contrôlée par un motif dans le contrat, pas une énumération : un nouveau type ne casse pas le client généré.
- Les règles propres aux membres (soi-même, blocages) sont appliquées par network pour le type `member`.

## Conséquences

- organizations dépend de network (enregistrement), network ne dépend d'aucun module propriétaire de cible : le graphe reste acyclique.
- Pas de clé étrangère vers la cible : une cible supprimée disparaît des listes (non décrite) ; son module pourra purger ses suivis par un événement.
- Le fil (content) lit les identifiants suivis par type (`followedIds`).
