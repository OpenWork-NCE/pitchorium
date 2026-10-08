# Module payments

Contributions encaissées par des prestataires agréés, contributions hors plateforme, compte de versement et KYC des porteurs, ledger en partie double et rapprochement (cahier des charges §9, §11.3, §13). Pitchorium ne détient jamais les fonds (ADR 0043). Flux, rails, matrice de capacités sourcée, plan de comptes, webhooks et rapprochement : `docs/architecture/payments.md` ; hypothèses juridiques à valider : `docs/architecture/payments-compliance.md`.

## Contribution

- Types encaissés : `donation`, `reward_crowdfunding`, `love_money`, acceptés par le projet (`PAYMENTS_INSTRUMENT_NOT_ACCEPTED`). `equity` et `loan` : `PAYMENTS_LICENSED_PARTNER_REQUIRED`, même flags activés (ADR 0051) ; `grant`, `honor_loan`, `convertible_bonds` : `PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE`.
- Prérequis du projet : publié, ouvert, visible ; porteur avec compte de versement actif et KYC vérifié (`PAYMENTS_HOLDER_NOT_READY`, ADR 0050).
- Rail du porteur (pays du compte de versement), devise et moyen vérifiés pour le pays du contributeur (`PAYMENTS_CURRENCY_NOT_AVAILABLE`, `PAYMENTS_METHOD_NOT_AVAILABLE`).
- Équivalent EUR figé à la session avec son taux et sa source (ADR 0046) ; commission de 5 % versionnée, arrondie au bénéfice du porteur ; frais estimés (ADR 0047).
- Bornes et fréquences (`PAYMENTS_AMOUNT_OUT_OF_RANGE`, `PAYMENTS_RATE_LIMITED`), double authentification au-delà du seuil de vérification renforcée.
- Contrepartie : éligible si l'instrument est listé et l'équivalent EUR atteint le minimum (`PAYMENTS_REWARD_NOT_ELIGIBLE`), réservée pour la durée de la session (`PROJECTS_REWARD_SOLD_OUT` sans unité), confirmée au succès, libérée à l'échec, à l'expiration, à l'annulation, au remboursement total et au litige perdu.
- En son nom ou au nom d'une organisation dont on est `owner` ou `admin` (projets soutenus de la page organisation).
- Affichage public dans les soutiens par adhésion (`publicDisplay`, faux par défaut), sans montant ; don anonyme (masqué au porteur) seulement si `PAYMENTS_ANONYMOUS_DONATIONS` l'autorise.
- `Idempotency-Key` obligatoire à la création. Machine à états, effets, expiration et remboursements : `docs/architecture/payments.md`.

## Hors plateforme (ADR 0049)

Espèces, virement institutionnel (montant en EUR, XOF ou XAF), engagement de love money et mécénat de compétences (sans montant). Déclarés par le contributeur ou par un propriétaire du projet pour un membre, confirmés ou rejetés par l'autre partie ; un montant ne compte qu'après validation d'un administrateur sur pièce (`PAYMENTS_OFFLINE_PROOF_REQUIRED`). Les engagements confirmés sont comptés à part.

## Compte de versement et KYC (ADR 0044, 0045, 0050)

- Stripe : compte équivalent Standard créé par Accounts v2 sans donnée d'identité (Stripe la collecte, ADR 0044), onboarding hébergé (`onboardingUrl`), état relu au retour (`POST /v1/me/payout-account/refresh`) et sur `account.updated` ; la vérification Stripe fait foi.
- Flutterwave et simulé : coordonnées bancaires transmises au prestataire (sous-compte), non conservées ; KYC par revue manuelle (pièces `verification_document` privées, décision motivée, audit).

## Prestataires

`PAYMENTS_MODE=simulated` (prestataire simulé seul, ADR 0052, refusé en production) ou `live` (Stripe et Flutterwave selon leurs identifiants). Adaptateurs : `infrastructure/stripe`, `infrastructure/flutterwave`, `infrastructure/simulated`. Montants sans flottant : Stripe en unités mineures, Flutterwave en littéraux décimaux lus et écrits exactement (`infrastructure/provider-http.ts`).

## Routes

