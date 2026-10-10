# 0043. Non-détention des fonds et routage par le porteur

Statut : acceptée (2026-10-07), choix explicite du prestataire par le porteur depuis l'ADR 0134. Hypothèses juridiques à valider (`docs/architecture/payments-compliance.md`).

## Contexte

Pitchorium encaisse des dons, des contributions avec contrepartie et du love money (§9.1) entre l'Europe et l'Afrique (§9.2), sans devenir une banque ni un établissement de paiement (§9.5). Aucun prestataire ne couvre seul les cartes européennes, le Mobile Money ouest-africain et M-Pesa (§9.2). Le prototype affichait un solde auto-déclaré, supprimé (§9.4).

## Décision

- Les fonds vont du contributeur au porteur par un prestataire agréé ; la commission est prélevée à la source par le prestataire. Pitchorium ne crédite ni ne débite aucun solde : il n'existe pas de « solde Pitchorium ».
- Le rail est déterminé par le pays du compte de versement du porteur, jamais par le contributeur : Stripe Connect si sa configuration vérifiée le sert dans ce pays, sinon Flutterwave avec un sous-compte et un partage, sinon aucun (`PAYMENTS_PAYOUT_COUNTRY_NOT_SUPPORTED`).
- Les capacités des prestataires (pays, devises, moyens, montants, frais) sont des données de configuration versionnées et sourcées (`domain/capability-matrix.ts`) ; une capacité non confirmée par la documentation officielle est désactivée.
- Le paiement a toujours lieu sur la page hébergée du prestataire ; aucune donnée de carte ne transite par Pitchorium.
- Ports : `PaymentProvider` (session hébergée, lecture de l'état, remboursement, transactions pour le rapprochement, vérification des webhooks), `PayoutAccountProvider` (création, onboarding, état du compte), `KycProvider`, `FxRateProvider`.
- Une contribution est une machine à états (`docs/architecture/payments.md`), dont chaque transition est appliquée une fois, après lecture de l'état chez le prestataire.

## Conséquences

- Avec la matrice vérifiée le 2026-10-07, les porteurs dont le compte est en zone euro passent par Stripe, ceux du Nigeria, du Ghana, du Rwanda, de Tanzanie et d'Ouganda par Flutterwave ; l'Afrique francophone n'a pas encore de rail (sous-comptes non documentés) : questions ouvertes.
- Ajouter un pays ou un moyen, c'est vérifier la documentation, ajouter l'entrée sourcée et changer la version de la matrice.
