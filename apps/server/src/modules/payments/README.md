# Module payments

- Responsabilité : Contributions et encaissement réel : don, crowdfunding avec contrepartie, love money, via Flutterwave et Stripe Connect, commission de 5 % prélevée à la source, reçus, repli hors plateforme confirmé par l'entrepreneur, KYC du porteur avant versement, ledger en unités mineures ; equity et prêts derrière les flags `funding.*` (§9).
- Schéma PostgreSQL : `payments` (`packages/db/src/schemas/payments.ts`).
- Dépendances autorisées : identity, profiles, projects. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `payments.contribution.paid.v1`, `payments.contribution.refunded.v1`, `payments.payout.released.v1`, `payments.kyc.verified.v1`.
