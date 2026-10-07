# Module admin

- Responsabilité : Back-office : feature flags, rôles, modération, journal d'audit, vérification des organisations (§13, §14).
- Schéma PostgreSQL : `admin` (`packages/db/src/schemas/admin.ts`).
- Dépendances autorisées : access, trust, organizations. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `admin.feature-flag.changed.v1`.
