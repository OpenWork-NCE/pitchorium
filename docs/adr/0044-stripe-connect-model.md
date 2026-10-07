# 0044. Modèle Stripe Connect retenu

Statut : acceptée (2026-10-07).

## Contexte

Stripe Connect combine un type de compte connecté (Standard, Express, Custom, ou des propriétés `controller` équivalentes) et un type de charge (directe, de destination, séparée avec transfert). Deux critères départagent : Pitchorium ne doit pas détenir les fonds (ADR 0043), et ne doit pas porter la responsabilité des litiges et des pertes des porteurs. Sources : docs.stripe.com/connect/charges, /connect/accounts, /connect/migrate-to-controller-properties, /connect/direct-charges (consultées le 2026-10-07).

| Option                                                     | Où arrivent les fonds                                                           | Litiges, remboursements, pertes                                                                 | Évaluation                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Charge de destination ou séparée                           | Solde de la plateforme, puis transfert                                          | Débités du solde de la plateforme ; la plateforme est marchand de référence sans `on_behalf_of` | Contraire à la non-détention                                        |
| Express (`losses.payments = application`) + charge directe | Solde du compte connecté                                                        | Plateforme responsable des pertes et des litiges                                                | Responsabilité refusée ; charges directes déconseillées sur Express |
| Standard (ou `controller` équivalent) + charge directe     | Solde du compte connecté ; la plateforme ne reçoit que `application_fee_amount` | Remboursements et litiges débités du compte connecté ; Stripe responsable des soldes négatifs   | Retenu                                                              |

## Décision

- Comptes connectés équivalents à Standard, créés avec les propriétés `controller` que Stripe recommande au lieu du type : `fees.payer = account`, `losses.payments = stripe`, `requirement_collection = stripe`, `stripe_dashboard.type = full`. Onboarding et vérification d'identité hébergés par Stripe (`account_links`).
- Charges directes par Checkout (`Stripe-Account`), commission en `payment_intent_data.application_fee_amount`, référence de la contribution en `client_reference_id` et en métadonnée, expiration `expires_at` (30 minutes à 24 heures).
- Remboursements avec `refund_application_fee=true` : Stripe rend la commission au prorata.
- Webhooks Connect (événements des comptes connectés) sur un seul point d'entrée, signature `Stripe-Signature` vérifiée sur le corps brut.
- Pays de versement : zone euro où Stripe est disponible. L'Afrique n'est servie que par le « extended network » (Paystack) et les versements transfrontaliers d'une plateforme EEE ne vont qu'aux US, UK, EEE, Canada et Suisse : non retenus.

## Conséquences

- Le porteur a un vrai compte Stripe avec son tableau de bord, et en porte les frais et les litiges ; il doit accepter le contrat Stripe.
- PayPal est exclu : non pris en charge avec les charges directes.
- La commission n'est pas rendue d'office par Stripe sur un litige perdu (question ouverte).
