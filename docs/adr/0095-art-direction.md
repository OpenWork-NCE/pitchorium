# 0095. Direction artistique

Statut : acceptée (2026-10-08).

## Contexte

Le socle a posé les tokens, la marque et le mouvement, sans dire comment les assembler. Le design system complet et les coquilles (PROMPT FRONT 1), puis toutes les pages métier, ont besoin d'un contrat visuel unique pour qu'un écran de messagerie, une page de projet et une console d'administration appartiennent au même produit. Le cahier des charges veut un réseau d'affaires, pas un réseau photo (§6.2, §10), web d'abord, la même information empilée sur téléphone (§4, §6.1).

## Décision

- `docs/design/direction.md` est le contrat visuel, écrit avant les composants : principes (réseau d'affaires premium, sobre et chaleureux, éditorial, une matière, un seul accent dominant), grille de 12 colonnes et conteneurs, disposition à trois colonnes et son empilement, densité confortable (dense en administration seulement), hiérarchie typographique appliquée, iconographie (lucide, trait de 1,75, tailles de 16, 20 et 24 px), imagerie (ratios des variantes du module media, avatars, couvertures, cartouches), états vides, de chargement, d'erreur et hors ligne, surfaces et élévation, interdits.
- Le violet est le seul accent dominant ; le cuivre reste une touche (remplissage H21, focus en sombre, trait du palier atteint), jamais un indicateur d'état, que son contraste sur fond clair (2,73:1) ne permet pas.
- La police manuscrite est réservée aux pages éditoriales publiques : un test d'architecture refuse `font-hand` ailleurs.
- `docs/design/components.md` (inventaire et règles d'usage) et `docs/design/patterns.md` (formulaires, chargement, vide, hors ligne, confirmation destructrice, autorisations) appliquent ce contrat.

## Conséquences

- Une revue de design compare les captures de référence (`docs/design/review/`) à ce document.
- Une exception (une nouvelle surface, une troisième taille d'icône, une couleur) passe par une mise à jour de `direction.md` dans le même commit que le code.
- Les choix dérivés du guide de marque (ratios recadrés sur téléphone, épaisseur de trait, densité) restent à valider par la marque (question 101).
