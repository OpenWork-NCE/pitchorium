# 0002. Un schéma PostgreSQL par module

Statut : acceptée (2026-10-07)

## Contexte

Dans un monolithe, rien n'empêche techniquement un module de lire les tables d'un autre, ce qui crée un couplage invisible.

## Décision

Chaque module métier possède un `pgSchema` Drizzle du même nom (`packages/db/src/schemas/<module>.ts`). Un module n'écrit que dans son schéma et ne lit jamais les tables d'un autre : il passe par la façade publique (`index.ts`) ou réagit aux événements de domaine. Les tables techniques vivent dans le schéma `platform`.

## Conséquences

- La propriété des données est explicite et vérifiable (règle ESLint sur `@pitchorium/db/schemas/<module>`).
- Pas de clé étrangère entre schémas de modules différents : la cohérence inter-modules est assurée par l'application et les événements.
- Les migrations restent uniques et ordonnées (un seul dossier `packages/db/migrations`).
