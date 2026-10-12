# Vérification et tests

Trois niveaux de vérification (ADR 0123). Aucune garantie n'est retirée : une vérification lourde change de moment, elle ne disparaît pas. Chaque vérification figure au niveau 3 ; les niveaux 1 et 2 en exécutent un sous-ensemble plus tôt.

## Niveau 1 : boucle de développement

Pendant le travail, sur le poste, seulement ce qui est touché, en continu :

- `pnpm check:changed` : lint et typecheck, puis tests unitaires, des paquets modifiés depuis `origin/main` (modifications non commitées comprises ; `CHANGED_BASE` pour une autre base) et de leurs dépendants (`turbo run … --filter=...[origin/main]`). Les tests passent après les contrôles statiques : les tests de frontières du serveur écrivent un instant dans `src/` des fichiers qui enfreignent les règles.
- Un test et ceux qui dépendent d'un fichier : `pnpm --filter <paquet> exec vitest related <fichiers> --run`.
- Tests d'intégration ciblés : `pnpm --filter @pitchorium/server exec vitest run -c vitest.integration.config.mts test/integration/<fichier>.spec.ts`.
- Parcours simulés, Chromium seulement, filtrés : `pnpm --filter @pitchorium/web test:e2e --project=chromium e2e/<fichier>.spec.ts` (ou `--grep <étiquette>`) ; `E2E_SKIP_BUILD=1` sert le build `.next-e2e` déjà présent.
- Parcours contre la vraie api, filtrés : `pnpm --filter @pitchorium/web test:e2e:live --project=chromium --grep <titre>` ; `LIVE_SKIP_BUILD=1` réutilise les builds.

Ni `verify:clean`, ni Lighthouse, ni captures de revue à ce niveau.

Tests unitaires et stories ensemble (`vitest run` sans `--project`, FRONT 7, A3) : permis et vert. `active-locales.spec` y dépassait son délai : il relit un module neuf à chaque test (`vi.resetModules`) et faussait toutes les horloges avant de l'importer ; à côté des stories, l'import attendait la transformation par le lanceur de modules, dont les minuteries étaient fausses, et le test s'arrêtait à 5 s. Le module est désormais importé avant de fausser l'horloge, et seule `Date` est faussée. Un test qui fausse les minuteries n'importe rien ensuite.

## Niveau 2 : avant de pousser, et en CI à chaque push

Bloquant. Workflow `.github/workflows/ci.yaml`, 15 minutes au plus ; le job `level-2` résume tous les autres (vert si chacun a réussi ou a été écarté par un filtre de chemins).

- Formatage (`format:check`) et absence des caractères U+2500 à U+257F (`check:box-drawing`) : toujours.
- Lint, frontières (règles ESLint), typecheck, tests unitaires.
- Tests d'intégration, répartis en deux jobs (`vitest --shard`), chacun avec ses conteneurs Testcontainers, vrai ClamAV compris (module `media`).
- Scénarios de bout en bout de l'api (`apps/server/test/e2e` : contribution simulée notifiée en temps réel, messagerie en temps réel, signalement, export et effacement, événement et mission).
- Build une seule fois (job `build`, action `.github/actions/build`) : paquets, api, worker, `.next-e2e` et `.next-live`, publiés comme artefact `build` du run et réutilisés par les jobs de tests (ADR 0124) ; JavaScript initial par groupe de routes et par vue (`check:bundles .next-e2e --views`) dans son propre job, pour qu'un budget dépassé n'empêche pas les suites de tourner.
- Suite simulée du web dans Chromium (image Playwright, captures de référence comprises), `--max-failures=5`.
- Parcours critiques contre la vraie api dans Chromium (`@critical`, ADR 0127), `--max-failures=5` ; ceux qui revoient un KYC ou décident d'un signalement utilisent l'administrateur des parcours (`admin:create` par `scripts/e2e-live.sh`), l'appel est tranché par un second modérateur de démonstration, chacun avec sa double authentification et sa session ouvertes une fois par `e2e-live/global-setup.ts`. Le temps ne s'avance que dans la base (`LIVE_DATABASE_URL`, `e2e-live/database.ts` : fin d'une campagne, fin d'un délai de grâce), le worker faisant le reste ; la limite quotidienne de traduction de l'api y est abaissée à 1 000 caractères pour le parcours qui l'atteint.
- Lighthouse : un passage sur une page de chaque sorte (éditoriale, authentification, fil, profil public, publication publique), mêmes seuils (`LHCI_RUNS=1`, `LHCI_SCOPE=representative`) ; le fil et le profil public ont trois passages, le Total Blocking Time du fil et le Largest Contentful Paint des pages de ressources jugés sur leur médiane, et le ralentissement du processeur est calibré sur la médiane de trois mesures (ADR 0163).
- Storybook : stories comme tests dans les deux thèmes et captures de revue comparées aux captures commitées (`review:check`, compositions de Storybook et pages des projets sur le build `.next-e2e` du job de build), seulement si un composant, une story, un style, les traductions ou les tokens changent.
- Cohérence : migrations (`db:check`, `db:generate` sans différence), OpenAPI et client Orval à jour, clés de traduction (`i18n:check`), code mort (knip).
- Sécurité : secrets de l'historique (gitleaks), dépendances vulnérables, licences ; image Docker construite et analysée par Trivy ; CodeQL (workflow `codeql.yaml`).
- Conventional Commits (pull requests).

