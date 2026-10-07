# Module engagement

- Responsabilité : Interactions et tableau de bord d'engagement : réactions professionnelles (J'aime, Bravo, Pertinent, Soutien), enregistrements, masquage, suivi de projet, statistiques de vues et de réseau, portefeuille d'impact (montants versés, projets soutenus, heures déclarées, historique téléchargeable) (§9.4, §10.3, §14).
- Schéma PostgreSQL : `engagement` (`packages/db/src/schemas/engagement.ts`).
- Dépendances autorisées : identity, content, projects, payments, missions. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `engagement.reaction.added.v1`, `engagement.item.saved.v1`, `engagement.project.followed.v1`.
