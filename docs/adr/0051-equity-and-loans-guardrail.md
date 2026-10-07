# 0051. Garde-fou equity et prêts

Statut : acceptée (2026-10-07).

## Contexte

Promettre de l'equity en un clic sans agrément serait une faute (§9.1) ; le crowdfunding d'investissement relève du règlement ECSP (§9.5). Les flags `funding.equity` et `funding.loans` existent, désactivés, et pourraient être activés par erreur.

## Décision

- Seuls `donation`, `reward_crowdfunding` et `love_money` sont encaissés.
- Un paiement en ligne de type `equity` ou `loan` est refusé avec `PAYMENTS_LICENSED_PARTNER_REQUIRED`, quel que soit l'état des flags, tant qu'aucun adaptateur habilité n'existe ; le refus ne lit pas les flags.
- `grant`, `honor_loan` et `convertible_bonds` sont refusés avec `PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE` : ils restent des manifestations d'intérêt du module projects.

## Conséquences

- Ouvrir l'equity demandera un adaptateur habilité et une décision nouvelle, pas un flag.
