# 0047. Commission, arrondi et frais

Statut : acceptée (2026-10-07). Les trois choix sont à valider (questions ouvertes 11, 52 et 53).

## Contexte

La commission de 5 % est prélevée à la source et affichée avant paiement (§9.3 étape 7). Son assiette, son arrondi et la prise en charge des frais du prestataire restaient ouverts (question 11).

## Décision

- Taux configurable (`PAYMENTS_COMMISSION_RATE_BPS`, 500) et versionné (`PAYMENTS_COMMISSION_VERSION`) ; taux et version sont enregistrés sur chaque contribution.
- Assiette : le montant de la contribution, dans la devise payée.
- Arrondi : à l'unité mineure inférieure, en faveur du porteur (5 % de 10,99 EUR = 0,54 EUR).
- Frais du prestataire supportés par le porteur : le devis les estime à partir des grilles publiques vérifiées (arrondi supérieur), ou n'affiche pas d'estimation sans grille vérifiée ; les frais réels sont enregistrés quand le prestataire les communique.
- Remboursement : la commission est rendue au prorata, arrondie au supérieur (en faveur du porteur, qui supporte le remboursement), la dernière part rendant le reste.

## Conséquences

- La commission est exacte et identique chez Stripe (`application_fee_amount`) et Flutterwave (charge `flat`).
- Les frais non remboursés par le prestataire restent à la charge du porteur.
