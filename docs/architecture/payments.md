# Paiements : contributions, rails, ledger et rapprochement

Le module payments encaisse les contributions (§9) sans jamais détenir les fonds : le contributeur paie sur la page hébergée d'un prestataire agréé, qui verse au porteur et prélève la commission à la source (ADR 0043). Le module engagement en tire le tableau de bord d'impact (§9.4, ADR 0053). Les hypothèses à valider par un conseil juridique sont dans `payments-compliance.md`.

## Flux d'une contribution

```mermaid
sequenceDiagram
  participant C as Contributeur
  participant A as api (payments)
  participant J as projects (façade)
  participant P as Prestataire (page hébergée)
  participant DB as PostgreSQL
  participant W as worker
  C->>A: GET /v1/projects/{id}/payment-options
  C->>A: POST /v1/projects/{id}/contribution-quotes
  A-->>C: montant, équivalent EUR, commission, frais estimés
  C->>A: POST /v1/projects/{id}/contributions (Idempotency-Key)
  A->>DB: BEGIN, contribution pending_payment, taux figé
  A->>J: reserve(contrepartie, contribution)
  A->>DB: payments.contribution.created.v1, COMMIT
  A->>P: session hébergée (hors transaction)
  A-->>C: paymentUrl
  C->>P: paiement (carte, SEPA, Mobile Money...)
  P->>A: POST /v1/payments/webhooks/{prestataire} (signé)
  A->>DB: inbox + provider_events + événement interne, 200
  W->>P: lecture de l'état par l'API (vérification)
  W->>DB: BEGIN, succeeded, écriture du ledger
  W->>J: confirm(contribution), applyFunding(équivalent EUR)
  W->>DB: payments.contribution.succeeded.v1, COMMIT
  W-->>C: email de confirmation, « pas un reçu fiscal »
```

- La contribution est créée, et la contrepartie réservée, avant l'appel au prestataire ; un échec de création de session la passe à `failed` et libère la contrepartie.
- Aucun webhook n'est cru sur parole : le worker relit la session ou la transaction par l'API du prestataire et applique l'état lu (montant, devise et référence comparés à la contribution). Un écart n'est jamais appliqué : il devient un écart de rapprochement.
- L'application est idempotente et indifférente à l'ordre : succès, frais, remboursements puis litiges, chacun une seule fois (écriture du ledger unique par type et source, `applyFunding` et `reverseFunding` idempotentes, réservation idempotente).
- Retour du contributeur : `POST /v1/me/contributions/{id}/return` relit l'état chez le prestataire, sans attendre le webhook.
- Expiration : la session expire après `PAYMENTS_SESSION_TTL_MINUTES` (30 à 1 440 minutes, bornes communes à Stripe Checkout et Flutterwave Standard) ; la contrepartie est réservée pour la même durée. La tâche `expire-pending` (toutes les 5 minutes) interroge le prestataire deux minutes après l'échéance, puis expire la contribution et libère la contrepartie. La tâche `release-orphans` (toutes les 15 minutes) libère les réservations restées attachées à une contribution terminée.

### Machine à états

| Depuis               | Vers                                                                |
| -------------------- | ------------------------------------------------------------------- |
| `pending_payment`    | `succeeded`, `failed`, `expired`, `canceled`                        |
| `succeeded`          | `partially_refunded`, `refunded`, `disputed`                        |
| `partially_refunded` | `partially_refunded`, `refunded`, `disputed`                        |
| `disputed`           | `dispute_won`, `dispute_lost`                                       |
| `dispute_won`        | `partially_refunded`, `refunded`, `disputed`                        |
| autres               | aucun (`failed`, `expired`, `canceled`, `refunded`, `dispute_lost`) |

`partially_refunded` sépare les remboursements partiels du remboursement total ; `canceled` est l'abandon par le contributeur avant paiement (`POST /v1/me/contributions/{id}/cancel`).

### Effets

