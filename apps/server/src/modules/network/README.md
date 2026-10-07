# Module network

- Responsabilité : Relations : suivre (unilatéral), se connecter avec une note de 300 caractères et acceptation, listes abonnés, abonnements et connexions, introductions à trois (§10.2, §10.4).
- Schéma PostgreSQL : `network` (`packages/db/src/schemas/network.ts`).
- Dépendances autorisées : identity, profiles. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `network.follow.created.v1`, `network.connection.requested.v1`, `network.connection.accepted.v1`, `network.introduction.made.v1`.
