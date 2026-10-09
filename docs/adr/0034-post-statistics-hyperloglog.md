# 0034. Statistiques de visibilité par HyperLogLog

Statut : acceptée (2026-10-07)

## Contexte

L'auteur d'une publication voit le nombre de membres uniques qui l'ont vue, par jour (§6.3, §14 « statistiques de vues »). Compter exactement demanderait une écriture par lecture et par publication affichée (20 par page de fil) et une table de paires (membre, publication, jour) qui croît sans limite.

## Décision

- Redis HyperLogLog : à chaque vue d'une publication par un autre membre (signalée par le navigateur, ou page ouverte, ADR 0116), `PFADD content:post-views:<jour>:<publication> <membre>`, dans un pipeline sans attente ; un ensemble par jour liste les publications vues. Clés de trois jours.
- Une tâche planifiée (`consolidate-post-views`, toutes les 10 minutes) écrit `PFCOUNT` d'aujourd'hui et d'hier dans `content.post_daily_views` (une ligne par publication et par jour, écrasée à chaque passage).
- Lecture par l'auteur seulement (`content.post.stats.read`, propriété de la ressource).

## Conséquences

- Comptes approximatifs : erreur type de 0,81 % (12 Ko au plus par publication et par jour dans Redis), exacts pour les petits nombres.
- Une panne de Redis perd les vues de la période ; la base garde les comptes déjà consolidés. Les vues d'une journée sont définitives après le passage du lendemain.
- La somme des comptes quotidiens n'est pas un nombre de membres uniques sur la période (un membre peut revenir) : l'API ne la fournit pas.
