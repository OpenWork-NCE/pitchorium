# Module profiles

- Responsabilité : Profils personne : bloc commun, entrepreneur et contributeur (casquettes cumulables, type de structure), intention d'arrivée, force du profil, page publique optionnelle, vues de profil avec option de visite privée (§5, §7.2, §10.1, §10.2).
- Schéma PostgreSQL : `profiles` (`packages/db/src/schemas/profiles.ts`).
- Dépendances autorisées : identity, media. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `profiles.profile.created.v1`, `profiles.profile.updated.v1`, `profiles.profile.viewed.v1`.
