# 0053. Projection du module engagement

Statut : acceptée (2026-10-07).

## Contexte

Le tableau de bord d'impact montre les euros effectivement versés, les projets soutenus et les heures déclarées (§9.4), pour un membre et pour une organisation. Les contributions appartiennent au module payments, dont engagement ne lit pas les tables.

## Décision

- engagement tient une projection (`engagement.contribution_facts`) : une ligne par contribution, avec l'équivalent EUR net des remboursements et des litiges perdus.
- Les événements `payments.contribution.succeeded`, `refunded` et `dispute-resolved` ne servent que de signal : le handler relit l'état courant par `PaymentsFacade.contributionFacts`, puis remplace la ligne. Un événement rejoué ou en retard donne la même ligne.
- La projection se reconstruit en la vidant puis en rejouant toutes les contributions par la façade (`EngagementService.rebuild`).
- Les heures viennent des déclarations propres au module (journal du temps partagé), confirmées ou contestées par le bénéficiaire.
- Un membre compte ses contributions en son nom ; une organisation, celles faites en son nom.

## Conséquences

- Le tableau de bord ne dépend ni de l'ordre ni de la livraison unique des événements.
- Les contributions hors plateforme validées ne comptent pas dans les euros versés (§9.4 : contributions réussies).
