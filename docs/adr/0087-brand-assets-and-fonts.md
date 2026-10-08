# 0087. Fichiers de marque et polices

Statut : acceptée (2026-10-08).

## Contexte

Le kit de marque complet (`Pitchorium-Identite-Marque/`, 343 fichiers) reste local comme le cahier des charges. Le web n'en utilise qu'une partie, qui doit rester fidèle au dessin validé. Le kit ne fournit que Poppins Regular, et ni Poppins ni Bricolage Grotesque ne couvrent tous les caractères des langues visées.

## Décision

- `pnpm brand:sync` (`apps/web/scripts/brand-sync.mjs`) refait la sélection depuis le kit : chaque fichier lu est vérifié contre son SHA-256 d'`inventaire.json`, les polices distantes sont figées par commit du dépôt officiel Google Fonts et par SHA-256. Liste et raisons dans `docs/design/brand-usage.md`.
- Logos rendus en SVG inline générés depuis les fichiers officiels (`components/brand/marks.generated.tsx`) : le script vérifie que la variante sur fond sombre est la variante couleur avec le violet remplacé par le blanc de marque, puis rend les deux par un seul dessin dont la teinte suit le thème. Géométrie, proportions et palette inchangées ; le logotype n'est jamais retapé.
- Polices en WOFF2 sous-ensembles (latin, latin étendu, diacritiques combinants, latin étendu additionnel), chargées par `next/font/local` avec métriques de repli ajustées : Bricolage Grotesque 800 (instance du kit, chasse normale, taille optique 96), Poppins 400, 500 et 600 (500 et 600 du dépôt Google Fonts, licence OFL), Edu AU VIC WA NT Hand 500 (Latin-1, jamais préchargée). Seules Poppins 400 et Bricolage 800 sont préchargées.
- Repli Noto Sans (OFL), sous-ensemble limité aux caractères absents de Poppins et Bricolage (ŋ, ɛ, ɔ, ɓ, ɗ, ƙ, ẹ, ọ...), déclaré par `unicode-range` : téléchargé seulement par une page qui en contient (`docs/design/typography.md`).

## Conséquences

- Une nouvelle version du kit se reprend par `pnpm brand:sync`, puis revue des fichiers générés.
- Les poids 500 et 600 de Poppins et Noto Sans ne viennent pas du kit : leur usage est à valider par la marque (question 99).
