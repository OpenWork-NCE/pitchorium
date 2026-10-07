# Module notifications

- Responsabilité : Notifications in-app (temps réel) et email, digests quotidien et hebdomadaire, préférences, pour les événements listés au §10.5 ; réagit aux événements de domaine des autres modules (§10.5, §14).
- Schéma PostgreSQL : `notifications` (`packages/db/src/schemas/notifications.ts`).
- Dépendances autorisées : identity, profiles. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `notifications.notification.created.v1`.
