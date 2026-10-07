# Module messaging

- Responsabilité : Messagerie : conversations 1:1, lu et non lu, copie par email si le destinataire l'a accepté, transfert d'une publication en message (§10.3, §10.4).
- Schéma PostgreSQL : `messaging` (`packages/db/src/schemas/messaging.ts`).
- Dépendances autorisées : identity, profiles, network. Accès uniquement par `index.ts` ; aucune lecture de tables d'un autre schéma.
- Événements émis (indicatifs, à confirmer) : `messaging.message.sent.v1`, `messaging.conversation.read.v1`.
