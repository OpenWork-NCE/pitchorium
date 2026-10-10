# Instructions pour les agents

## Projet

Pitchorium est un réseau professionnel et une plateforme de financement à impact entre l'Afrique, les Caraïbes et la diaspora européenne. La source de vérité produit est le cahier des charges du client (voir ci-dessous). Le périmètre est la totalité des fonctionnalités V1, V2 et V3. Seuls garde-fous encore valables : swahili, wolof et lingala activés après relecture humaine native ; equity et prêts activés après validation légale ; exclusions explicites du document (applications natives, paiement crypto, certification d'impact tierce, job board).

`docs/product/` (cahier des charges et proposition produit du client) est confidentiel : ignoré par git, absent du dépôt GitHub, présent uniquement en local. Il est requis pour travailler : s'il manque, s'arrêter et le demander. Ne jamais l'ajouter au dépôt (ni par `git add -f`, ni dans un autre dossier) et ne jamais le citer par un lien dans un fichier publié ; citer seulement les numéros de section (§10.7).

`Pitchorium-Identite-Marque/` (kit de marque complet du client, à la racine) suit la même règle : ignoré par git, présent uniquement en local. Seule la sélection utile à la webapp est versionnée, sous `apps/web/public/brand`, `apps/web/public/fonts` et `apps/web/src/components/brand`, et se refait par `pnpm brand:sync` (`docs/design/brand-usage.md`). Ne jamais modifier la géométrie, les proportions ni la palette des logos, ne jamais retaper le logotype, n'ajouter aucun slogan. Référence de mouvement : `docs/design/ELITE-MOTION.md`.

## Règles absolues

1. Jamais de caractère U+2500 à U+257F ni de séparation décorative (code, commentaires, documentation, sorties de scripts).
2. Commits atomiques Conventional Commits, en anglais, avec un scope autorisé par `commitlint.config.js` ; chaque commit compile et passe le typecheck seul (`pnpm build && pnpm typecheck` sur ce commit).
3. Documentation précise, concise, mise à jour dans le même commit que le code concerné.
4. Code, identifiants, commentaires et commits en anglais ; documentation en français.
5. Aucun secret dans le dépôt ; aucune donnée métier inventée : tout manque va dans `docs/open-questions.md`.
6. Dernières versions stables compatibles avec le socle, figées exactement (voir ADR 0012).
7. Frontières : un module n'écrit que dans son schéma PostgreSQL, ne lit un autre module que via son `index.ts`, communique en asynchrone via l'outbox ; son `domain/` n'importe ni NestJS ni Drizzle.
8. Rien n'est déclaré terminé sans avoir été exécuté et vérifié.
9. Ne jamais arrêter un processus que l'on n'a pas lancé soi-même : enregistrer le PID de chaque processus démarré et n'arrêter que ceux-là (jamais de `pkill`, `pgrep`, `killall` ni de `kill` sur un motif ou un port) ; vérifier qu'un port est libre avant d'y démarrer un serveur, et en choisir un autre s'il est pris.

## Architecture

- Monolithe modulaire NestJS, deux processus (api, worker), un schéma PostgreSQL par module, frontières vérifiées par ESLint.
- Hexagonal proportionné : `domain/`, `application/`, `infrastructure/`, `interface/` par module.
- Contrats Zod (`packages/contracts`), OpenAPI généré, client Orval.
- Outbox et inbox, argent en unités mineures, UUIDv7 générés par l'application, erreurs RFC 9457 avec codes stables.
- Références : `docs/architecture/overview.md`, `modules.md`, `conventions.md`, `docs/adr/`.

## Frontend (`apps/web`)

