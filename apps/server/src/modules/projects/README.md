# Module projects

- Responsabilité : Projets et campagnes : création en brouillon, aperçu puis publication, objectif, 1 à 5 paliers, durée de 30 à 90 jours, instruments acceptés, contreparties, love money, actualités, statuts (brouillon, en financement, financé, clôturé), manifestation d'intérêt, export (§11).
- Schéma PostgreSQL : `projects` (`packages/db/src/schemas/projects.ts`).
- Dépendances autorisées : identity, profiles, organizations, media, impact. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `projects.project.published.v1`, `projects.milestone.unlocked.v1`, `projects.campaign.funded.v1`, `projects.campaign.closed.v1`, `projects.update.published.v1`, `projects.interest.expressed.v1`.
