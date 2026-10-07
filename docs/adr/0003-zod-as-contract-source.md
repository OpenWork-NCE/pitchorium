# 0003. Zod comme source unique des contrats

Statut : acceptée (2026-10-07)

## Contexte

Les contrats HTTP doivent être identiques entre la validation serveur, la documentation OpenAPI et le client du futur frontend.

## Décision

Les schémas Zod partagés vivent dans `packages/contracts` (sans dépendance NestJS). Le serveur les utilise via `nestjs-zod` (DTO, pipe de validation, sérialisation). Le document OpenAPI est généré depuis le code (`pnpm openapi:generate`, sans serveur réseau) et Orval en produit un client fetch et des hooks TanStack Query (`packages/api-client`). Le code généré est versionné et la CI échoue s'il n'est pas à jour.

## Conséquences

- Un changement de contrat casse le typage du client dès la régénération.
- `nestjs-zod` 5.5.0 ne supporte que NestJS 11 : le serveur reste sur NestJS 11 tant que la compatibilité NestJS 12 n'est pas publiée (ADR 0012).
- `cleanupOpenApiDoc` de nestjs-zod 5 échoue si un schéma racine de DTO porte `.meta({ id })` : les contrats n'utilisent pas d'`id`, le nom vient de la classe DTO.