- Next.js 16, App Router, Tailwind 4, Radix UI comme seule couche de primitives, design system possédé dans `src/components/ui` (ADR 0081, 0082).
- Adresse du visiteur relayée à l'api, signée (ADR 0115) ; `.env.example` de chaque application suffit à `pnpm dev`, vérifié par un test ; vues visiteur et membre d'une page de ressource mesurées par `check:bundles --views` (190 et 250 kB).
- Données : Server Components pour le premier rendu, TanStack Query et hydratation dans le navigateur, aucune Server Action pour une écriture métier : l'api est la seule source des règles (ADR 0083).
- Frontières vérifiées par ESLint : `components/ui`, `components/motion` et `components/brand` n'importent aucune feature ; une feature (`src/features/<domaine>`, alignée sur le module backend) n'importe une autre feature que par son `index.ts` ; `app/` compose sans logique métier ; `"use client"` jamais sur une page ou un layout (ADR 0089).
- Aucun texte d'interface en dur : namespace `web` de `packages/i18n` ; aucune couleur en dur : tokens, contraste AA testé (ADR 0084, 0085).
- Mouvement : `docs/design/motion.md` ; primitives de `components/motion`, état final immédiat avec moins de mouvement ; GSAP réservé aux pages éditoriales (ADR 0086).
- Marque : uniquement la sélection de `pnpm brand:sync`, jamais un fichier modifié à la main (ADR 0087).
- Coquilles : `components/layout/member` (bandeau haut, jamais de barre inférieure, ADR 0099) et `components/layout/admin` ; une page se pose dans `ThreeColumnLayout` ou `SingleColumnLayout`. Usages : `docs/design/patterns.md`.
- Authentification et onboarding (ADR 0104) : un seul point d'entrée `/sign-in`, chaque connexion passe par `/continue` (conditions d'abord, `redirectTo` de même origine seulement, `lib/auth/redirect.ts`), appels de Better Auth par `authCall` (Turnstile, délai d'une limite) ; une écriture refusée pour un prérequis passe par `useWithPrerequisites` (ADR 0105) ; parcours vérifiés contre la vraie api par `test:e2e:live`.
- Formulaires : `useZodForm`, `FormSummary` (liens vers les champs, focus après un envoi refusé), `useApplyProblem` pour les codes RFC 9457 et leur raison précise (`reason`, ADR 0106 : un raffinement des contrats déclare `params.reason`, jamais de `message`), `FormActions` ; listes dans une phrase par `formatList` ; dates et heures par `DateTimeField` (ADR 0100). Couleur d'accent violette pour toute action principale, cuivre jamais sur un bouton ni un état.
- Une adresse canonique par ressource (`/members/{handle}`, `/organizations/{slug}`, `/projects/{slug}`, `/events/{slug}`), rendu selon la session, 404 au visiteur pour une ressource non publique (ADR 0101) ; la page affiche ce que l'api donne au lecteur, jamais une règle de confidentialité recalculée (ADR 0113).
- Réseau : gestes réversibles optimistes avec retour arrière et raison du refus (ADR 0112) ; images recadrées dans le navigateur par `ImageCropDialog` de `features/media`, le serveur seul nettoie le fichier (ADR 0111).
- Fil et publications (ADR 0116 à 0122) : la carte `PostCard` sert le serveur et le navigateur ; le fil suit le motif WAI-ARIA `feed`, virtualisé après l'hydratation de ses premières entrées ; l'éditeur (Tiptap) et la visionneuse (Embla) jamais dans un premier chargement (`check:bundles`) ; les nouvelles publications attendent la pastille, sans insertion automatique ; les vues se signalent par lots ; le brouillon du composeur reste sur l'appareil (IndexedDB), effacé à la publication et à la déconnexion ; aucune constante des contrats dans un composant du fil (`features/content/lib/limits.ts`).
- Projets et impact (ADR 0128 à 0132) : page projet en composants serveur, îlots clients chargés à la demande, GSAP jamais dans la vue membre ; vidéo derrière une façade, iframe au clic seulement ; barre d'action mobile propre à la page projet, jamais une navigation ; équivalent en FCFA seulement par la parité fixe donnée par l'api ; assistant à une adresse par étape, brouillon enregistré dans l'api (jamais dans le navigateur), chaque étape chargée à la demande ; images d'une page serveur par `getImageProps`, sans le composant client de `next/image` ; pages de l'équipe mesurées par `check:bundles --views`.
- Hors ligne : seules les mutations listées dans `lib/query/persisted-mutations.ts` (message, réaction, commentaire, clé d'idempotence) survivent à la fermeture de l'onglet, effacées à la déconnexion et après 24 h ; jamais d'authentification ni de paiement (ADR 0102).
- Code sorti du premier chargement mais utile hors ligne : préchargé à l'inactivité (`lib/preload.ts`) ; budgets par groupe (ADR 0094).
- Tests : chaque story est un test, dans les deux thèmes (`pnpm --filter @pitchorium/web test:stories`) ; les parcours e2e ouvrent une session sur l'api simulée (`e2e/support/stub-api.mjs`, contenus dans `stub-content.mjs`, comptes de démonstration), dans Chromium, Firefox, WebKit et en iPhone (parcours `@phone`) ; tout parcours, simulé ou réel, échoue sur une erreur de console, un écart d'hydratation, une promesse rejetée ou une violation de la CSP (`e2e/support/console-guard.ts`, `allowConsole` pour une erreur provoquée exprès).
- Captures de référence : `pnpm --filter @pitchorium/web test:e2e` dans l'image Playwright (Docker requis) ; captures de revue : `review:captures` pour les écrire, `review:check` pour les comparer (`docs/design/review` : compositions de Storybook et pages des projets sur le build `.next-e2e`).

## Avant toute tâche

Lire les documents concernés dans `docs/`, le `README.md` des modules touchés (`apps/web/README.md` pour le frontend) et `docs/open-questions.md`.

## Vérification (ADR 0123, `docs/architecture/testing.md`)

- Niveau 1, en continu pendant le travail : seulement ce qui est touché. `pnpm check:changed` (lint, typecheck puis tests unitaires des paquets modifiés et de leurs dépendants), `vitest related`, tests d'intégration du fichier touché, Playwright filtré par fichier ou étiquette, Chromium seulement. Ni `verify:clean`, ni Lighthouse, ni captures de revue.
- Niveau 2, en entier une seule fois avant de pousser, puis une seule poussée : les commandes des jobs de `ci.yaml`, listées dans `docs/architecture/testing.md` (lint, typecheck, tests, intégration, scénarios de l'api, build unique, `check:bundles`, suite simulée et parcours `@critical` dans Chromium, Lighthouse à un passage, cohérence, et Storybook avec `review:check` si l'interface change). La CI les rejoue à chaque push ; le job `level-2` doit être vert.
- Niveau 3, une seule fois en fin de prompt, par le workflow manuel et non en boucle locale : `gh workflow run nightly.yaml --ref main`, puis `gh run watch`. Il exécute `verify:clean`, tous les parcours dans les trois moteurs, Lighthouse complet, Storybook, captures de revue, `test:providers`, Trivy et SBOM.
- Si les schémas changent : `pnpm db:generate`. Si les routes ou contrats changent : `pnpm build && pnpm api-client:generate`, puis commiter `apps/server/openapi` et `packages/api-client/src/generated`. Après un changement visuel voulu : `review:captures` et captures de référence (`test:e2e --update-snapshots`) commitées.
- Un test instable (qui ne passe qu'à la relance, listé dans le résumé du run) se corrige, il ne s'ignore pas ; le niveau 3 échoue sur lui.

## CI

- `gh run view <id> --log-failed` : seuls les journaux en échec ; `gh run download <id> -n <artefact>` : traces et rapports.
- Reproduire le job en échec sur le poste, avec la même image et la même commande (commandes de `docs/architecture/testing.md` ; les suites Playwright tournent déjà dans l'image `mcr.microsoft.com/playwright:v1.64.0-noble`, les parcours par `scripts/e2e-live.sh`, l'intégration par Testcontainers), avant de pousser une correction. Interdiction de pousser une correction de CI sans l'avoir reproduite et validée en local.
- `gh run rerun <id> --failed` : relancer seulement les jobs en échec, une fois la correction poussée.

## Définition de terminé

- Niveau 2 vert sur le poste puis en CI (job `level-2`), en 15 minutes au plus.
- Niveau 3 vert une fois, déclenché à la main en fin de prompt (`nightly.yaml`, qui exécute `pnpm verify:clean`, ADR 0063) ; `git status` vide après génération.
- Chaque commit compile et passe le typecheck seul.
- Documentation, ADR, `.env.example` et questions ouvertes à jour.
- Comportement vérifié par exécution (tests ou parcours manuel), pas seulement par lecture.

## Rapport final

Listes plutôt que tableaux : livré, routes, événements émis et consommés, versions ajoutées, sortie résumée de chaque vérification, commits, écarts justifiés, éléments non vérifiés, questions ouvertes ajoutées.
