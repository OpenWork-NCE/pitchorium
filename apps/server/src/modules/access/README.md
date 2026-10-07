# Module access

- Responsabilité : Autorisations : rôles et permissions (modération, administration ; liste exacte à définir), exigence d'email vérifié pour les actions de confiance (publier un projet, contribuer, messagerie hors réseau proche, §7.3), authentification des connexions temps réel.
- Schéma PostgreSQL : `access` (`packages/db/src/schemas/access.ts`).
- Dépendances autorisées : identity. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `access.role.granted.v1`, `access.role.revoked.v1`.
