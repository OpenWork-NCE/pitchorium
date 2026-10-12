# 0169. Détection de la langue par franc complet

Statut : acceptée (2026-10-12).

## Contexte

La langue d'un contenu de membre décide si « Traduire » est proposé (§8.3, ADR 0167). Le noyau la détectait avec `franc-min` (82 langues), qui ne connaît pas le wolof, une langue de la plateforme (§8.2). Un texte en wolof restait sans langue : aucune traduction n'était proposée.

## Décision

- `detectLanguage` (`platform/kernel/language.ts`) utilise `franc` 6.2.0, la version complète (187 langues), qui couvre le français, l'anglais, le swahili, le wolof et le lingala. Le serveur seul l'exécute : le poids du paquet ne compte pas pour le web.
- La détection compare le texte à toutes les langues connues de `franc`, puis ne retient le résultat que s'il est l'une des cinq langues de la plateforme ; sinon la langue reste indéterminée (`null`). La restriction par `only` aux cinq langues a été écartée : elle nomme l'une d'elles pour tout texte (un texte allemand devenait anglais, un texte portugais français), et l'interface proposerait une traduction depuis une langue qui n'est pas celle du texte.
- Seuil inchangé : 10 caractères au moins.
- Les publications gardent leur langue détectée en base ; `pnpm content:redetect-languages` la recalcule pour celles dont l'auteur ne l'a pas déclarée (par lots, idempotent, sans marquer la publication modifiée, avec `content.post.updated.v1` pour la recherche). Les autres contenus (commentaires, messages, profils, projets, missions) sont détectés à la lecture et suivent aussitôt.

## Conséquences

- Tests sur des textes réels de chaque langue (`language.spec.ts`), dont des phrases écrites comme les membres les écrivent et l'article premier de la Déclaration universelle des droits de l'homme en swahili, wolof et lingala.
- Limite connue : une phrase wolof courte et familière peut être lue comme une langue voisine (haoussa, peul) et rester sans langue ; aucune traduction n'est alors proposée, ce qui vaut mieux qu'une traduction depuis une mauvaise langue.
- La commande est à lancer une fois après le déploiement de ce changement (`docs/operations/deployment.md`).
