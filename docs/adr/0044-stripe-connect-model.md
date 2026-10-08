# 0044. Modèle Stripe Connect retenu

Statut : acceptée (2026-10-07), création des comptes passée à Accounts v2 le 2026-10-08.

## Contexte

Stripe Connect combine un type de compte connecté (Standard, Express, Custom, ou des propriétés `controller` équivalentes) et un type de charge (directe, de destination, séparée avec transfert). Deux critères départagent : Pitchorium ne doit pas détenir les fonds (ADR 0043), et ne doit pas porter la responsabilité des litiges et des pertes des porteurs. Sources : docs.stripe.com/connect/charges, /connect/accounts, /connect/migrate-to-controller-properties, /connect/direct-charges (consultées le 2026-10-07).

| Option                                                     | Où arrivent les fonds                                                           | Litiges, remboursements, pertes                                                                 | Évaluation                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Charge de destination ou séparée                           | Solde de la plateforme, puis transfert                                          | Débités du solde de la plateforme ; la plateforme est marchand de référence sans `on_behalf_of` | Contraire à la non-détention                                        |
| Express (`losses.payments = application`) + charge directe | Solde du compte connecté                                                        | Plateforme responsable des pertes et des litiges                                                | Responsabilité refusée ; charges directes déconseillées sur Express |
| Standard (ou `controller` équivalent) + charge directe     | Solde du compte connecté ; la plateforme ne reçoit que `application_fee_amount` | Remboursements et litiges débités du compte connecté ; Stripe responsable des soldes négatifs   | Retenu                                                              |

## Décision

- Comptes connectés équivalents à Standard. Depuis le 2026-10-08, Stripe refuse la création par Accounts v1 pour une nouvelle intégration Connect (constaté en mode test) : création par Accounts v2 (`POST /v2/core/accounts`, en-tête `Stripe-Version` figé dans `STRIPE_V2_API_VERSION`, `2026-09-30.endive`), configuration `merchant` (`card_payments`, `sepa_debit_payments`), `dashboard = full`, `defaults.responsibilities` : `fees_collector = stripe`, `losses_collector = stripe` (équivalents des anciennes propriétés `controller`). Une plateforme établie en France ne peut transmettre l'identité du porteur (email, nom) que par des jetons de compte : aucune donnée d'identité n'est envoyée, Stripe la collecte pendant l'onboarding hébergé (`/v1/account_links`, compatible avec les comptes v2). L'état est relu par `GET /v1/accounts/{id}`, qui sert aussi les comptes v2.
- Charges directes par Checkout (`Stripe-Account`), commission en `payment_intent_data.application_fee_amount`, référence de la contribution en `client_reference_id` et en métadonnée, expiration `expires_at` (30 minutes à 24 heures).
- Remboursements avec `refund_application_fee=true` : Stripe rend la commission au prorata.
- Webhooks Connect (événements des comptes connectés) sur un seul point d'entrée, signature `Stripe-Signature` vérifiée sur le corps brut. La transaction de solde, qui porte les frais Stripe, est rattachée à la charge quelques secondes après le paiement (`balance_transaction` nul jusque-là) : les frais sont enregistrés à une synchronisation suivante, déclenchée notamment par `charge.updated`, auquel l'endpoint doit être abonné.
- Pays de versement : zone euro où Stripe est disponible. L'Afrique n'est servie que par le « extended network » (Paystack) et les versements transfrontaliers d'une plateforme EEE ne vont qu'aux US, UK, EEE, Canada et Suisse : non retenus.

## Conséquences

- Le porteur a un vrai compte Stripe avec son tableau de bord, et en porte les frais et les litiges ; il doit accepter le contrat Stripe.
- PayPal est exclu : non pris en charge avec les charges directes.
- La commission n'est pas rendue d'office par Stripe sur un litige perdu (question ouverte).
