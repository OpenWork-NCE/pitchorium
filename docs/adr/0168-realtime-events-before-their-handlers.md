# 0168. Événements du temps réel reçus avant leurs gestionnaires

Statut : acceptée (2026-10-12).

## Contexte

Les gestionnaires du temps réel (`realtime-handlers.ts`) portent Zod et les schémas des charges utiles. Depuis l'ADR 0163, ils sont chargés dix secondes après la connexion, puis à l'inactivité de la page : évalués plus tôt, ils coûtaient 75 ms de Total Blocking Time au fil. Un message ou une notification peut pourtant arriver pendant ces dix secondes ; la revue du FRONT 8B demandait la preuve qu'aucun n'est perdu ni affiché en retard.

Trois solutions étaient possibles : une file des événements reçus avant le chargement, le chargement immédiat au premier événement, ou un validateur plus léger que Zod dans le navigateur.

## Décision

- Le premier événement reçu déclenche aussitôt le chargement des gestionnaires (`load()` de `realtime-connection.ts`) ; le délai de dix secondes ne vaut que sans événement.
- Chaque événement s'enchaîne sur la même promesse de chargement : ceux reçus pendant le chargement sont traités dans leur ordre d'arrivée, dès qu'il se termine, et les gestionnaires ne sont construits qu'une fois. C'est la file : aucune structure de plus.
- Un événement inconnu est ignoré sans bloquer les suivants ; un chargement en échec (hors ligne) est retenté au prochain événement, et ce qui a été manqué est relu à la reconnexion (`local:resumed`, ADR 0056).
- Les charges utiles restent validées par les schémas des contrats : aucun second validateur à tenir à jour.
- Une page qui écoute un événement s'abonne après son hydratation, parfois après l'ouverture du canal : un événement arrivé dans cet intervalle est traité (cache, compteurs, liste des conversations) mais n'atteint pas cette page. Le fil d'une conversation relit donc, une fois abonné, ce qui suit son dernier message (`afterSequence`, comme au retour du canal) ; le parcours réel l'a montré, le message apparaissait dans la liste et pas dans le fil ouvert.

C'est la solution la plus simple qui garde le gain : Zod n'est évalué au démarrage de la page que si un événement arrive à ce moment, ce qui est rare, et jamais sur la page mesurée par Lighthouse.

## Conséquences

- Un événement des premières secondes est affiché après le téléchargement du morceau des gestionnaires (quelques dizaines de millisecondes), pas après dix secondes.
- Preuves : `realtime-connection.spec.ts` (événement traité sans attendre, ordre de trois événements reçus pendant le chargement, un seul chargement, événement inconnu ignoré) et le parcours réel `e2e-live/realtime.spec.ts` (un message et une notification envoyés dans les deux secondes qui suivent la connexion sont affichés en moins de trois secondes). Le Total Blocking Time du fil reste jugé par Lighthouse (ADR 0163).