Filtres de chemins (`scripts/ci/changed-areas.mjs`), prudents : la base est le dernier run vert de `main` (ou la base de la pull request) ; sans base connue, ou si un fichier partagé change (`.github/`, `scripts/`, `infra/`, fichiers de la racine), tout s'exécute.

- Documentation seule (`docs/`, `*.md`) : formatage, caractères interdits et sécurité seulement (plus Storybook pour les captures de revue).
- `apps/server` seul : ni suite simulée du web, ni Lighthouse, ni Storybook ; les parcours critiques s'exécutent.

Stabilité : en CI, une relance ; la trace de chaque tentative en échec est gardée, la première comprise, avec sa vidéo (`retries: 1`, `trace` et `video` en `retain-on-failure`, `e2e/support/ci-options.ts`, FRONT 8A). Le résumé du run (`scripts/ci/playwright-summary.mjs`, depuis le rapport JSON) liste les tests en échec et les tests instables, ceux qui ne passent qu'à la relance. Une instabilité se corrige : le niveau 3 échoue sur elle.

Avant de pousser, l'agent exécute le niveau 2 en entier une seule fois, sur le poste, avec les commandes des jobs :

```sh
pnpm format:check && pnpm check:box-drawing
pnpm lint && pnpm typecheck && pnpm test
pnpm test:integration
pnpm turbo run test:e2e --filter=@pitchorium/server
pnpm turbo run build --filter=@pitchorium/server... --filter=@pitchorium/web^...
sh apps/web/scripts/build-e2e.sh && LIVE_BUILD_ONLY=1 bash apps/web/scripts/e2e-live.sh
pnpm --filter @pitchorium/web check:bundles .next-e2e --views
E2E_SKIP_BUILD=1 pnpm --filter @pitchorium/web test:e2e --project=chromium --max-failures=5
LIVE_SKIP_BUILD=1 LIVE_TURNSTILE=local pnpm --filter @pitchorium/web test:e2e:live --project=chromium --grep @critical --grep-invert @external --max-failures=5
LHCI_SKIP_BUILD=1 LHCI_RUNS=1 LHCI_SCOPE=representative pnpm --filter @pitchorium/web lighthouse
pnpm db:check && pnpm i18n:check && pnpm check:dead-code && pnpm api-client:generate
# si un composant, une story, un style ou les tokens changent :
pnpm --filter @pitchorium/web test:stories && pnpm --filter @pitchorium/web review:check
```

Turnstile au niveau 2 (ADR 0143) : les parcours critiques tournent sur la doublure locale (`LIVE_TURNSTILE=local`) servie par les faux fournisseurs (`apps/server/test/turnstile/local-turnstile.ts`) : script du widget nommé par l'api (`TURNSTILE_SCRIPT_URL`) et siteverify (`TURNSTILE_VERIFY_URL`), même contrat que Cloudflare et mêmes clés de test. Aucun appel à Cloudflare : la fixture `noCloudflare` (`e2e-live/support.ts`) fait échouer un parcours sur toute requête d'une page vers `challenges.cloudflare.com`, et le parcours `local stand-in of Turnstile` vérifie que l'inscription passe par le siteverify local (compteur des vérifications). Le test d'intégration de Turnstile utilise le même siteverify local. Le vrai widget reste au niveau 3 (`@external`, job `live-external`).

## Niveau 3 : chaque nuit et à la demande

Workflow `.github/workflows/nightly.yaml`, planifié chaque nuit (02:17 UTC) et déclenchable à la main avant une version ou en fin de prompt (`gh workflow run nightly.yaml --ref main`). Les tests instables y échouent (`PLAYWRIGHT_FAIL_ON_FLAKY=1`).

