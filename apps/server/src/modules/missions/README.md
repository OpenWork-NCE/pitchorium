# Module missions

- Responsabilité : Mentorat et expertise : disponibilité mentorat, missions d'expertise packagées, journal du temps partagé (heures déclarées) (§6.3, §9.4, §10.1, §14).
- Schéma PostgreSQL : `missions` (`packages/db/src/schemas/missions.ts`).
- Dépendances autorisées : identity, profiles, projects. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `missions.mission.published.v1`, `missions.time.logged.v1`.
