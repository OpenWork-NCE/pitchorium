# Paiements : hypothèses réglementaires à valider

Le module payments repose sur des hypothèses juridiques qu'un conseil doit valider avant toute mise en production avec de vrais paiements (§9.5 : « à traiter avec un conseil, pas à improviser »). Aucune n'est tenue pour acquise ; chacune est reprise dans `docs/open-questions.md` (questions 51 à 64). Les capacités techniques citées sont vérifiées dans `payments.md`.

## 1. Pitchorium ne détient jamais les fonds de tiers

- Hypothèse : Pitchorium n'exerce pas d'activité d'établissement de paiement, car les fonds vont du contributeur au porteur par un prestataire agréé, qui prélève lui-même la commission (§9.5).
- Stripe Connect (ADR 0044) : charges directes sur le compte connecté du porteur ; le paiement crédite le solde du compte connecté, la plateforme ne reçoit que la commission (`application_fee_amount`). Les remboursements et les litiges débitent le compte connecté.
- Flutterwave (ADR 0045) : le paiement est collecté sur le compte marchand de Pitchorium chez Flutterwave, puis partagé au règlement vers le sous-compte du porteur. À valider : ce schéma relève-t-il, pour Pitchorium, d'un encaissement pour compte de tiers ? Un remboursement est débité du solde disponible du compte principal (documentation Flutterwave) : Pitchorium avancerait alors les remboursements.
- Aucun solde interne n'est créditable ni débitable par un membre ; le ledger (ADR 0048) n'est qu'un miroir des flux chez les prestataires et hors plateforme.

## 2. Rôle de chaque prestataire

- Stripe et Flutterwave sont supposés agréés pour les territoires et les flux utilisés : agréments, pays couverts et responsabilités contractuelles (marchand de référence, litiges, pertes) à confirmer dans leurs contrats.
- Hypothèse d'un établissement de la plateforme dans l'Espace économique européen : elle conditionne l'analyse de Stripe (versements transfrontaliers, charges directes). À confirmer avec le pays d'immatriculation de Pitchorium.
- Le prestataire simulé n'existe qu'en développement et en test ; il est refusé en production.

## 3. KYC du porteur

- Rail Stripe : la vérification d'identité du compte connecté par Stripe fait foi.
- Rail Flutterwave : revue manuelle par un administrateur de Pitchorium (pièces privées, décision motivée, audit). À valider : niveau de vérification exigé, pièces attendues par pays, conservation, et qui porte l'obligation (Pitchorium, Flutterwave, ou les deux).
- Les contributions encaissées ne s'ouvrent qu'après KYC et activation du compte de versement ; un projet peut être publié avant.
- Compte de versement hors du pays de résidence (ADR 0134) : le porteur choisit le pays de son compte ; un résident du Sénégal peut recevoir sur un compte en France s'il remplit les conditions du prestataire (Stripe : adresse et compte bancaire dans ce pays, passeport). À valider : obligations fiscales et déclaratives du porteur, et vigilance de Pitchorium sur un compte tenu hors du pays de résidence (question 123).

## 4. Lutte contre le blanchiment et le financement du terrorisme

- Seuil provisoire de vérification renforcée : 1 000 EUR par contribution (`PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR`), qui exige la double authentification du contributeur. À valider : seuils, mesures (identification du contributeur, justificatifs), cumul par période.
- Bornes et fréquences provisoires (`PAYMENTS_MIN_EUR_MINOR`, `PAYMENTS_MAX_EUR_MINOR`, `PAYMENTS_CONTRIBUTIONS_PER_HOUR`, `PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR`).
- Filtrage des sanctions et des personnes politiquement exposées : supposé assuré par les prestataires, à confirmer.
- Dons anonymes désactivés par défaut (`PAYMENTS_ANONYMOUS_DONATIONS=false`) ; leur ouverture dépend de cette analyse.

## 5. Aucun reçu fiscal

- L'email de confirmation précise qu'il n'est pas un reçu fiscal (§9.3 étape 6). À valider : responsabilité du porteur pour l'émission des reçus fiscaux, mentions à afficher selon le statut du porteur (association, entreprise, personne).
- Mentions du §9.5 jointes à la confirmation : impact auto-déclaré, un don n'est pas un titre, un palier débloqué n'est pas une garantie.

## 6. Equity et prêts exclus

- Aucun paiement en ligne de type `equity` ou `loan`, même si les flags `funding.equity` ou `funding.loans` sont activés, tant qu'aucun adaptateur habilité n'existe (ADR 0051). Subventions, prêts d'honneur et obligations convertibles restent des manifestations d'intérêt (§9.1).
- Cadre à valider avant toute ouverture : règlement ECSP (licence de prestataire de financement participatif) ou partenaire habilité.

## 7. Contributions hors plateforme

- Pitchorium n'affiche un montant hors plateforme dans le collecté qu'après validation d'un administrateur sur pièce justificative (ADR 0049). À valider : portée de cette validation (attestation ou simple contrôle de cohérence), pièces acceptées, responsabilité en cas de fausse pièce.

## 8. Commission, frais et fiscalité

- Assiette, arrondi et prise en charge des frais du prestataire par le porteur (ADR 0047) : à valider contractuellement avec les porteurs.
- TVA ou taxes applicables à la commission de Pitchorium selon le pays du porteur : non traitées.

## 9. Remboursements et litiges

- Remboursement par un administrateur, ou sur décision de modération ; commission remboursée au prorata. À valider : conditions générales (cas de remboursement, délais), et sort de la commission sur un litige perdu (Stripe ne la rend pas d'office : elle reste aujourd'hui acquise).

## 10. Données personnelles

- Aucune donnée de carte ne transite par Pitchorium (pages hébergées) ; les coordonnées bancaires des sous-comptes sont transmises au prestataire et non conservées.
- Durées de conservation des contributions, du ledger, des pièces KYC et des justificatifs : à fixer (question ouverte 20).
