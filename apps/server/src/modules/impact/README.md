# Module impact

- Responsabilité : Score d'impact auto-déclaré : 12 critères, paliers émergent, modéré et fort, mention visible, détail consultable, filtres 40+ et 70+ ; aucune certification (§12). Critères et pondérations non fournis (voir `docs/open-questions.md`).
- Schéma PostgreSQL : `impact` (`packages/db/src/schemas/impact.ts`).
- Dépendances autorisées : aucun module métier. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `impact.score.declared.v1`.
