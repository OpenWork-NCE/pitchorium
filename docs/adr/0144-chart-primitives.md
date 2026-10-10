# 0144. Primitives de graphique

Statut : acceptée (2026-10-11).

## Contexte

Le tableau de bord d'engagement (ADR 0141) et les statistiques d'une publication dessinaient chacun leur SVG : des barres sans axe vertical, sans valeur lisible, sans résumé, un titre répété dans la carte et dans la figure, des axes vides quand tout était nul. Un graphique qui ne dit aucun nombre ne communique rien.

## Décision

- Un graphique en barres du design system, `BarChart` (`components/ui/bar-chart.tsx`), en SVG sans bibliothèque : aucune dépendance, quelques kilooctets, rendu par le serveur puis hydraté.
- Il ne sait rien du métier : l'appelant donne pour chaque barre une valeur entière (un compte, ou un montant en unités mineures) et ses textes déjà formatés (libellé court de l'axe, libellé complet, valeur écrite), le formatage des graduations (devise, notation compacte) et le résumé chiffré écrit au-dessus du graphique.
- Graduations de l'axe vertical : multiples entiers d'un pas rond (1, 2 ou 5 fois une puissance de dix), au moins 1, calculés par `chart-scale.ts` (testé). Ce sont des repères de lecture, pas des montants de l'api : aucun montant n'est additionné ni converti dans le web. Le total sur douze mois du tableau de bord vient de l'api (`givenLastTwelveMonths`).
- Un seul titre : la carte le porte (`title` reste le nom accessible de la figure), ou le graphique l'affiche (`showTitle`), jamais les deux.
- Lecture : une colonne cible par barre, toute la hauteur, un seul arrêt du clavier (flèches, Début, Fin), info-bulle au survol et au focus ; `figure`, `figcaption` et tableau de données masqué pour les lecteurs d'écran.
- États : squelette à la forme du graphique, `ErrorState` avec reprise, `EmptyState` (message et action) quand aucune valeur n'est au-dessus de zéro, jamais d'axes vides.
- Mouvement : les barres montent depuis l'axe par `transform` à un montage dans le navigateur, ou à leur arrivée à l'écran pour un rendu du serveur hors de l'écran ; un rendu du serveur visible est peint dans son état final ; rien ne bouge en mouvement réduit.

## Conséquences

- Les statistiques d'une publication n'ont pas de nombre de membres uniques sur toute la période (une somme des membres uniques de chaque jour serait fausse) : leur résumé dit le nombre de jours et le pic (`docs/open-questions.md`).
- Une courbe ou une aire s'ajoutera par le même module d'échelle quand un usage la justifiera ; aucun ne le fait aujourd'hui.
