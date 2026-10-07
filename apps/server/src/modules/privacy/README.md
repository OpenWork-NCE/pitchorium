# Module privacy

- Responsabilité : Vie privée et RGPD : export et suppression de compte, paramètres de visibilité (listes de réseau, détails métier publics ou privés), consentements (§10.1, §13).
- Schéma PostgreSQL : `privacy` (`packages/db/src/schemas/privacy.ts`).
- Dépendances autorisées : identity et la façade de chaque module concerné par l'export ou la suppression. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `privacy.export.requested.v1`, `privacy.erasure.requested.v1`.
