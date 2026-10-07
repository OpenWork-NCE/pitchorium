# Module localization

- Responsabilité : Langues : préférence de compte, détection depuis le navigateur, langues activées selon les flags `locale.*`, traduction à la demande des contenus utilisateur avec mention « Traduction automatique » (§8, §14).
- Schéma PostgreSQL : `localization` (`packages/db/src/schemas/localization.ts`).
- Dépendances autorisées : identity. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `localization.preference.changed.v1`.
