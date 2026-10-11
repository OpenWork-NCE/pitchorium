# 0154. Missions sans balisage d'offre d'emploi

Statut : acceptée (2026-10-11).

## Contexte

Les missions d'expertise sont du mécénat de compétences bénévole (ADR 0071) ; le cahier des charges exclut un job board (§14). Les moteurs de recherche lisent le type `JobPosting` de schema.org comme une offre d'emploi et la présentent comme telle (salaire, type de contrat, candidature).

## Décision

- Une page de mission publique a son titre, sa description et ses métadonnées (adresse canonique, langues, indexation de la vue publique), mais aucune donnée structurée `JobPosting`, ni aucun autre type d'offre ou de prix.
- L'interface ne ressemble jamais à un job board : pas de salaire, de contrat, de « postuler », de date limite de candidature mise en avant ; une mention visible dit « mission bénévole de mécénat de compétences » sur la liste, la page, le dialogue d'engagement et la page d'un engagement.
- Les refus de l'api liés à la nature bénévole (`MISSIONS_JOB_POSTING_REFUSED`, `MISSIONS_HOURS_EXCEEDED`) sont expliqués sous leur champ, avec la règle et ses bornes (8 h pour une session, 80 h pour une mission courte), plutôt qu'un simple refus.

## Conséquences

- Une mission n'apparaît pas dans les recherches d'emploi des moteurs ; elle reste indexée comme une page ordinaire quand elle est publique.
