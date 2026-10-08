# @pitchorium/web

Application web de Pitchorium : Next.js 16 (App Router), React 19, Tailwind CSS 4. Elle consommera `@pitchorium/api-client`, `@pitchorium/contracts` et `@pitchorium/i18n` sans porter de règle métier (ADR 0081).

## Démarrage

```sh
cp apps/web/.env.example apps/web/.env
pnpm dev                                 # api, worker et web (http://localhost:3200)
```

| Commande (dans `apps/web`) | Effet                                                        |
| -------------------------- | ------------------------------------------------------------ |
| `pnpm dev:web`             | serveur de développement (Turbopack), port `WEB_PORT` (3200) |
| `pnpm build`, `pnpm start` | build de production, puis serveur                            |
| `pnpm typecheck`           | types des routes (`next typegen`) puis `tsc`                 |
| `pnpm lint`                | ESLint (préset `@pitchorium/config/eslint-web`)              |
| `pnpm test`                | Vitest                                                       |
| `pnpm brand:sync`          | resélectionne les fichiers du kit de marque local            |

Fichiers écrits par `pnpm brand:sync` (`docs/design/brand-usage.md`), à ne pas modifier à la main : `src/components/brand/marks.generated.tsx`, `public/brand/`, `public/fonts/`, `assets/og/`, `src/app/{favicon.ico,icon.svg,apple-icon.png}`.
