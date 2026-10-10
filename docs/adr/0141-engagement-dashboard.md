# 0141. Tableau de bord d'engagement

Statut : acceptée (2026-10-10).

## Contexte

Le prototype affichait un solde fictif. Le §9.4 demande un tableau de bord d'engagement, pas un compte en banque : euros effectivement versés, projets soutenus, heures de savoir, historique téléchargeable. Le §4 interdit tout montant qui ne serait pas réel.

## Décision

- `/dashboard` pour le membre, `/dashboard?organization=<slug>` pour une organisation dont il est `owner` ou `admin` (404 sinon), lus par le serveur dans `GET /v1/me/impact-dashboard` et `GET /v1/organizations/{id}/impact-dashboard`. Aucun « solde » : un encadré le dit.
- Chiffres clés (`Stat`, H17) : versé ce mois-ci et depuis le début, projets soutenus, heures déclarées et confirmées (membre seulement, les heures sont personnelles). Les montants comptent en unités mineures entières, jamais par un flottant.
- Graphique SVG des douze derniers mois, dessiné par le serveur sans bibliothèque, depuis la série nette de l'api (`monthly`) : le web n'additionne rien, il met à l'échelle en arithmétique entière (un mois non nul garde une hauteur visible, un mois négatif est vide) ; les valeurs sont dans un tableau lu par les lecteurs d'écran.
- Historique en CSV de l'api, téléchargé sans rien garder dans le navigateur.
- Projets soutenus : ceux des contributions payées du membre, ou ceux que liste la page de l'organisation, chacun avec son statut lu dans l'api (24 au plus).
- « Mes contributions » (feature `payments`) sous le tableau de bord du membre : statuts, remboursements compris, détail de chaque contribution (devis appliqué, devise, équivalent en euros, « pas un reçu fiscal »), contributions hors plateforme à confirmer.
- Journal du temps partagé (`/dashboard/time`, §6.3) : déclaration pour un projet soutenu ou un entrepreneur par son identifiant, nature, durée de 1 minute à 24 heures, date du jour ou passée (champ de date natif : `DateTimeField` saisit un instant, pas un jour du calendrier) ; déclarations reçues à confirmer ou contester avec un motif.

## Conséquences

- Les chiffres du tableau de bord et ceux du journal suivent les mêmes états (déclaré, confirmé, contesté) que l'api.
- Un projet mentoré sans avoir été soutenu se déclare par l'identifiant de son entrepreneur.
