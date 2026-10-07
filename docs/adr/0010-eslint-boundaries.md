# 0010. Frontières vérifiées par ESLint

Statut : acceptée (2026-10-07)

## Contexte

Les règles d'architecture (façade publique des modules, pureté de `domain/`, indépendance de `platform/`) doivent échouer en CI, pas reposer sur la relecture.

## Décision

`eslint-plugin-boundaries` 7.2.0 (règle `boundaries/dependencies` avec `checkAllOrigins`), configuré dans `packages/config/eslint-boundaries.js`, complété par `no-restricted-imports` pour les imports de packages du workspace (schéma propre au module, `domain/` limité à `@pitchorium/contracts`). Alternatives écartées : `dependency-cruiser` (outil séparé de l'éditeur), `eslint-plugin-import/no-restricted-paths` (pas de captures par module).

## Conséquences

- Les violations apparaissent dans l'éditeur et en CI.
- Les packages du workspace sont résolus comme des fichiers locaux hors des éléments décrits : leurs restrictions passent par `no-restricted-imports`.
- `apps/server/test/architecture/boundaries.spec.ts` vérifie que chaque règle détecte une violation volontaire.
