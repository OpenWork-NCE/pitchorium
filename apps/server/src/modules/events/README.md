# Module events

- Responsabilité : Événements, cités au périmètre V3 du cahier des charges sans autre précision (§14). Contenu fonctionnel à définir (voir `docs/open-questions.md`).
- Schéma PostgreSQL : `events` (`packages/db/src/schemas/events.ts`).
- Dépendances autorisées : identity, profiles, organizations. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : à définir.
