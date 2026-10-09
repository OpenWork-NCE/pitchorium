# 0124. Cache de Turborepo et build unique en CI

Statut : acceptée (2026-10-10).

## Contexte

Chaque job de la CI restaurait son propre cache local de Turborepo (`.turbo/cache`, clé par job et par commit) : 11 tâches sur 13 du lint, 10 sur 12 du typecheck, 6 sur 8 des tests unitaires étaient déjà rejouées depuis le cache. En revanche, le web était construit trois fois par run (`build`, suite simulée, Lighthouse) et encore une fois par les parcours, avec des variables différentes que le cache de Turborepo ne porte pas (`NEXT_DIST_DIR`, adresses `NEXT_PUBLIC_*` de la pile de test).

## Décision

- Cache de Turborepo dans le cache de GitHub Actions (`actions/cache`), par job, clé `turbo-<os>-<job>-<commit>`, restauration du plus récent du même job ; pas de cache distant (Vercel Remote Cache ou serveur auto-hébergé) : il demanderait un compte ou un service à opérer et un jeton, et sortirait les artefacts de GitHub pour un gain faible, les tâches cachables étant déjà rejouées.
- Le hachage est vérifié : une modification de `packages/config` (configuration ESLint partagée) change l'empreinte du lint de `@pitchorium/server` ; les entrées du build excluent les tests et les README, celles du web incluent ses `.env*` ; le mode strict de Turborepo écarte les variables d'environnement non déclarées.
- Build unique par run (action `.github/actions/build`, job `build`) : paquets, api et worker, `.next-e2e` (variables de la pile simulée, `apps/web/scripts/build-e2e.sh`) et `.next-live` (adresses de la pile des parcours, `LIVE_BUILD_ONLY=1`), publiés comme artefact `build` (sans les caches de Next.js) et téléchargés par la suite simulée, les parcours et Lighthouse (`E2E_SKIP_BUILD`, `LIVE_SKIP_BUILD`, `LHCI_SKIP_BUILD`). Le cache de compilation de Next.js des deux builds est conservé entre les runs.
- Le store pnpm est mis en cache par `actions/setup-node`. Les navigateurs de Playwright viennent de son image officielle, épinglée (`v1.64.0-noble`), tirée en 34 s par job : un cache de l'image (2 Go à archiver puis à recharger) ne gagnerait rien de mesurable et n'est pas mis en place.

## Conséquences

- Les jobs de tests du web attendent le job `build` (2 à 3 min) puis démarrent en parallèle.
- Les parcours d'un job doivent garder le `LIVE_PORT_OFFSET` du build : les adresses font partie du build du web.
- Un artefact `build` d'environ 160 Mo par run, conservé trois jours.
