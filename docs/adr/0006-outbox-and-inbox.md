# 0006. Outbox et inbox

Statut : acceptée (2026-10-07)

## Contexte

Les modules réagissent les uns aux autres de façon asynchrone (notifications, indexation, paiements). Publier dans une file après le commit perd des événements en cas d'arrêt ; publier avant publie des faits annulés. Les webhooks des prestataires de paiement peuvent être livrés plusieurs fois.

## Décision

- Outbox transactionnelle : `OutboxService.record` écrit dans `platform.outbox_events` dans la transaction métier (via `TransactionManager`, AsyncLocalStorage) et refuse d'écrire hors transaction.
- Relais dans le worker : lecture `FOR UPDATE SKIP LOCKED`, publication dans BullMQ avec l'identifiant de l'événement comme `jobId`, backoff exponentiel plafonné en cas d'échec.
- Inbox : `platform.inbox_messages` (unique par source et identifiant externe) ; l'enregistrement et le traitement se font dans la même transaction. Les handlers d'événements internes utilisent l'inbox avec la source `outbox:<nom du handler>`.

## Conséquences

- Livraison au moins une fois, effets au plus une fois par handler.
- Pas d'ordre global garanti entre événements.
- Latence de publication bornée par `OUTBOX_POLL_INTERVAL_MS`.
