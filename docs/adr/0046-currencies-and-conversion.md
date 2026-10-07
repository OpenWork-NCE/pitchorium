# 0046. Devises et conversion

Statut : acceptée (2026-10-07). Complète l'ADR 0037 ; répond provisoirement à la question ouverte 8.

## Contexte

Les projets sont libellés en euros (ADR 0037) ; les contributions arrivent en euros, en francs CFA, en naira ou en cedi. L'équivalent EUR alimente le collecté, les paliers et la comparaison avec le minimum des contreparties ; il ne doit dépendre d'aucun flottant.

## Décision

- `Money` connaît l'exposant ISO 4217 de chaque devise active et refuse les autres codes.
- Chaque contribution enregistre le montant payé et sa devise, l'équivalent EUR figé à la création de la session, le taux (unités pour un euro, chaîne décimale), sa source et sa date.
- XOF et XAF : parité fixe légale de 655,957 francs pour un euro, calcul exact en entiers, arrondi au centime le plus proche, demi vers le haut (`eurEquivalent`).
- Devises flottantes : taux du port `FxRateProvider` (Flutterwave `GET /v3/transfers/rates` en mode réel, table fixe marquée `simulated` en développement), figé pour la session. Quand le prestataire communique un équivalent EUR de règlement, il remplace le taux figé avant l'application au projet.
- Les remboursements et les litiges convertissent leur part au prorata de l'équivalent figé (arrondi inférieur, la dernière part donnant le reste) : la somme des annulations ne dépasse jamais l'équivalent appliqué.
- Les bornes et minimums affichés dans une devise sont le plus petit montant dont l'équivalent atteint la valeur en euros.

## Conséquences

- Le collecté d'un projet est exact au centime et égal au compte mémo `project_funding` du ledger.
- Le taux de Flutterwave est indicatif (« estimation ») : l'écart avec le change réel est supporté hors de la plateforme (question ouverte 8).
