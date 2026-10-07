# 0001. Monolithe modulaire à deux processus

Statut : acceptée (2026-10-07)

## Contexte

Le périmètre couvre une vingtaine de domaines (réseau, projets, paiements, messagerie...) qui partagent comptes, transactions et données. L'équipe est réduite et le produit n'a pas encore d'usage réel qui justifierait des services séparés.

## Décision

Un seul code NestJS (`apps/server`), découpé en modules métier, avec deux points d'entrée : `main.api.ts` (HTTP et Socket.IO) et `main.worker.ts` (BullMQ, relais d'outbox, tâches planifiées). Les deux processus chargent les mêmes modules métier et partagent `src/platform`.

## Conséquences

- Un déploiement, un dépôt, des transactions locales ; l'api et le worker se dimensionnent séparément.
- Les frontières entre modules ne sont pas physiques : elles sont imposées par ESLint (ADR 0010) et par un schéma PostgreSQL par module (ADR 0002).
- Extraire un module en service plus tard reste possible, car il ne communique déjà que par façade et événements.
