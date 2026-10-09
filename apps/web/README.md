# @pitchorium/web

Application web de Pitchorium : Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI. Elle consomme `@pitchorium/api-client`, `@pitchorium/contracts` et `@pitchorium/i18n` et ne porte aucune règle métier. Architecture : `docs/architecture/frontend.md` ; décisions : ADR 0081 à 0091 ; design : `docs/design/`.

## Démarrage

```sh
cp apps/web/.env.example apps/web/.env   # NEXT_PUBLIC_API_URL : l'api locale
pnpm dev                                 # api, worker et web (http://localhost:3200)
```

L'api doit lister `http://localhost:3200` dans `WEB_APP_URL` et `CORS_ORIGINS` (`apps/server/.env.example`). Si le port 3000 de l'api est pris, `API_PORT` et `API_PUBLIC_URL` dans `apps/server/.env`, `NEXT_PUBLIC_API_URL` dans `apps/web/.env`. Page de santé de l'api en développement : `/fr/health`.

## Commandes

| Commande (dans `apps/web`) | Effet                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:web`             | serveur de développement (Turbopack), port `WEB_PORT` (3200)                                                                                                                                                                                                                                                                                                |
| `pnpm build`, `pnpm start` | build de production, puis serveur                                                                                                                                                                                                                                                                                                                           |
| `pnpm typecheck`           | types des routes (`next typegen`) puis `tsc`                                                                                                                                                                                                                                                                                                                |
| `pnpm lint`                | types des routes puis ESLint : règles partagées, Next.js, React et hooks, accessibilité (jsx-a11y), frontières, texte en dur, `"use client"` des routes, GSAP                                                                                                                                                                                               |
| `pnpm test`                | Vitest : composants, logique, contraste des tokens, architecture                                                                                                                                                                                                                                                                                            |
| `pnpm test:stories`        | chaque story comme un test (fonction `play` et addon d'accessibilité, les deux thèmes, mouvement réduit) dans l'image Playwright ; `test:stories:native` avec le Chromium local                                                                                                                                                                             |
| `pnpm test:e2e`            | Playwright dans l'image officielle, Chromium, Firefox, WebKit et iPhone (WebKit), captures comparées sous Chromium, session ouverte sur l'api simulée avec les comptes de démonstration ; `test:e2e:native` sans captures                                                                                                                                   |
| `pnpm test:e2e:live`       | parcours d'authentification contre la vraie api (`e2e-live`, `playwright.live.config.ts`) : web, api, worker et Mailpit lancés (`pnpm infra:up`, `pnpm dev`), origines par `LIVE_WEB_URL` et `MAILPIT_URL` ; inscription et Mailpit, lien magique, réinitialisation, double authentification, sessions, prérequis, redirection ouverte, limite de fréquence |
| `pnpm check:bundles`       | JavaScript initial par groupe de routes (budgets de l'ADR 0094), primitives Radix de chaque page, bibliothèques hors de leurs groupes (GSAP, Socket.IO, client d'authentification)                                                                                                                                                                          |
| `pnpm lighthouse`          | Lighthouse CI, profil mobile, budgets de `lighthouserc.cjs`                                                                                                                                                                                                                                                                                                 |
| `pnpm storybook`           | design system (port 6006) ; `build-storybook` pour la version statique                                                                                                                                                                                                                                                                                      |
| `pnpm review:captures`     | captures des compositions de référence, deux thèmes, 1280x800 et 390x844, dans l'image Playwright (`docs/design/review`)                                                                                                                                                                                                                                    |
| `pnpm brand:sync`          | resélectionne les fichiers du kit de marque local (`docs/design/brand-usage.md`)                                                                                                                                                                                                                                                                            |

Storybook prégroupe les packages du dépôt (`.storybook/main.ts`) : après une modification de `@pitchorium/i18n` ou des contrats, supprimer `node_modules/.cache/storybook` avant `test:stories:native`.

Captures de référence : après un changement visuel voulu, `pnpm test:e2e --project=chromium --update-snapshots`, puis relire les images de `e2e/__screenshots__`.

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
