# 0052. Prestataire simulé

Statut : acceptée (2026-10-07), couverture restreinte aux pays des rails vérifiés le 2026-10-10.

## Contexte

Les tests et les données de démonstration doivent exercer tout le parcours (session, webhook signé, vérification, ledger, remboursements, litiges) sans compte réel chez un prestataire.

## Décision

- Un adaptateur `simulated` implémente les mêmes ports que Stripe et Flutterwave ; son état (sessions, remboursements, litiges, comptes) vit dans ses propres tables du schéma payments.
- Ses notifications sont signées comme celles de Stripe (`x-simulated-signature`, HMAC SHA-256 de `t.corps`, tolérance 5 minutes, secret `PAYMENTS_SIMULATED_WEBHOOK_SECRET`) et passent par le même point d'entrée.
- Scénarios : succès, échec, expiration, remboursement, litige, litige gagné ou perdu ; page hébergée de développement `/v1/payments/simulated/checkout/{session}`, qui joue un scénario et livre sa notification.
- `PAYMENTS_MODE=simulated` remplace tous les prestataires ; refusé au démarrage quand `NODE_ENV=production`, où au moins un prestataire réel est exigé.
- Couverture : les pays de versement vérifiés des rails réels (Stripe et Flutterwave), chacun réglé en EUR (les projets de démonstration sont en euros) ; les devises de la démonstration (EUR, XOF, XAF, NGN, GHS, KES) et tous les moyens, le Mobile Money seulement pour les pays de contributeurs où un rail réel l'a vérifié. Le développement et les tests montrent ainsi la couverture de la production : un pays sans rail n'a pas de compte de versement, un contributeur hors des pays du Mobile Money ne se le voit pas proposer.
- Utilisé par les tests d'intégration et par `pnpm db:seed:dev` (ADR 0035). Les adaptateurs réels sont testés contre des serveurs HTTP reproduisant les API et les signatures de Stripe et de Flutterwave.

## Conséquences

- Ses taux de change flottants sont fixes et marqués `simulated` ; il ne prélève qu'un frais fictif de 1,5 %.
