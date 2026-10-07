# Module trust

- Responsabilité : Confiance et sécurité : signalement d'un profil, d'une publication ou d'un projet, file de modération, masquage, acceptation des conditions (argent, impact, absence de conseil en investissement) (§13).
- Schéma PostgreSQL : `trust` (`packages/db/src/schemas/trust.ts`).
- Dépendances autorisées : identity, profiles, organizations, content, projects. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `trust.report.filed.v1`, `trust.content.hidden.v1`.