- Succès : écriture `payment_succeeded`, `applyFunding` de l'équivalent EUR (sans case à cocher, §9.3 étape 5), `confirm` de la contrepartie, événement, email de confirmation.
- Remboursement (administrateur, ou décision de modération par `PaymentsFacade.refundForModeration`) : écriture `refund`, commission remboursée au prorata (arrondie au supérieur), `reverseFunding` de la part EUR (arrondie à l'inférieur, la dernière part donnant le reste), libération de la contrepartie au remboursement total.
- Litige : `dispute_opened` à l'ouverture ; gagné, contre-écriture `dispute_won` ; perdu, `dispute_lost` et `reverseFunding` de la part EUR.

## Routage des rails (ADR 0043)

Le rail dépend du pays du compte de versement du porteur, jamais du contributeur :

1. Stripe Connect si la configuration vérifiée le sert dans ce pays (ADR 0044) ;
2. sinon Flutterwave, avec un sous-compte et un partage du paiement (ADR 0045) ;
3. sinon aucun : `PAYMENTS_PAYOUT_COUNTRY_NOT_SUPPORTED` à la création du compte de versement.

Avec `PAYMENTS_MODE=simulated` (développement, tests, refusé en production), le prestataire simulé sert tous les pays (ADR 0052).

L'écran « Contribuer » reçoit `GET /v1/projects/{id}/payment-options` : les devises et moyens vérifiés du rail du porteur, filtrés par le pays du contributeur (pays déclaré du profil, ou `?country=`), avec les bornes dans chaque devise ; jamais le nom du prestataire (§9.2).

## Matrice de capacités

Données de configuration versionnées : `apps/server/src/modules/payments/domain/capability-matrix.ts` (`CAPABILITY_MATRIX_VERSION = 2026-10-07`). Chaque entrée porte ses sources ; une capacité non confirmée par la documentation officielle est `verified: false` et n'est jamais proposée. Vérifié le 2026-10-07.

### Stripe Connect

| Capacité                    | Valeur retenue                                                                                                                                                       | Source                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pays de versement           | Zone euro où Stripe est disponible : AT, BE, BG, HR, CY, EE, FI, FR, DE, GR, IE, IT, LV, LT, LU, MT, NL, PT, SK, SI, ES ; versement en EUR                           | stripe.com/global, docs.stripe.com/connect/charges                                                                                                                                             |
| Non retenus                 | NG, KE, GH, ZA, CI (« extended network » par Paystack) ; SN, CM (absents) ; GB, CH et EEE hors zone euro (règlement dans une autre devise, conversion non modélisée) | stripe.com/global, docs.stripe.com/connect/cross-border-payouts (versements transfrontaliers d'une plateforme EEE limités aux US, UK, EEE, CA, CH, et incompatibles avec les charges directes) |
| Devise de paiement          | EUR                                                                                                                                                                  | docs.stripe.com/currencies                                                                                                                                                                     |
| Carte                       | Oui, minimum 0,50 EUR, maximum 12 chiffres                                                                                                                           | docs.stripe.com/currencies                                                                                                                                                                     |
| SEPA Direct Debit           | Oui, notification différée (succès environ 6 jours ouvrés après), 10 000 EUR par transaction                                                                         | docs.stripe.com/payments/sepa-debit                                                                                                                                                            |
| Apple Pay, Google Pay       | Oui, affichés par Checkout sur les appareils et pays pris en charge                                                                                                  | docs.stripe.com/payments/payment-methods/payment-method-support                                                                                                                                |
| PayPal                      | Non : pas de charges directes avec Connect                                                                                                                           | docs.stripe.com/payments/payment-methods/payment-method-connect-support                                                                                                                        |
| Frais estimés (compte FR)   | Carte, Apple Pay, Google Pay : 1,5 % + 0,25 EUR (cartes EEE standard) ; SEPA : 0,35 EUR                                                                              | stripe.com/fr/pricing                                                                                                                                                                          |
| Frais estimés (autres pays) | Non vérifiés : devis sans estimation                                                                                                                                 |                                                                                                                                                                                                |

### Flutterwave (API v3)

| Capacité                        | Valeur retenue                                                                                                                                                                                                                       | Source                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Pays de versement (sous-compte) | NG (NGN), GH (GHS), RW (RWF), TZ (TZS), UG (UGX)                                                                                                                                                                                     | developer.flutterwave.com/v3.0/docs/split-payments       |
| Non retenus                     | KE, CI, SN, BF, CM, ZA : sous-comptes de collecte non documentés pour ces pays                                                                                                                                                       | idem                                                     |
| Devise de paiement              | Celle du compte de versement uniquement : le partage d'un paiement en EUR, GBP ou USD vers un sous-compte réglé en devise africaine n'est pas documenté                                                                              | developer.flutterwave.com/v3.0/docs/payment-methods      |
| NGN                             | Carte (tous pays), virement, compte bancaire, USSD (contributeurs au Nigeria)                                                                                                                                                        | idem                                                     |
| GHS                             | Carte ; Mobile Money MTN, Telecel, AirtelTigo (contributeurs au Ghana)                                                                                                                                                               | developer.flutterwave.com/v3.0/docs/ghana                |
| UGX                             | Carte ; Mobile Money MTN, Airtel (contributeurs en Ouganda)                                                                                                                                                                          | developer.flutterwave.com/v3.0/docs/uganda               |
| RWF, TZS                        | Carte ; Mobile Money non retenu (opérateurs de collecte non documentés)                                                                                                                                                              | developer.flutterwave.com/v3.0/docs/payment-methods      |
| XOF, XAF, KES (Mobile Money)    | CI : MTN, Orange Money, Moov, Wave ; SN : Orange Money, Wave ; BF : Orange Money, Mobicash ; CM : MTN, Orange Money ; KE : M-Pesa. Vérifiés côté collecte, inaccessibles tant qu'aucun pays de versement correspondant n'est vérifié | developer.flutterwave.com/v3.0/docs/francophone, /m-pesa |
| Montants minimum et maximum     | Non documentés : bornes de la plateforme seulement                                                                                                                                                                                   |                                                          |
| Frais estimés (NG)              | 2 % (1,4 % + 0,6 %) + TVA 7,5 % sur les frais ; autres pays non vérifiés                                                                                                                                                             | flutterwave.com/ng/pricing                               |
| Taux de change                  | `GET /v3/transfers/rates`, indicatif (« estimation », mis à jour plusieurs fois par jour)                                                                                                                                            | developer.flutterwave.com/v3.0/docs/transfer-rates       |

Le paramètre `payment_options` de Flutterwave Standard n'est pas envoyé : ses valeurs pour le Mobile Money francophone diffèrent entre deux tableaux de la documentation ; la page hébergée filtre elle-même les moyens par devise.

## Devises et conversion (ADR 0046)

- `Money` connaît l'exposant ISO 4217 de chaque devise (EUR 2, XOF et XAF 0).
- Chaque contribution enregistre le montant payé dans sa devise, l'équivalent EUR figé à la création de la session, le taux (unités pour un euro, en chaîne décimale), sa source (`identity`, `fixed_parity`, `provider`, `simulated`) et son horodatage.
- XOF et XAF : parité fixe de 655,957 francs pour un euro, en arithmétique entière exacte, arrondi au centime le plus proche, demi vers le haut. 65 596 XOF donnent 100,00 EUR.
- Autres devises : taux du prestataire (`FxRateProvider`), figé pour la session ; l'équivalent EUR de règlement remplace le taux figé quand le prestataire en fournit un (aucun des deux prestataires vérifiés n'en fournit aujourd'hui).
- Les minimums des contreparties sont comparés à l'équivalent EUR.
- Les montants envoyés à Flutterwave sont écrits comme littéraux numériques à partir de chaînes décimales, et ses réponses sont lues en conservant le texte exact des nombres : aucun flottant.

## Commission et frais (ADR 0047)

- Commission : `PAYMENTS_COMMISSION_RATE_BPS` (500 = 5 %), versionnée par `PAYMENTS_COMMISSION_VERSION`, enregistrée sur chaque contribution ; assiette : le montant de la contribution ; arrondi à l'unité mineure inférieure, en faveur du porteur.
- Prélevée à la source : `application_fee_amount` (Stripe), charge `flat` du sous-compte (Flutterwave).
- Frais du prestataire supportés par le porteur ; estimés dans le devis à partir des grilles vérifiées (arrondi au supérieur), puis enregistrés quand le prestataire les communique (écriture `provider_fee`).

## Plan de comptes du ledger (ADR 0048)

Montants signés, en unités mineures, par devise ; chaque écriture s'équilibre par devise ; une écriture n'est jamais modifiée.

| Compte                | Sens                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `contributor_funds`   | Payé par les contributeurs (négatif)                                    |
| `holder_share`        | Part du porteur, chez le prestataire puis sur son compte                |
| `platform_commission` | Commission de Pitchorium, prélevée par le prestataire                   |
| `provider_fees`       | Frais du prestataire, supportés par le porteur                          |
| `refunds`             | Rendu aux contributeurs                                                 |
| `disputes`            | Retenu par un litige                                                    |
| `offline_declared`    | Argent hors plateforme validé (négatif)                                 |
| `offline_receipts`    | Argent hors plateforme reçu par le porteur                              |
| `funding_sources`     | Mémo EUR : sources des montants collectés (négatif)                     |
| `project_funding`     | Mémo EUR : montant collecté d'un projet, égal à son total dans projects |

| Écriture            | Lignes                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_succeeded` | `contributor_funds` −A ; `holder_share` A − C − F ; `platform_commission` C ; `provider_fees` F ; `funding_sources` −E ; `project_funding` E |
| `provider_fee`      | `holder_share` −F ; `provider_fees` F                                                                                                        |
| `refund`            | `refunds` R ; `holder_share` −(R − Cr) ; `platform_commission` −Cr ; `funding_sources` Er ; `project_funding` −Er                            |
| `dispute_opened`    | `disputes` D ; `holder_share` −D                                                                                                             |
| `dispute_won`       | Contre-écriture de l'ouverture                                                                                                               |
| `dispute_lost`      | `funding_sources` Ed ; `project_funding` −Ed                                                                                                 |
| `offline_validated` | `offline_declared` −V ; `offline_receipts` V ; `funding_sources` −E ; `project_funding` E                                                    |

A : montant payé ; C : commission ; F : frais ; E : équivalent EUR ; R, Cr, Er : montant, commission et part EUR remboursés ; D, Ed : montant et part EUR d'un litige ; V : montant hors plateforme.

## Webhooks et rapprochement

### Réception

- `POST /v1/payments/webhooks/stripe|flutterwave|simulated` : servi hors du routage Nest et avant les analyseurs de corps (corps brut), sans session ; absent du document OpenAPI et du client généré.
- Signature vérifiée sur le corps brut : Stripe, `Stripe-Signature` (HMAC SHA-256 de `t.corps`, tolérance 5 minutes) ; Flutterwave v3, `verif-hash` comparé au secret en temps constant ; simulé, `x-simulated-signature` sur le modèle de Stripe.
- Déduplication par l'inbox (`webhook:<prestataire>`, identifiant de l'événement ; pour Flutterwave v3, qui n'en fournit pas : type, transaction et statut), enregistrement dans `payments.provider_events` (références seulement) et événement interne `payments.provider-event.received.v1`, dans une transaction courte ; réponse 200 immédiate, 400 sur signature invalide, 500 si l'enregistrement échoue (le prestataire réessaie).
- Le worker met en file `sync-contribution` (ou `sync-payout-account` pour `account.updated` de Stripe), qui relit l'état chez le prestataire hors transaction (ADR 0019), puis l'applique. Une notification `chargeback.*` de Flutterwave ne nomme la transaction que par son `flw_ref` : le job `sync-payment-reference` retrouve la transaction par `GET /v3/chargebacks?flw_ref=`, puis la synchronise comme les autres.

### Litiges Flutterwave

- API v3 vérifiée dans la documentation officielle le 2026-10-07 (developer.flutterwave.com, chargebacks v3) : `GET /v3/chargebacks` filtrable par `flw_ref`, `from`, `to`, `status`, paginé (`meta.page_info`) ; chaque rétrofacturation porte `id`, `amount` (devise de la transaction), `status`, `stage`, `transaction_id`, `tx_ref`. Les webhooks `chargeback.initiated|accepted|declined|lost` ne sont actifs que sur demande à Flutterwave.
- La lecture d'une transaction réussie (`verify`) liste ses rétrofacturations par son `flw_ref` et les rapporte comme litiges : `initiated`, `pending` et `declined` (contestée par le marchand) restent ouverts ; `accepted` et `lost` sont perdus ; `won` et `reversed` sont gagnés. Les effets sont ceux d'un litige Stripe (ledger, `reverseFunding`, événements).
- Sans webhook, le rapprochement quotidien lit les rétrofacturations de la période et synchronise chaque contribution concernée avant ses contrôles.

### Rapprochement

- Tâche quotidienne `reconcile` (03:30 UTC), sur `PAYMENTS_RECONCILIATION_LOOKBACK_DAYS` jours ; à la demande : `POST /v1/admin/payments/reconciliation-runs` ou `pnpm payments:reconcile [--days N]`.
- Synchronisation préalable des paiements contestés que la lecture d'un paiement ne révèle pas (rétrofacturations Flutterwave de la période).
- Contrôles : chaque transaction listée par le prestataire contre sa contribution (existence, statut, montant, remboursements) ; chaque contribution payée contre une transaction ; chaque contribution payée contre ses lignes (`contributor_funds`, `refunds`) ; l'équilibre global du ledger ; le total de chaque projet contre `project_funding`.
- Un écart est enregistré (`payments.discrepancies`, unique tant qu'il est ouvert), journalisé en `error`, compté (`pitchorium.payments.reconciliation.discrepancy`, attributs `kind` et `provider`) et annoncé (`payments.reconciliation.discrepancy-detected.v1`). Aucune correction automatique : un administrateur le traite (`GET /v1/admin/payments/discrepancies`, `POST .../{id}/resolve` avec une note auditée).

## Anti-fraude et limites

- Bornes d'une contribution sur son équivalent EUR : `PAYMENTS_MIN_EUR_MINOR` et `PAYMENTS_MAX_EUR_MINOR` (1 EUR et 10 000 EUR, provisoires), plus les bornes du prestataire.
- Fréquence : `PAYMENTS_CONTRIBUTIONS_PER_HOUR` par contributeur et `PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR` par contributeur et moyen (10 et 5, provisoires), `PAYMENTS_RATE_LIMITED` au-delà.
- Vérification renforcée : au-delà de `PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR` (1 000 EUR, provisoire), la double authentification est exigée (`ACCESS_PREREQUISITES_MISSING`, `two_factor`).
