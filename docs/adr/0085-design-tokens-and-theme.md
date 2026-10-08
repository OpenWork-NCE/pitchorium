# 0085. Tokens de design et thème

Statut : acceptée (2026-10-08).

## Contexte

La marque fournit quatre couleurs (violet `#3E285D`, cuivre `#CA8764`, noir `#121212`, blanc `#F7F7F5`) et ses règles (cuivre réservé aux accents, 2,73:1 sur blanc). Une interface a besoin de surfaces, d'états et de couleurs de statut, lisibles en clair et en sombre.

## Décision

- Tailwind CSS 4.3 en configuration CSS (`@theme` de `src/styles/globals.css`), palette par défaut de Tailwind retirée : seuls les tokens existent, aucune couleur en dur dans les composants.
- `src/styles/tokens.css` : couleurs de marque, échelles dérivées en OKLCH avec les valeurs de marque pour ancres, tokens sémantiques en clair et en sombre (fond, surfaces, texte, texte atténué, bordures, accent, accent appuyé, surlignage cuivre, succès, alerte, danger, information, focus, superposition), ombres, couches et mouvement (`docs/design/tokens.md`).
- Le thème sombre repose sur le noir de marque : les variantes officielles du logo sur fond sombre s'y posent telles quelles.
- Contraste WCAG 2.2 AA de chaque paire texte et fond testé dans les deux thèmes (`src/styles/contrast.spec.ts`, 4,5:1 pour le texte, 3:1 pour les indicateurs).
- Thème par `next-themes` (clair, sombre, système), attribut `data-theme` sur `<html>`, script inline avec le nonce CSP avant la première peinture : aucun flash (test de bout en bout sans JavaScript de l'application).

## Conséquences

- Une nouvelle couleur passe par un token et sa paire de contraste testée.
- Les couleurs de statut sont dérivées, pas issues du guide : leur validation est demandée (question 99).
