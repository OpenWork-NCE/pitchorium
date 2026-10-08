# Relance des webhooks

Webhooks reçus : Stripe et Flutterwave (`/v1/payments/webhooks/<prestataire>`), Resend (`/v1/notifications/webhooks/resend`). Chacun est vérifié (signature) puis traité une fois (inbox).

1. Identifier les échecs : métriques `pitchorium.payments.webhook.failed` et `pitchorium.notifications.webhook.failed`, journaux (`PAYMENTS_WEBHOOK_INVALID`, `NOTIFICATIONS_WEBHOOK_INVALID`).
2. Signature refusée : vérifier le secret (`STRIPE_WEBHOOK_SECRET`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, `RESEND_WEBHOOK_SECRET`) et l'URL déclarée chez le prestataire ; après une rotation, les deux secrets ne coexistent pas : changer le secret côté application puis côté prestataire dans la même fenêtre.
3. Rejouer depuis le tableau de bord du prestataire (Stripe : « Resend » d'un événement ; Flutterwave : « Retry » ; Resend : rejouer l'événement). Un rejeu est sans effet s'il a déjà été traité.
4. Événements perdus au-delà des rejeux : `pnpm payments:reconcile --days <N>` liste les écarts entre le prestataire et le ledger, sans rien corriger ; suivre `reconciliation.md`.
