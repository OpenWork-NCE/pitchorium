# 0039. Verrouillage des montants après la première contribution

Statut : acceptée (2026-10-08)

## Contexte

Un contributeur paie selon les conditions affichées : objectif, paliers et contrepartie choisie (§9.3). Les modifier ensuite changerait rétroactivement ce qu'il a accepté. Les textes, eux, doivent rester corrigibles et l'équipe doit pouvoir informer.

## Décision

- La première contribution appliquée (`applyFunding`) enregistre `first_contribution_at` sur le projet. À partir de là, l'objectif, les seuils des paliers et les montants minimums des contreparties existantes sont refusés en modification (`PROJECTS_FUNDING_LOCKED`). Une nouvelle contrepartie reste possible.
- Les textes (titre, résumé, description, usages des paliers, descriptions et quantités des contreparties dans la limite des unités prises, médias) restent modifiables. Toute modification d'un projet publié est écrite au journal d'audit avec les noms des champs (`projects.project-updated`).
- Avant la première contribution, un projet publié peut encore ajuster ses montants ; la durée, elle, ne change plus après la publication (pas de prolongation, ADR 0038).

## Conséquences

- Le verrou ne se lève pas, même si toutes les contributions sont annulées : la page a été publiée avec ces conditions.
- Le module payments n'a pas à vérifier la cohérence des montants : ils ne bougent plus après le premier paiement.
