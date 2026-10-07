# 0045. Sous-comptes Flutterwave

Statut : acceptée (2026-10-07). Schéma de fonds à valider juridiquement (`payments-compliance.md`, §1).

## Contexte

Pour les porteurs que Stripe ne sert pas, Flutterwave est le prestataire de référence (§9.2). Sa documentation v3 décrit les sous-comptes de collecte et le partage des paiements (developer.flutterwave.com/v3.0/docs/split-payments), la page hébergée Flutterwave Standard (`POST /v3/payments`) et la vérification de chaque transaction avant de donner de la valeur. La version 4 de l'API change l'authentification et la signature des webhooks ; Flutterwave annonce maintenir la v3.

## Décision

- API v3. Compte de versement : sous-compte (`POST /v3/subaccounts`) créé avec les coordonnées bancaires du porteur, transmises sans être conservées.
- Paiement : Flutterwave Standard, `tx_ref` égal à l'identifiant de la contribution, `session_duration` égale à la durée de la session, sous-compte avec `transaction_charge_type = flat` et `transaction_charge` égale à la commission calculée par Pitchorium : le compte principal garde exactement la commission, le sous-compte reçoit le reste moins les frais (exemples de la documentation).
- Webhooks : `verif-hash` comparé au secret en temps constant ; chaque notification est suivie d'une lecture `GET /v3/transactions/{id}/verify`, dont le statut, le montant, la devise et la référence doivent correspondre à la contribution avant tout effet.
- Remboursement : `POST /v3/transactions/{id}/refund`, état relu par `GET /v3/refunds/{id}` (les webhooks de remboursement sont désactivés par défaut chez Flutterwave).
- Paiement dans la devise du compte de versement uniquement ; pays de versement retenus : NG, GH, RW, TZ, UG.
- Montants envoyés comme littéraux numériques tirés de chaînes décimales, réponses lues sans flottant.

## Conséquences

- Le paiement transite par le compte marchand de Pitchorium chez Flutterwave avant le partage, et un remboursement débite le compte principal : point juridique et de trésorerie à valider.
- Litiges Flutterwave suivis par l'API des rétrofacturations v3 (`GET /v3/chargebacks`, vérifiée dans la documentation le 2026-10-07) : à la lecture d'une transaction, sur notification `chargeback.*` (activée sur demande) et au rapprochement quotidien (`docs/architecture/payments.md`). Forme réelle des réponses à confirmer par `pnpm test:providers` avec des clés de test.
- Les cartes de la diaspora en EUR, GBP ou USD vers un porteur africain restent désactivées tant que le partage multidevise n'est pas confirmé.
