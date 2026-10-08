# Instructions pour les agents

## Projet

Pitchorium est un réseau professionnel et une plateforme de financement à impact entre l'Afrique, les Caraïbes et la diaspora européenne. La source de vérité produit est le cahier des charges du client (voir ci-dessous). Le périmètre est la totalité des fonctionnalités V1, V2 et V3. Seuls garde-fous encore valables : swahili, wolof et lingala activés après relecture humaine native ; equity et prêts activés après validation légale ; exclusions explicites du document (applications natives, paiement crypto, certification d'impact tierce, job board).

`docs/product/` (cahier des charges et proposition produit du client) est confidentiel : ignoré par git, absent du dépôt GitHub, présent uniquement en local. Il est requis pour travailler : s'il manque, s'arrêter et le demander. Ne jamais l'ajouter au dépôt (ni par `git add -f`, ni dans un autre dossier) et ne jamais le citer par un lien dans un fichier publié ; citer seulement les numéros de section (§10.7).

## Règles absolues

1. Jamais de caractère U+2500 à U+257F ni de séparation décorative (code, commentaires, documentation, sorties de scripts).
2. Commits atomiques Conventional Commits, en anglais, avec un scope autorisé par `commitlint.config.js` ; chaque commit compile et passe le typecheck seul (`pnpm build && pnpm typecheck` sur ce commit).
3. Documentation précise, concise, mise à jour dans le même commit que le code concerné.
4. Code, identifiants, commentaires et commits en anglais ; documentation en français.
5. Aucun secret dans le dépôt ; aucune donnée métier inventée : tout manque va dans `docs/open-questions.md`.
6. Dernières versions stables compatibles avec le socle, figées exactement (voir ADR 0012).
7. Frontières : un module n'écrit que dans son schéma PostgreSQL, ne lit un autre module que via son `index.ts`, communique en asynchrone via l'outbox ; son `domain/` n'importe ni NestJS ni Drizzle.
8. Rien n'est déclaré terminé sans avoir été exécuté et vérifié.

## Architecture

- Monolithe modulaire NestJS, deux processus (api, worker), un schéma PostgreSQL par module, frontières vérifiées par ESLint.
- Hexagonal proportionné : `domain/`, `application/`, `infrastructure/`, `interface/` par module.
- Contrats Zod (`packages/contracts`), OpenAPI généré, client Orval.
- Outbox et inbox, argent en unités mineures, UUIDv7 générés par l'application, erreurs RFC 9457 avec codes stables.
- Références : `docs/architecture/overview.md`, `modules.md`, `conventions.md`, `docs/adr/`.

## Avant toute tâche

Lire les documents concernés dans `docs/`, le `README.md` des modules touchés et `docs/open-questions.md`.

## Avant tout commit

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm format:check
pnpm check:box-drawing
pnpm i18n:check
pnpm db:check
```

Si les schémas changent : `pnpm db:generate`. Si les routes ou contrats changent : `pnpm build && pnpm api-client:generate`, puis commiter `apps/server/openapi` et `packages/api-client/src/generated`.

## Définition de terminé

- `pnpm verify:clean` passe : il rejoue les commandes ci-dessus sur un clone propre, dans un projet Docker isolé (ADR 0063).
- Toutes les commandes ci-dessus passent ; `git status` est vide après génération.
- Documentation, ADR, `.env.example` et questions ouvertes à jour.
- Comportement vérifié par exécution (tests ou parcours manuel), pas seulement par lecture.

## Rapport final

Listes plutôt que tableaux : livré, routes, événements émis et consommés, versions ajoutées, sortie résumée de chaque vérification, commits, écarts justifiés, éléments non vérifiés, questions ouvertes ajoutées.
