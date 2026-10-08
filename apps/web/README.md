# @pitchorium/web

Application web de Pitchorium : Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI. Elle consomme `@pitchorium/api-client`, `@pitchorium/contracts` et `@pitchorium/i18n` et ne porte aucune règle métier. Architecture : `docs/architecture/frontend.md` ; décisions : ADR 0081 à 0091 ; design : `docs/design/`.

## Démarrage

```sh
cp apps/web/.env.example apps/web/.env   # NEXT_PUBLIC_API_URL : l'api locale
pnpm dev                                 # api, worker et web (http://localhost:3200)
```

L'api doit lister `http://localhost:3200` dans `WEB_APP_URL` et `CORS_ORIGINS` (`apps/server/.env.example`). Si le port 3000 de l'api est pris, `API_PORT` et `API_PUBLIC_URL` dans `apps/server/.env`, `NEXT_PUBLIC_API_URL` dans `apps/web/.env`. Page de santé de l'api en développement : `/fr/health`.

## Commandes

| Commande (dans `apps/web`) | Effet                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:web`             | serveur de développement (Turbopack), port `WEB_PORT` (3200)                                                        |
| `pnpm build`, `pnpm start` | build de production, puis serveur                                                                                   |
| `pnpm typecheck`           | types des routes (`next typegen`) puis `tsc`                                                                        |
| `pnpm lint`                | types des routes puis ESLint : règles partagées, Next.js, frontières, texte en dur, `"use client"` des routes, GSAP |
| `pnpm test`                | Vitest : composants, logique, contraste des tokens, architecture                                                    |
| `pnpm test:e2e`            | Playwright dans l'image officielle (captures comparées) ; `test:e2e:native` sans captures                           |
| `pnpm check:bundles`       | JavaScript initial par groupe de routes et absence de GSAP hors des pages éditoriales                               |
| `pnpm lighthouse`          | Lighthouse CI, profil mobile, budgets de `lighthouserc.cjs`                                                         |
| `pnpm storybook`           | design system (port 6006) ; `build-storybook` pour la version statique                                              |
| `pnpm brand:sync`          | resélectionne les fichiers du kit de marque local (`docs/design/brand-usage.md`)                                    |

Captures de référence : après un changement visuel voulu, `pnpm test:e2e --update-snapshots`, puis relire les images de `e2e/__screenshots__`.

## Règles

- Frontières (ESLint, `test/architecture/eslint.spec.ts`) : `components/ui`, `components/motion` et `components/brand` n'importent aucune feature ; une feature n'importe une autre feature que par son `index.ts` ; `app/` compose les features par leur façade et ne contient pas de logique métier ; `lib/` et `config/` n'importent aucun composant.
- Aucun texte d'interface dans le JSX : clés du namespace `web` de `@pitchorium/i18n` (français source, anglais aligné).
- `"use client"` sur les seuls composants interactifs, jamais sur une page ou un layout.
- Aucune couleur en dur : tokens de `src/styles/tokens.css`, contraste AA testé.
- Mouvement : primitives de `components/motion`, état final immédiat avec moins de mouvement ; GSAP seulement dans les pages éditoriales.
- Écritures métier : par l'api depuis le navigateur, jamais par une Server Action.

## Fichiers générés ou copiés

- `src/components/brand/marks.generated.tsx`, `public/brand/`, `public/fonts/`, `assets/og/`, `src/app/{favicon.ico,icon.svg,apple-icon.png}` : `pnpm brand:sync`, à ne pas modifier à la main.
- `e2e/__screenshots__/` : captures de référence de Playwright.
