# Module content

- Responsabilité : Fil d'actualité : publications (texte, images, documents, liens), repartage avec commentaire, rattachement à un projet, commentaires et réponses, composition du fil (réseau d'abord, découverte éditorialisée si le réseau est vide) (§10.3).
- Schéma PostgreSQL : `content` (`packages/db/src/schemas/content.ts`).
- Dépendances autorisées : identity, profiles, network, media, projects. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `content.post.published.v1`, `content.post.reshared.v1`, `content.comment.added.v1`.
