# Typographie

Guide de marque : titres en Bricolage Grotesque 800, texte courant en Poppins (taille 16 à 18 px, interligne 1,5), texte spécial en Edu AU VIC WA NT Hand pour de rares accents, jamais pour le logo, les formulaires ou les longs textes. ADR 0087.

## Fichiers

Écrits par `pnpm brand:sync` dans `apps/web/public/fonts` (WOFF2) et chargés par `next/font/local` (`apps/web/src/styles/fonts.ts`), avec les licences OFL à côté.

| Fichier                           | Source                                                                   | Poids     | Octets  | Chargement                  |
| --------------------------------- | ------------------------------------------------------------------------ | --------- | ------- | --------------------------- |
| `bricolage-grotesque-800.woff2`   | kit (`BricolageGrotesque-800.ttf`), chasse 100, taille optique 96 figées | 800       | 33 384  | préchargé                   |
| `poppins-400.woff2`               | kit (`Poppins-Regular.ttf`, identique au dépôt Google Fonts)             | 400       | 11 248  | préchargé                   |
| `poppins-500.woff2`               | dépôt Google Fonts `ofl/poppins/Poppins-Medium.ttf`                      | 500       | 10 976  | à l'usage                   |
| `poppins-600.woff2`               | dépôt Google Fonts `ofl/poppins/Poppins-SemiBold.ttf`                    | 600       | 11 316  | à l'usage                   |
| `edu-au-vic-wa-nt-hand-500.woff2` | kit (variable), instance 500, Latin-1 seulement                          | 500       | 164 032 | à l'usage, jamais préchargé |
| `noto-sans-fallback.woff2`        | dépôt Google Fonts `ofl/notosans/NotoSans[wdth,wght].ttf`, chasse 100    | 400 à 800 | 42 416  | selon `unicode-range`       |

Le dépôt Google Fonts est figé au commit `5e8a3ba899557829a76cfdac30fa512bda91d7ca` ; chaque fichier distant est contrôlé par son SHA-256. Licence SIL Open Font License 1.1 pour les quatre familles. Aucun faux gras : les poids 500 et 600 sont de vrais fichiers, sous le même nom de famille « Poppins » que le 400.

Sous-ensembles : latin, latin étendu A et B, alphabet phonétique, diacritiques combinants, latin étendu additionnel, ponctuation générale, symboles monétaires (les glyphes absents d'une police n'y figurent simplement pas). Métriques de repli ajustées sur Arial (`adjustFontFallback`) pour Poppins 400 et Bricolage : pas de décalage au chargement.

## Couverture des glyphes

Contrôle fonttools 4.66.1 (`TTFont.getBestCmap`) sur les fichiers du kit et du dépôt Google Fonts, le 2026-10-08 :

- **Français, anglais, swahili, créoles des Caraïbes** : couverts par Poppins et Bricolage Grotesque (accents, `œ`, `«»`, `’`, `€`).
- **Wolof** : `ŋ` et `Ŋ` absents de Poppins (présents dans Bricolage) ; `ñ`, `ë`, `é`, `à`, `ó` couverts.
- **Lingala** : `ɛ`, `Ɛ`, `ɔ`, `Ɔ` absents des deux polices, ainsi que les tons combinants (`ɛ́`, `ǎ`, `ě`) dans Poppins.
- **Noms propres africains** : absents des deux polices : `ɓ ɗ ƙ ƴ` (haoussa, peul), `ɲ ɖ ƒ ɣ ʋ` (bambara, éwé), `ẹ ọ ṣ ǹ` (yoruba, partiellement couverts par Bricolage) ; diacritiques combinants absents de Poppins.
- **Devises** : `₦`, `₵`, `₣` absents de Poppins.
- Edu AU VIC WA NT Hand : mêmes manques ; réservée aux accents en français et en anglais.

Repli : Noto Sans (OFL), conçue pour couvrir ces écritures, en sous-ensemble limité aux caractères manquants (`unicode-range` U+014A-014B, U+0181, U+0186, U+0189-018A, U+018E-0192, U+0194, U+0198-0199, U+019D, U+01B2-01B4, U+01CD-01DC, U+01F8-01F9, U+0253-0254, U+0256-0257, U+025B, U+0263, U+0272, U+028B, U+0300-036F, U+1E00-1EFF, U+20A3, U+20A6, U+20B5), variable de 400 à 800 pour suivre le poids du texte. Il se place après Poppins et Bricolage dans `font-sans` et `font-display` : le navigateur ne le télécharge que pour une page qui contient l'un de ces caractères. Un test vérifie que la `unicode-range` déclarée égale les plages du sous-ensemble.

## Hiérarchie

`h1` et `h2` en Bricolage Grotesque 800 (`text-wrap: balance`), le reste en Poppins ; poids 500 pour les libellés et boutons, 600 pour une mise en avant. Échelle dans `tokens.md`.