- `verify:clean` complet depuis un clone propre (ADR 0063) : `infra:up` avec le vrai ClamAV, migrations, `db:seed`, `db:seed:dev`, lint, typecheck, tests unitaires et d'intégration, build, budgets, suites de bout en bout de l'api et du web dans tous les navigateurs (Chromium, Firefox, WebKit, iPhone), build de Storybook, génération OpenAPI et client, cohérence, `git status` vide. Les parcours contre la vraie api et Lighthouse en sont retirés (`VERIFY_SKIP`) parce qu'ils tournent en parallèle dans les jobs suivants, sur le même commit ; en local, `pnpm verify:clean` reste complet.
- Tous les parcours contre la vraie api, un job par moteur (Chromium, Firefox, WebKit), chacun sur sa pile, sans Cloudflare Turnstile (`LIVE_TURNSTILE=0`) ; les parcours qui dépendent d'un service externe (`@external`, Turnstile) dans leur propre job (`live-external`, trois moteurs, une relance permise, rapport distinct, ADR 0127).
- Lighthouse : trois passages sur toutes les pages suivies (médiane), mêmes seuils.
- Storybook : stories comme tests et comparaison des captures de revue.
- `test:providers` (bacs à sable Stripe, Flutterwave, Resend, si leurs clés de test existent).
- Image Docker : Trivy et SBOM CycloneDX.
- Un échec ouvre une issue étiquetée `nightly` (ou commente celle qui est ouverte) avec le lien du run ; traces et rapports sont dans ses artefacts.

## Règle des prompts

L'agent exécute le niveau 1 en continu, le niveau 2 en entier une seule fois avant de pousser, et pousse une seule fois. En fin de prompt, il déclenche une seule fois le niveau 3 par le workflow manuel, pas en boucle locale. Une correction de CI n'est poussée qu'après avoir été reproduite et validée sur le poste (même image, même commande ; voir `AGENTS.md`).

## Durées mesurées

Avant (CI de `main`, 5 derniers runs au 2026-10-09 ; poste de développement, dernier `verify:clean`) :

- Run complet de la CI : 14,6 à 45,7 min de bout en bout (24 à 25 min pour 3 runs sur 5).
- Parcours contre la vraie api (job `live-tests`) : 14,3 à 24,9 min, dont 21,6 min de Playwright (146 tests, un worker : Chromium 7,7 min, WebKit 7,2 min, Firefox 6,4 min) ; 17,5 min sur le poste.
- Lighthouse (job `web-quality`) : 12,1 à 14,7 min, dont 12,4 min de Lighthouse (8 pages, 3 passages) ; 10,7 min sur le poste.
- Tests d'intégration : 6,9 à 8,5 min (37 fichiers l'un après l'autre : 352 s de tests, le reste en imports) ; 5,2 min sur le poste.
- Suite de bout en bout simulée (job `e2e-tests`, quatre projets) : 5,3 à 7,4 min ; 3,3 min sur le poste.
- Lint 1,4 à 2,2 min ; typecheck 0,7 à 1,3 min ; tests unitaires 0,9 à 1,5 min ; build 0,8 à 1,5 min ; autres jobs 2 min au plus.
- `verify:clean` sur le poste : 39 min environ (parcours 1 047 s, Lighthouse 639 s, intégration 311 s, bout en bout 195 s, le reste 15 s ou moins par étape).
- `db:seed:dev` : 4 à 8 s (migrations et `db:seed` : 1 s).
- ClamAV : prêt en 6,2 s sur le poste, 950 Mo de mémoire.
- Captures de revue : 32 s sur le poste.

Après (poste de développement, commandes du niveau 2) :

- Build une fois : paquets 6 s (cache), `.next-e2e` 21 s, `.next-live` 19 s.
- Parcours critiques (26) : 4,9 min de bout en bout, dont 4,5 min de Playwright.
- Suite simulée dans Chromium (78 tests) : 40 s.
- Lighthouse à un passage sur 5 pages : 154 s.
- `pnpm check:changed` : 11 s (cache de Turborepo) à 28 s.
- `review:check` : 29 s avec la construction de Storybook, 19 s sans.

Après (CI de `main`, niveau 2, 3 runs verts au 2026-10-10) :

- Run complet : 6,0 à 8,0 min de bout en bout (8,0 min quand il partageait les runners avec deux runs du niveau 3).
- Parcours critiques (job `live-critical`) : 4,3 à 4,9 min ; build unique : 1,1 à 1,4 min ; budgets (`bundles`) : 41 à 49 s.
- Lighthouse : 3,3 à 3,6 min ; suite simulée dans Chromium : 2,1 à 2,4 min ; Storybook et captures de revue : 3,1 à 3,6 min.
- Intégration : deux shards de 3,6 à 4,8 min ; scénarios de l'api : 1,5 à 1,9 min.
- Lint 37 à 79 s, typecheck 36 à 53 s, tests unitaires 35 à 66 s.

