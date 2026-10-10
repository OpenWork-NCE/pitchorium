# 0050. KYC du porteur

Statut : acceptée (2026-10-07). Niveau de vérification à valider (question ouverte 13).

## Contexte

Le KYC du porteur précède tout versement (§9.5, §13). Stripe vérifie lui-même ses comptes connectés ; Flutterwave ne vérifie pas le porteur d'un sous-compte pour Pitchorium. Le module access déclarait un port `kyc_verified` sans adaptateur réel (ADR 0015).

## Décision

- Rail Stripe : l'état du compte connecté fait foi (`charges_enabled` et `payouts_enabled`), relu au retour d'onboarding et à chaque `account.updated`.
- Autres rails : port `KycProvider`, adaptateur de revue manuelle : pièces privées par le module media (usage `verification_document`, lisibles par le porteur et les administrateurs avec double authentification), file de revue, décision motivée, audit de chaque étape. Un prestataire de KYC automatisé implémentera le même port.
- Le module payments enregistre auprès d'access la source du niveau `kyc_verified` et l'élément `payout_account` (compte de versement actif).
- Un projet se publie sans KYC ; les contributions encaissées n'ouvrent qu'avec KYC vérifié et compte actif. Engagements, déclarations hors plateforme et manifestations d'intérêt restent possibles avant. `GET /v1/me/prerequisites/payment.collection.open` donne au porteur ce qui manque ; les contributeurs voient `holder_not_verified` ou `holder_without_covered_payout_account` (ADR 0135).

## Conséquences

- La décision de démonstration de `pnpm db:seed:dev` n'a pas de relecteur (refusée en production, ADR 0035).
