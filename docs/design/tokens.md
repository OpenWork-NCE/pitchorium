# Tokens de design

Source : `apps/web/src/styles/tokens.css` (valeurs), `apps/web/src/styles/globals.css` (thème Tailwind 4 `@theme`), ADR 0085. La palette par défaut de Tailwind est retirée : un composant ne dispose que des tokens ci-dessous.

## Couleurs de marque

Guide de marque et `palette-et-typographies.json` : violet `#3E285D`, cuivre `#CA8764`, noir `#121212`, blanc `#F7F7F5`. Le cuivre (2,73:1 sur le blanc) reste une touche graphique de la marque : jamais un texte courant, un bouton, un focus ni un indicateur d'état (`direction.md`).

## Échelles dérivées

Dérivées en OKLCH à teinte constante, les valeurs de marque servant d'ancres :

- violet 50 à 950, `violet-800` = violet de marque ;
- cuivre 50 à 950, `copper-400` = cuivre de marque ;
- neutres 0 à 950, `neutral-50` = blanc de marque, `neutral-950` = noir de marque.

## Tokens sémantiques

| Token              | Clair     | Sombre    |
| ------------------ | --------- | --------- |
| `background`       | `#f7f7f5` | `#121212` |
| `surface`          | `#ffffff` | `#1a191c` |
| `surface-elevated` | `#ffffff` | `#232127` |
| `surface-sunken`   | `#efeeea` | `#0c0c0c` |
| `foreground`       | `#121212` | `#f7f7f5` |
| `muted`            | `#5e5b56` | `#aba7b0` |
| `border`           | `#e3e1dc` | `#34313a` |
| `border-strong`    | `#8c8882` | `#7a7681` |
| `accent`           | `#3e285d` | `#b8a9d3` |
| `accent-strong`    | `#2c1c44` | `#d6cce6` |
| `on-accent`        | `#f7f7f5` | `#121212` |
| `accent-subtle`    | `#eae4f2` | `#2c2438` |
| `on-accent-subtle` | `#3e285d` | `#d6cce6` |
| `link`             | `#3e285d` | `#c9bce2` |
| `highlight`        | `#ca8764` | `#ca8764` |
| `on-highlight`     | `#121212` | `#121212` |
| `success`          | `#1e7a4c` | `#5bc48c` |
| `warning`          | `#8f5406` | `#e5a54b` |
| `danger`           | `#b42318` | `#f28b80` |
| `info`             | `#2457a6` | `#8db2ee` |
| `on-status`        | `#ffffff` | `#121212` |
| `focus`            | `#614b83` | `#d6cce6` |
| `overlay`          | noir 56 % | noir 64 % |

Tokens de surfaces propres : `brand-panel` et `on-brand-panel` (panneau de marque de l'authentification : `#3e285d` en clair, `#2c1c44` en sombre, texte `#f7f7f5` ; violet profond dans les deux thèmes, jamais lavande, testé par `contrast.spec.ts`), `cover-placeholder` (couverture d'un projet sans image : `#eae4f2` en clair, `#2c1c44` en sombre, le motif d'élévation éclairci pour rester lisible), `message-received` (bulle reçue : `#efeeea` en clair, `#2a2830` en sombre, un cran plus clair que la carte, jamais plus foncé).

Tokens des composants : `track` (rail d'une barre de progression), `skeleton` et `skeleton-shine` (squelettes), et six paires `avatar-N-bg` et `avatar-N-fg` pour les initiales des avatars, choisies par le nom, chacune à 4,5:1 au moins dans les deux thèmes. Le thème sombre s'applique aussi à un sous-arbre marqué `data-theme="dark"` (vue côte à côte du design system).

Chaque statut a sa variante `-subtle` (fond d'un message). Le thème sombre repose sur le noir de marque, fond des logos officiels en version sombre. Les tons du logo suivent le thème : `--logo-ink` (violet, puis blanc de marque) et `--logo-accent` (cuivre).

## Contraste vérifié (WCAG 2.2 AA)

`apps/web/src/styles/contrast.spec.ts` contrôle chaque paire dans les deux thèmes : 4,5:1 pour un texte, 3:1 pour une bordure de champ, le focus et l'accent comme indicateur. Valeurs principales :

- `foreground` sur `background` : 17,46:1 en clair, 17,46:1 en sombre
- `foreground` sur `surface` : 18,73:1 en clair, 16,32:1 en sombre
- `muted` sur `background` : 6,30:1 en clair, 7,93:1 en sombre
- `muted` sur `surface-sunken` : 5,82:1 en clair, 8,28:1 en sombre
- `link` sur `background` : 11,75:1 en clair, 10,50:1 en sombre
- `on-accent` sur `accent` : 11,75:1 en clair, 8,61:1 en sombre ; sur `accent-strong` (remplissage H21) : 14,43:1 en clair, 12,17:1 en sombre
- `on-highlight` sur `highlight` : 6,39:1 dans les deux thèmes
- `success`, `warning`, `danger`, `info` sur `background` : de 4,96:1 à 6,55:1 en clair, de 7,83:1 à 8,76:1 en sombre
- statuts sur leur fond `-subtle` : de 4,60:1 à 5,91:1 en clair, de 6,87:1 à 7,38:1 en sombre
- `border-strong` sur `background` : 3,29:1 en clair, 4,22:1 en sombre
- `focus` sur `background` : 6,89:1 en clair, 12,17:1 en sombre

## Typographie

Échelle fluide (`clamp`) sur la progression 18 / 29 / 47 du guide (rapport proche de 1,618) : `text-xs` 12 px, `text-sm` 14 px, `text-base` 16 à 17 px, `text-lg` 18 px, `text-xl` 20 à 24 px, `text-2xl` 24 à 29 px, `text-3xl` 30 à 38 px, `text-4xl` 36 à 47 px, `text-5xl` 44 à 76 px. Interligne 1,5 pour le texte (guide), 1,05 à 1,3 pour les titres. Familles : `font-sans` (Poppins), `font-display` (Bricolage Grotesque 800, `h1` et `h2`), `font-hand` (Edu AU VIC WA NT Hand, rares accents). Détail dans `typography.md`.

## Espaces, rayons, ombres, couches, points de rupture

- Espaces : pas de 0,25 rem (`p-4` = 16 px), gouttière de 16 px sur mobile.
- Rayons : `xs` 4 px, `sm` 6 px, `md` 10 px, `lg` 14 px, `xl` 20 px, `2xl` 28 px, boutons en pilule.
- Ombres `xs` à `lg`, teinte du noir de marque, plus marquées en sombre.
- Couches : `--z-raised` 10, `--z-sticky` 30, `--z-header` 40, `--z-overlay` 50, `--z-modal` 60, `--z-toast` 70, `--z-skip-link` 80.
- Points de rupture : `xs` 384 px, `sm` 640 px, `md` 768 px, `lg` 1 024 px, `xl` 1 280 px, `2xl` 1 536 px.

## Mouvement

Courbes `--ease-enter` `cubic-bezier(0.16, 1, 0.3, 1)` et `--ease-curtain` `cubic-bezier(0.76, 0, 0.24, 1)` ; durées `press` 150 ms, `micro` 200 ms, `page` 320 ms, `reveal` 600 ms, `fill` 800 ms, `theme` 700 ms, `counter` 1 400 ms. Mêmes valeurs dans `components/motion/tokens.ts` (test d'égalité). Détail dans `motion.md`.
