# Module identity

- Responsabilité : Comptes et authentification : inscription spontanée sans choix de rôle (Google, LinkedIn, Microsoft, email avec mot de passe ou lien magique), vérification d'email, sessions (§7).
- Schéma PostgreSQL : `identity` (`packages/db/src/schemas/identity.ts`).
- Dépendances autorisées : aucun module métier. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `identity.account.registered.v1`, `identity.email.verified.v1`, `identity.account.deleted.v1`.
