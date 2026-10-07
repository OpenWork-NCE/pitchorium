# Module organizations

- Responsabilité : Pages organisation (fondation, entreprise, ONG, institution) : description, pays, projets soutenus ou portés, membres liés, vérification avec badge (§10.7, §14).
- Schéma PostgreSQL : `organizations` (`packages/db/src/schemas/organizations.ts`).
- Dépendances autorisées : identity, profiles, media. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `organizations.organization.created.v1`, `organizations.member.linked.v1`, `organizations.organization.verified.v1`.
