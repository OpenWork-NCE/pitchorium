# 0074. Export et suppression des données personnelles

Statut : acceptée (2026-10-08).

## Contexte

Le RGPD donne au membre un droit d'accès et de portabilité (articles 15 et 20) et un droit à l'effacement (article 17) ; le cahier des charges demande l'export et la suppression de compte (§13). Les données d'un membre sont réparties dans une vingtaine de schémas, chacun propriété de son module ; certaines doivent être conservées (paiements, preuves), d'autres sont partagées (un projet financé par d'autres, une conversation).

## Décision

- Chaque module qui détient des données personnelles implémente deux contrats, un exportateur et un effaceur, et les enregistre auprès du module privacy au démarrage : privacy ne lit ni n'écrit aucune table d'un autre module et ne dépend d'aucun d'eux. Un test d'architecture vérifie que tout module aux colonnes personnelles s'est enregistré.
- Export asynchrone : archive ZIP écrite en flux par le worker, un JSON documenté par module et les fichiers, stockée dans le bucket privé, lue par un lien court, supprimée après 72 heures ; une demande par 24 heures.
- Suppression après un délai de grâce annulable (30 jours, provisoire), exécutée par le worker dans un ordre fixé (le compte en dernier), un effaceur par transaction, la progression enregistrée : l'exécution est idempotente et reprend après un arrêt. Les blocages (campagne en financement, seul propriétaire d'une organisation qui a d'autres membres) refusent la demande avec un code stable et sont vérifiés à nouveau à l'exécution.
- Les données que la loi ou la preuve imposent de garder sont pseudonymisées par un identifiant aléatoire propre à la suppression (ADR 0075).
- Contrôle automatique après exécution : l'identifiant et l'email sont recherchés dans toutes les colonnes de tous les schémas ; seules quelques tables techniques à courte durée de vie sont admises. Un résidu fait échouer la demande, visible des administrateurs.

## Conséquences

- Un nouveau module à données personnelles doit enregistrer ses contrats, sinon le test d'architecture échoue.
- Le contrôle de résidus parcourt toute la base : coûteux, il ne s'exécute qu'une fois par suppression.
- Les copies hors base (Redis, sauvegardes, journaux) suivent leurs propres durées de vie, documentées dans `docs/compliance/retention.md`.
