# 0123. Trois niveaux de vérification

Statut : acceptée (2026-10-10).

## Contexte

Chaque push exécutait toutes les vérifications : parcours contre la vraie api dans trois moteurs (24 min), Lighthouse sur 8 pages en 3 passages (12 min), tests d'intégration en série (8 min), suite simulée dans quatre projets (6 min). Un run de la CI durait 24 à 25 min, jusqu'à 45 min ; chaque prompt rejouait en plus `verify:clean` (39 min sur le poste), parfois plusieurs fois. Les postes les plus coûteux étaient les parcours, Lighthouse, l'intégration, la suite simulée et les builds refaits par chaque job ; la préparation de la base (9 s) et ClamAV (6 s) ne l'étaient pas.

## Décision

- Niveau 1, boucle de développement : seulement ce qui est touché (`pnpm check:changed`, `vitest related`, Playwright filtré, Chromium) ; ni `verify:clean`, ni Lighthouse, ni captures de revue.
- Niveau 2, avant de pousser et en CI à chaque push (`ci.yaml`, bloquant, 15 min au plus) : formatage, caractères interdits, lint et frontières, typecheck, tests unitaires, intégration en deux shards, scénarios de bout en bout de l'api, build unique, budgets de JavaScript, suite simulée dans Chromium, parcours `@critical` dans Chromium (ADR 0127), Lighthouse à un passage sur cinq pages représentatives, Storybook et captures de revue si l'interface change, cohérence (migrations, OpenAPI, i18n, knip), sécurité (gitleaks, audit, licences, Trivy, CodeQL).
- Niveau 3, chaque nuit et à la demande (`nightly.yaml`) : `verify:clean`, tous les parcours dans Chromium, Firefox et WebKit, Lighthouse en trois passages sur toutes les pages, Storybook et captures de revue, `test:providers`, Trivy et SBOM ; un échec ouvre une issue avec le lien du run.
- Les seuils ne changent pas. Une vérification retirée du niveau 2 reste au niveau 3 (liste dans `docs/architecture/testing.md`).
- Filtres de chemins prudents (`scripts/ci/changed-areas.mjs`) : base au dernier run vert de `main`, tout s'exécute si la base est inconnue ou si un fichier partagé change.
- Une relance en CI avec sa trace ; un test qui ne passe qu'à la relance est listé dans le résumé du run et fait échouer le niveau 3 (`PLAYWRIGHT_FAIL_ON_FLAKY=1`).
- `verify:clean` accepte `VERIFY_SKIP` : la nuit, les parcours et Lighthouse tournent en parallèle dans leurs propres jobs plutôt qu'en série dans le clone ; en local, il reste complet.
- Règle des prompts : niveau 1 en continu, niveau 2 une fois avant l'unique push, niveau 3 une fois en fin de prompt par le workflow manuel.

## Conséquences

- Une régression propre à Firefox ou WebKit, un parcours non critique, une page de Lighthouse hors échantillon ou la variance entre passages de Lighthouse sont vus au plus tard la nuit suivante, ou au déclenchement manuel avant une version.
- Un échec nocturne n'est pas bloquant par lui-même : l'issue ouverte doit être traitée avant la suite du travail.
- Le job `level-2` devient le seul contrôle requis pour la protection de branche.
