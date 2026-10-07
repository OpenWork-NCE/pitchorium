# Module media

- Responsabilité : Fichiers : photos de profil et de couverture, galeries et vidéos de projet, documents (PDF de pitch, one-pager), envoyés et lus par URLs présignées (§10.1, §10.3, §11.1).
- Schéma PostgreSQL : `media` (`packages/db/src/schemas/media.ts`).
- Dépendances autorisées : aucun module métier. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `media.asset.uploaded.v1`, `media.asset.deleted.v1`.