- `GET /v1/projects/{projectId}/payment-options?country=` et `POST /v1/projects/{projectId}/contribution-quotes` (`payment.quote`)
- `POST /v1/projects/{projectId}/contributions` (`payment.contribute`, `Idempotency-Key`), `POST /v1/organizations/{organizationId}/contributions` (`payment.contribute.organization`, `owner` ou `admin`, `Idempotency-Key`)
- `GET /v1/me/contributions`, `GET /v1/me/contributions/{contributionId}`, `POST /v1/me/contributions/{contributionId}/return` (`payment.contribution.read`), `POST /v1/me/contributions/{contributionId}/cancel` (`payment.contribution.cancel`)
- `GET /v1/projects/{projectId}/contributions`, `GET /v1/projects/{projectId}/offline-contributions` (`payment.project.contributions.read`, propriétaires), `GET /v1/projects/{projectId}/contributions/export` (CSV, `payment.project.contributions.export`, propriétaires)
- `GET /v1/public/projects/{projectId}/supporters` (public, `Cache-Control: public, max-age=60`)
- `POST /v1/projects/{projectId}/offline-contributions` (`payment.offline.declare`), `POST /v1/projects/{projectId}/team/offline-contributions` (`payment.offline.declare.team`), `GET /v1/me/offline-contributions`, `POST /v1/offline-contributions/{id}/confirm`, `POST /v1/offline-contributions/{id}/reject`, `PUT /v1/offline-contributions/{id}/proofs` (`payment.offline.respond`)
- `GET|POST /v1/me/payout-account`, `POST /v1/me/payout-account/refresh` (`payment.payout.configure`), `GET /v1/me/kyc`, `POST /v1/me/kyc/submissions` (`payment.kyc.submit`)
- Administration (administrateurs avec double authentification) : `GET /v1/admin/payments/contributions/{id}`, `POST /v1/admin/payments/contributions/{id}/refunds` (`payment.refund`) ; `GET /v1/admin/payments/kyc-submissions`, `GET .../{id}`, `POST .../{id}/decision` (`payment.kyc.review`) ; `GET /v1/admin/payments/offline-contributions`, `POST .../{id}/decision` (`payment.offline.validate`) ; `GET /v1/admin/payments/discrepancies`, `POST .../{id}/resolve`, `POST /v1/admin/payments/reconciliation-runs` (`payment.reconciliation.manage`)
- Hors OpenAPI : `POST /v1/payments/webhooks/{stripe|flutterwave|simulated}` (signature du prestataire) ; `GET|POST /v1/payments/simulated/checkout/{session}[/{scenario}]` (mode simulé, hors production)

## Schéma `payments`

`payout_accounts`, `kyc_submissions`, `contributions`, `refunds`, `disputes`, `ledger_entries` et `ledger_lines`, `offline_contributions`, `provider_events`, `reconciliation_runs`, `discrepancies`, `simulated_sessions`, `simulated_accounts`.

## Façade publique (`index.ts`)

`PaymentsFacade` : `contributionFacts` (dont `named` : contributeur affiché et non anonyme), `contributionFactsAfter` (projection d'engagement), `contributorIds` et `offlineParties` (notifications), `refundableContributionIds` (contributions payées d'un projet qu'un remboursement peut encore atteindre), `refundForModeration` ; `ReconciliationService` (commande `pnpm payments:reconcile`) ; classes d'événements. Au démarrage, la façade enregistre : la source du niveau `kyc_verified` et l'élément `payout_account` (access), les projets soutenus par une organisation (organizations), les règles de lecture des pièces KYC et des justificatifs hors plateforme (media).

## Événements émis

| Type                                              | Payload                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `payments.contribution.created.v1`                | `projectId`, `contributorId`, `organizationId`, `kind`, `amountMinor`, `currency`, `eurMinor`                |
| `payments.contribution.succeeded.v1`              | `projectId`, `contributorId`, `organizationId`, `kind`, `eurMinor`                                           |
| `payments.contribution.failed.v1`                 | `projectId`, `reason`                                                                                        |
| `payments.contribution.expired.v1`                | `projectId`                                                                                                  |
| `payments.contribution.canceled.v1`               | `projectId`                                                                                                  |
| `payments.contribution.refunded.v1`               | `projectId`, `refundId`, `amountMinor`, `currency`, `eurMinor`, `full`                                       |
| `payments.contribution.disputed.v1`               | `projectId`, `disputeId`, `amountMinor`, `currency`                                                          |
| `payments.contribution.dispute-resolved.v1`       | `projectId`, `disputeId`, `outcome`, `eurMinor`                                                              |
| `payments.offline-contribution.declared.v1`       | `projectId`, `kind`, `by`, `declaredBy`                                                                      |
| `payments.offline-contribution.confirmed.v1`      | `projectId`, `kind`, `by`                                                                                    |
| `payments.offline-contribution.validated.v1`      | `projectId`, `kind`, `by`, `eurMinor`                                                                        |
| `payments.offline-contribution.rejected.v1`       | `projectId`, `kind`, `by`                                                                                    |
| `payments.payout-account.onboarded.v1`            | `provider`, `country`                                                                                        |
| `payments.payout-account.updated.v1`              | `status`, `fields`                                                                                           |
| `payments.kyc.submitted.v1`                       | `submissionId`                                                                                               |
| `payments.kyc.approved.v1`                        | `submissionId`, `mode`                                                                                       |
| `payments.kyc.rejected.v1`                        | `submissionId`, `decidedBy`                                                                                  |
| `payments.reconciliation.discrepancy-detected.v1` | `kind`, `reference`, `provider`                                                                              |
| `payments.provider-event.received.v1`             | interne : `provider`, `type`, `contributionId`, `providerPaymentId`, `providerAccountId`, `paymentReference` |

## Événements consommés

`payments.provider-event.received.v1` (handler `payments.queue-provider-sync` : lecture chez le prestataire dans la file `payments.provider-sync`, par la contribution, le compte de versement ou, pour une rétrofacturation Flutterwave, son `flw_ref`) ; `payments.contribution.succeeded.v1` (handler `payments.send-emails` : confirmation au contributeur, « pas un reçu fiscal »). Tâches planifiées : `expire-pending` (5 minutes), `release-orphans` (15 minutes), `reconcile` (03:30 UTC).

## Dépendances

identity (email, nom, langue, double authentification), access (enregistrement KYC et prérequis, rôles des lecteurs de pièces), profiles (pays déclaré, cartes, identifiants publics), organizations (rôle, cartes, projets soutenus), media (pièces privées), projects (projet, contrepartie, réservation, collecté).
