# 0012. Runtime et choix de versions

Statut : acceptée (2026-10-07)

## Contexte

La règle est d'utiliser les dernières versions stables, figées exactement. Plusieurs dernières versions majeures ne sont pas encore supportées par leur écosystème au 2026-10-07.

## Décision

| Outil                        | Version retenue  | Dernière publiée | Raison                                                                            |
| ---------------------------- | ---------------- | ---------------- | --------------------------------------------------------------------------------- |
| Node.js                      | 24 (LTS)         | 24.19.0 installé | LTS imposée                                                                       |
| pnpm                         | 12.9.1           | 12.9.1           |                                                                                   |
| TypeScript                   | 6.0.3            | 7.0.2            | `typescript-eslint` 8.71.1 exige `<6.1.0`, `@nestjs/swagger` exige `^5.5 \|\| ^6` |
| NestJS                       | 11.2.7           | 12.1.2           | `nestjs-zod` 5.5.0 (dernière) déclare `@nestjs/common ^10 \|\| ^11`               |
| `@nestjs/swagger`            | 11.4.7           | 12.0.2           | aligné sur NestJS 11                                                              |
| `@nestjs/bullmq`             | 11.0.5           | 12.0.0           | aligné sur NestJS 11                                                              |
| drizzle-orm / drizzle-kit    | 0.45.3 / 0.31.11 | idem (1.0 en RC) | dernière stable                                                                   |
| BullMQ                       | 6.3.11           | 6.3.11           |                                                                                   |
| Zod                          | 4.6.5            | 4.6.5            |                                                                                   |
| Vitest                       | 5.0.3            | 5.0.3            |                                                                                   |
| ESLint                       | 10.12.0          | 10.12.0          |                                                                                   |
| Better Auth / better-call    | 1.7.7 / 1.4.0    | 1.7.7            | better-call figé sur la version dont dépend Better Auth                           |
| sharp                        | 0.35.5           | 0.35.5           | traitement d'images (libvips)                                                     |
| file-type                    | 22.1.1           | 22.1.1           | ESM chargé par `require(esm)`                                                     |
| pdfjs-dist / @napi-rs/canvas | 6.4.299 / 1.0.10 | idem             | pdf.js (Apache 2.0) plutôt que MuPDF (AGPL) ; chargé par `import()` dynamique     |
| ClamAV (image)               | 1.5.4            | 1.5.4            | `clamav/clamav`, signatures incluses                                              |

Le serveur est en CommonJS (métadonnées de décorateurs et ordre de chargement maîtrisés) ; les packages partagés sont en ESM et chargés par `require(esm)` de Node 24.

## Conséquences

- Montée vers NestJS 12 dès qu'une version de `nestjs-zod` la supporte ; vers TypeScript 7 quand `typescript-eslint` et `@nestjs/swagger` la supportent.
- pnpm 12 bloque les scripts d'installation non approuvés : la liste est tenue dans `pnpm-workspace.yaml` (`allowBuilds`).
