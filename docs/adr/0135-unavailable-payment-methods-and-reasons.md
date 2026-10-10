# 0135. Moyens indisponibles et motifs

Statut : acceptée (2026-10-10).

## Contexte

Les options de paiement d'un projet ne donnaient que les moyens disponibles et un seul motif d'indisponibilité du projet (`project_not_open`, `holder_not_ready`, `no_payment_route`). Un contributeur ne savait pas pourquoi un moyen attendu manquait (Mobile Money hors de son pays, devise, montant), un porteur sans compte couvert se confondait avec un porteur en attente de KYC, et le devis pouvait refuser un moyen pour une raison que les options ne disaient pas.

## Décision

- Disponibilité du projet, un code : `open`, `campaign_closed`, `funding_frozen`, `holder_without_covered_payout_account`, `holder_not_verified`, vérifiés dans cet ordre. La campagne gelée par la modération est distinguée de la campagne clôturée : dire « clôturée » serait faux.
- Chaque moyen que propose un prestataire actif est disponible ou indisponible avec un motif, examiné dans cet ordre : `not_covered_by_holder_rail`, `contributor_country_not_covered`, `currency_not_supported`, `amount_out_of_range`. Le pays du contributeur est celui de son profil ou celui fourni pour ce paiement ; la devise et le montant sont facultatifs.
- Une seule fonction du domaine (`evaluatePayments`) décide pour les options, le devis et la création, avec les bornes de la plateforme converties au taux que la session fige ensuite : un moyen affiché indisponible est refusé avec le même motif (`reason` du problème RFC 9457, ADR 0106).
- Les options exposent le rail du projet (prestataire, pays et devise du compte de versement du porteur) : il découle du compte actif du porteur et le front décide de le montrer.
- `PAYMENTS_HOLDER_PAYOUT_NOT_COVERED` remplace le cas sans compte de `PAYMENTS_HOLDER_NOT_READY` ; `PAYMENTS_NO_PAYMENT_ROUTE` disparaît (un contributeur sans moyen voit les motifs de chaque moyen).

## Conséquences

- Le front explique chaque absence sans recalculer de règle (ADR 0113) ; les motifs sont des codes libellés dans `packages/i18n`.
- Les bornes de chaque moyen sont données par moyen, celles d'une devise sont la plus petite et la plus grande de ses moyens.