Niveau 3 (`nightly.yaml`, CI, run vert du 2026-10-10) : 20,5 min de bout en bout ; `verify:clean` sans parcours ni Lighthouse 20,5 à 21,5 min (intégration 483 s, bout en bout de l'api et du web dans tous les navigateurs 453 s), en parallèle des parcours contre la vraie api (8,5 à 10 min par moteur) et de Lighthouse complet (11 à 12 min).

## Récupérer et relancer un run

- `gh run view <id> --log-failed` : seuls les journaux des étapes en échec.
- `gh run download <id> -n <artefact>` : rapport Playwright (traces), journaux des parcours, résultats de Lighthouse.
- `gh run rerun <id> --failed` : relance seulement les jobs en échec, une fois la correction poussée.

## Diagnostiquer un échec propre à la CI (ADR 0142)

Un parcours qui échoue en CI et passe sur le poste se reproduit sur le runner, jamais par une relance ni un délai ajouté sans mesure :

```sh
gh workflow run diagnose.yaml --ref main -f grep='mention' -f browser=firefox -f repeat=30
# un parcours de la suite simulée :
gh workflow run diagnose.yaml --ref main -f suite=stub -f grep='answers a request' -f browser=chromium
gh run watch
gh run download <id> -n diagnose-firefox-1
```

- Le workflow `.github/workflows/diagnose.yaml` (entrée `suite` : `live` contre la vraie api, `stub` pour la suite simulée dans l'image Playwright) construit comme la CI, affiche l'environnement du runner (processeurs, mémoire, fuseau, langue, polices de l'hôte et de l'image Playwright), puis répète le parcours (`--repeat-each`, 30 par défaut, `--retries=0`) sur sa pile isolée, avec trace et vidéo de chaque échec (`PLAYWRIGHT_TRACE`, `PLAYWRIGHT_VIDEO`, `e2e/support/ci-options.ts`) et les journaux de l'api, du worker et du web en artefact.
- Comparer avec le poste : nombre de processeurs, fuseau (UTC sur le runner), polices, latence, ordre des tests (`--repeat-each` garde l'ordre du fichier), parallélisme (un worker), base partagée entre parcours.
- Le garde de la console (`e2e/support/console-guard.ts`) ajoute à une erreur le nom, le message, le code et la pile des objets `Error` reçus : Firefox n'écrit que « Error » pour `console.error(error)`.
- Une correction est prouvée par 30 passages consécutifs sur le runner, dans le moteur en cause.
- Fuite d'état entre parcours : la suite entière (`-f grep=. -f repeat=1`) tourne en boucle (`loops`, arrêtée au premier échec, dont la trace est gardée) sur plusieurs runners à la fois (`jobs`, 5 au plus, un artefact par runner) ; sans Turnstile, les parcours `@external` sont écartés comme au niveau 3.
- Lighthouse (`-f suite=lighthouse -f page=/fr/feed -f repeat=10 -f refs='<commit> <commit>'`) : `scripts/ci/lighthouse-series.sh` construit chaque commit dans son arbre de travail et mesure la page `repeat` fois avec son propre `lighthouserc.cjs`, sur le même runner, le processeur calibré une seule fois pour toutes les séries ; il affiche chaque Total Blocking Time, la médiane, le minimum, le maximum et l'écart interquartile (artefact `series.json`).

## Préchargement en 404 sous `next dev`

Sous `pnpm dev` seulement, une page qui sert visiteurs et membres (`/projects`, `/projects/{slug}`) précharge pour un membre un fragment que le serveur de développement ne sert pas (`/_next/static/chunks/apps_web_src_<hachage>_._.js`, 404, puis l'avertissement « preloaded using link preload but not used ») :

- cause : le rendu serveur de `LazyMemberFrame` (`next/dynamic`) ajoute un `<link rel="preload">` pour chaque fragment listé par le `react-loadable-manifest.json` de la page ; en développement, Turbopack y inscrit un fragment qu'il n'émet jamais (absent de `.next/dev/static/chunks`, reproduit depuis un `.next/dev` vide) ;
- sans effet : le cadre membre se charge par ses vrais fragments (200) et s'affiche ;
- la production n'est pas touchée : dans `.next-e2e` et `.next-live`, chaque fragment des 59 manifestes existe, et les suites simulée et réelle passent avec le garde strict ;
- exception du garde de la console limitée à `E2E_NEXT_DEV=1` (suite lancée contre `pnpm dev` par `test:e2e:live:run`) et au seul message 404 d'un fichier de `/_next/static/chunks/` ; sans cette variable, le même parcours échoue sur ce 404, et la CI ne la pose jamais.
