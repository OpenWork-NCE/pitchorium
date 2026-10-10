# 0081. Application web Next.js 16

Statut : acceptée (2026-10-08).

## Contexte

Le frontend (`apps/web`, place réservée depuis l'ADR 0001) doit servir des pages publiques indexables et un espace membre riche, rapide sur un Android milieu de gamme en 4G autant que sur un ordinateur (§4, §6.1), en consommant les contrats, le client d'api et les catalogues existants sans les dupliquer.

## Décision

- Next.js 16.4 (App Router), React 19.3, TypeScript 6.0.3 strict (même version que le reste du dépôt, ADR 0012), Turbopack pour `next dev` et `next build` (défaut de Next.js 16).
- Nouveautés de Next.js 16 appliquées : `src/proxy.ts` (ex-middleware, environnement Node.js imposé), API asynchrones (`params`, `headers()`, `cookies()`), types de routes par `next typegen` (`PageProps`, `LayoutProps`, lancé par `pnpm typecheck`), React Compiler stable (`reactCompiler: true`), View Transitions de React 19.3 (`<ViewTransition>`) sans option, `next lint` supprimé (ESLint direct), analyseur de bundles Turbopack (`next analyze`), `images.qualities` et refus des IP locales par défaut (`dangerouslyAllowLocalIP` seulement pour MinIO en local).
- Non activés : `cacheComponents` (toutes les pages sont rendues à la requête pour le nonce CSP, ADR 0088 ; le cache sera étudié avec les premières pages publiques de données), `typedRoutes` (la navigation passe par `next-intl`, qui type ses propres liens).
- Routes par groupes : `(marketing)`, `(auth)`, `(app)`, `(public)`, `(admin)` sous `[locale]`, et `(dev)` pour les outils de développement (page de santé, 404 en production).
- Port local 3200 (`WEB_PORT`) ; `pnpm dev` lance l'api, le worker et le web.

## Conséquences

- Aucune page n'est statique : le coût est un rendu serveur par requête, compensé par le cache CDN des fichiers statiques et la rapidité du HTML rendu (LCP mesuré à 1,6 s en 4G lente, ADR 0090).
- Le build ne compile que le web ; l'image du serveur n'installe et ne construit que le serveur et ses packages (`Dockerfile`).

## Versions retenues

Dernières versions stables au 2026-10-08, figées exactement (ADR 0012). Publiées depuis moins de 24 heures, donc exclues du délai minimal de pnpm (`minimumReleaseAgeExclude`) : `lucide-react` 1.53.0, `nuqs` 2.10.2, `@playwright/test`, `playwright` et `playwright-core` 1.64.0. TypeScript reste en 6.0.3 comme le reste du dépôt (la 7 n'est pas acceptée par `typescript-eslint`).

| Paquet                        | Version |
| ----------------------------- | ------- |
| `@axe-core/playwright`        | 4.13.0  |
| `@gsap/react`                 | 2.1.2   |
| `@lhci/cli`                   | 0.15.1  |
| `@next/eslint-plugin-next`    | 16.4.0  |
| `@playwright/test`            | 1.64.0  |
| `@sentry/nextjs`              | 11.5.0  |
| `@storybook/addon-a11y`       | 10.6.1  |
| `@storybook/addon-docs`       | 10.6.1  |
| `@storybook/nextjs-vite`      | 10.6.1  |
| `@t3-oss/env-nextjs`          | 0.13.11 |
| `@tailwindcss/postcss`        | 4.3.3   |
| `@tanstack/react-query`       | 5.104.1 |
| `@testing-library/dom`        | 10.4.2  |
| `@testing-library/react`      | 16.3.3  |
| `@types/node`                 | 24.19.1 |
| `@types/react`                | 19.3.0  |
| `@types/react-dom`            | 19.3.0  |
| `@vercel/analytics`           | 2.0.1   |
| `@vercel/speed-insights`      | 2.0.0   |
| `@vitejs/plugin-react`        | 6.1.2   |
| `babel-plugin-react-compiler` | 1.0.0   |
| `better-auth`                 | 1.7.7   |
| `class-variance-authority`    | 0.7.1   |
| `clsx`                        | 2.1.1   |
| `eslint`                      | 10.12.0 |
| `eslint-plugin-react-hooks`   | 7.1.1   |
| `eslint-plugin-storybook`     | 10.6.1  |
| `gsap`                        | 3.15.0  |
| `icu-minify`                  | 4.14.9  |
| `jsdom`                       | 30.1.2  |
| `lucide-react`                | 1.53.0  |
| `motion`                      | 14.0.0  |
| `next`                        | 16.4.0  |
| `next-intl`                   | 4.14.9  |
| `next-themes`                 | 0.4.6   |
| `nuqs`                        | 2.10.2  |
| `prettier`                    | 3.9.9   |
| `prettier-plugin-tailwindcss` | 0.8.1   |
| `radix-ui`                    | 1.7.0   |
| `react`                       | 19.3.0  |
| `react-dom`                   | 19.3.0  |
| `schema-dts`                  | 2.1.0   |
| `server-only`                 | 0.0.1   |
| `socket.io-client`            | 4.8.4   |
| `sonner`                      | 2.0.8   |
| `storybook`                   | 10.6.1  |
| `subset-font`                 | 2.9.0   |
| `tailwind-merge`              | 3.7.0   |
| `tailwindcss`                 | 4.3.3   |
| `typescript`                  | 6.0.3   |
| `vite`                        | 8.3.4   |
| `vitest`                      | 5.0.3   |
| `zod`                         | 4.6.5   |
