# Écart de rapprochement

Le rapprochement quotidien compare les transactions des prestataires au ledger et aux montants des projets (`docs/architecture/payments.md`).

1. Lister : `GET /v1/admin/payments/discrepancies` (ou `pnpm payments:reconcile --days 3`).
2. Pour chaque écart, selon son type : paiement absent du ledger (webhook perdu : rejouer, voir `webhooks.md`), montant différent (change, frais : comparer au détail du prestataire), remboursement ou litige non répercuté.
3. Corriger par le flux normal (rejeu du webhook, remboursement depuis `/v1/admin/payments/contributions/{id}/refunds`) ; jamais d'écriture manuelle en base.
4. Clore l'écart : `POST /v1/admin/payments/discrepancies/{id}/resolve` avec la résolution (auditée).
5. Un écart non expliqué est un incident (`incident.md`).
