# 0134. Choix du versement par le pays du compte

Statut : acceptée (2026-10-10). Précise l'ADR 0043 ; règles de changement provisoires (question ouverte 123).

## Contexte

Le rail d'un projet dépend du pays du compte de versement du porteur (ADR 0043). L'api déduisait le prestataire de ce pays (Stripe d'abord, Flutterwave ensuite) et ne permettait ni de reprendre ni de changer un compte. Or un porteur établi dans un pays sans rail (Sénégal) peut détenir un compte éligible ailleurs (France), deux prestataires pourraient servir un même pays, et un porteur doit savoir ce qu'il accepte. Le pays d'un compte Stripe ne change jamais (support.stripe.com, « Stripe account country can't be changed after activation »).

## Décision

- Le porteur choisit le prestataire et le pays de son compte parmi les combinaisons de la couverture publique (ADR 0133) et confirme remplir les conditions du prestataire (`eligibilityConfirmed`). Rien n'est déduit du pays de son profil ni de ses projets.
- La même option reprend le compte existant ; une autre option passe par un changement explicite (`PUT /v1/me/payout-account`), action `payment.payout.change` à session récente : l'argent change de destination.
- Un changement ouvre un nouveau compte chez le prestataire choisi ; l'ancien reste chez son prestataire, et chaque contribution garde le compte qui l'a reçue (remboursements, litiges, rapprochement inchangés).
- Refus (`PAYMENTS_PAYOUT_CHANGE_REFUSED`, `reason`) : `same_option` ; `campaign_in_progress` tant qu'un projet du porteur est en financement et que le compte actuel encaisse, pour ne pas partager une campagne entre deux rails et deux devises ; `payments_pending` tant que des sessions de paiement sont en attente sur le compte actuel. Un compte qui n'encaisse plus peut changer pendant une campagne.
- Un compte dont la combinaison n'est plus couverte (matrice modifiée) n'encaisse plus (`covered: false`) : l'élément `payout_account` manque, les contributions sont refusées, le changement est possible.

## Conséquences

- Les conditions d'éligibilité et la couverture sont lisibles avant de choisir ; le front n'a rien à déduire.
- Plusieurs comptes peuvent exister chez un prestataire pour un même porteur ; seul le dernier reçoit de nouvelles contributions.
- Les règles de changement et le compte tenu hors du pays de résidence restent à valider (question 123) ; le compte d'une organisation n'existe pas encore (question 121).
