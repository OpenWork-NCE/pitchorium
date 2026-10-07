# Module discovery

- Responsabilité : Recherche (personnes, organisations, projets ; filtres pays, secteur, état, impact minimum), page Découvrir, matching à règles lisibles avec phrase de raison (§10.6, §11.4). Recherche full-text PostgreSQL derrière un port.
- Schéma PostgreSQL : `discovery` (`packages/db/src/schemas/discovery.ts`).
- Dépendances autorisées : profiles, organizations, projects, impact, network. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : aucun prévu (consomme les événements pour l'indexation).
