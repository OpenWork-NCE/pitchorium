# Usage de la marque dans la webapp

Le kit complet (`Pitchorium-Identite-Marque/`, version 1.0 du 7 octobre 2026, 343 fichiers) reste local, ignoré par git. `pnpm brand:sync` (`apps/web/scripts/brand-sync.mjs`) refait la sélection ci-dessous en vérifiant chaque fichier contre son SHA-256 d'`inventaire.json`. ADR 0087.

## Fichiers retenus

| Usage                                    | Fichier du kit                                                                | Dans le web                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Logo des en-têtes, clair et sombre       | `01-logos/horizontal/pitchorium-horizontal-couleur.svg` et `-fond-sombre.svg` | `BrandLogo` (SVG inline généré)                            |
| Navigation réduite, écrans étroits       | `01-logos/symbole/pitchorium-symbole-couleur.svg` et `-fond-sombre.svg`       | `BrandSymbol`                                              |
| Micro 16 à 32 px (pied de page)          | `02-icones/micro/pitchorium-micro-violet.svg` et `-blanc.svg`                 | `BrandMicro`                                               |
| Favicon                                  | `02-icones/favicon/favicon.svg` et `favicon.ico` (16 à 64 px)                 | `src/app/icon.svg`, `src/app/favicon.ico`, `public/brand`  |
| Icônes d'application                     | `02-icones/application/pitchorium-app-sombre-{180,192,512}.png`               | `src/app/apple-icon.png`, manifeste (`public/brand`)       |
| Cartouches photo                         | `01-logos/photographie/pitchorium-photo-cartouche-{clair,sombre}.svg`         | `public/brand/photo-cartouche-*.svg` (couvertures à venir) |
| Fonds discrets (auth, pages éditoriales) | `03-backgrounds/{desktop-16-9,mobile-9-16}/*-{light,dark}-discret.svg`        | `public/brand/background-*-discreet.svg`                   |
| Motif des pages (overlay)                | `03-backgrounds/{desktop-16-9,mobile-9-16}/*-overlay.svg`                     | `public/brand/overlay-*.svg` (accueil, auth, erreurs)      |
| Images de partage                        | `03-backgrounds/linkedin/*-discret-1200x627.png`, `x/*-discret-1600x900.png`  | `assets/og/` (bases de `next/og`, côté serveur)            |
| Polices et licences                      | `05-polices/`                                                                 | `public/fonts/` (`typography.md`)                          |

Écartés : versions noire, blanche seule, monochrome violette et impression d'une couleur (usages imprimés ou monochromes), compositions empilée et compacte (pas de besoin d'interface à ce stade), fonds graphiques, ultrawide, 4K, carré, slides et stories (couvertures et réseaux sociaux), PDF et PNG des logos (le SVG inline est plus léger et net), avatars des réseaux sociaux.

Optimisation : les SVG copiés perdent leur description et les blancs entre balises, la géométrie reste octet pour octet celle du kit ; les PNG sont copiés tels quels (déjà compressés) ; les logos inline sont générés depuis les SVG officiels.

## Règles du guide appliquées

- **Dessin intact** : géométrie, proportions et palette inchangées ; logotype jamais retapé (tracés du kit) ; aucun slogan, aucun monogramme. Les mots « Communauté, Entraide, Élévation » décrivent le concept et n'apparaissent pas avec le logo.
- **Un dessin pour deux thèmes** : la variante sur fond sombre du kit est la variante couleur où le violet devient le blanc de marque ; le script le vérifie, puis génère un seul SVG dont les classes `brand-ink` (violet, puis blanc de marque) et `brand-accent` (cuivre) suivent le thème. Le fond sombre du thème est le noir de marque `#121212`, fond de ces variantes officielles.
- **Placement** : logo horizontal aligné à gauche dans les en-têtes ; symbole sous 640 px.
- **Tailles minimales du dessin visible** : horizontal 224 px, symbole couleur 48 px, micro 16 px. Les fichiers incluent la marge de protection (le dessin visible occupe 94,7 % de la largeur du logo horizontal, 75,8 % du symbole) : rendus au moins à 240 px et 64 px (`BRAND_MIN_WIDTH`, imposé par les composants). Sous 32 px, seul le micro monochrome est employé.
- **Protection** : la marge transparente des fichiers est conservée ; l'alignement sur la masse visible compense 4 px à gauche.
- **Cuivre** : jamais en texte courant (2,73:1 sur blanc), jamais un bouton, un focus ni un indicateur d'état ; il reste dans le logo et le motif d'élévation (`direction.md`).
- **Animation du logo** : seulement l'apparition autorisée (opacité 0 à 1 en 220 ms, montée de 6 px), désactivée avec le mouvement réduit ; les figures restent solidaires (`animate-brand-enter`).
- **Fonds** : les fonds discrets réservent la majorité du cadre au texte ; les overlays ne remplacent jamais un logo officiel ; aucun fond ne masque le dessin.
- **Photographie** : sur une image, les cartouches clair et sombre du dossier `photographie` (aucun visuel tiers fourni).
- **Icônes d'application** : sans angles arrondis (le système découpe), déclarées `purpose: any` (la zone de sécurité des icônes masquables n'est pas garantie).

## Variantes à confirmer

- Le logo horizontal sur fond sombre n'existe dans le kit qu'avec son rectangle `#121212` : la version transparente est déduite (même dessin, fond retiré) et à valider (question 95).
- Choix de l'icône d'application sombre (fond violet) pour le manifeste et `apple-touch-icon`, plutôt que la claire.
