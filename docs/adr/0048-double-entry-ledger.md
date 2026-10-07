# 0048. Ledger en partie double et rapprochement

Statut : acceptée (2026-10-07). Précise l'ADR 0007.

## Contexte

L'argent doit être exact, traçable et réconciliable avec les prestataires. Le collecté d'un projet est tenu par le module projects ; les paiements, par le module payments.

## Décision

- Ledger en partie double, en unités mineures, par devise : une écriture par événement financier (`payment_succeeded`, `provider_fee`, `refund`, `dispute_opened`, `dispute_won`, `dispute_lost`, `offline_validated`), unique par type et identifiant source, jamais modifiée ; une correction est une contre-écriture (`reverses_entry_id`).
- Chaque écriture s'équilibre par devise, vérifié à sa construction (`assertBalanced`) et testé pour chaque type.
- Plan de comptes dans `docs/architecture/payments.md` ; les comptes mémo EUR `funding_sources` et `project_funding` rendent le collecté de chaque projet réconciliable.
- Rapprochement quotidien : transactions des prestataires contre contributions, contributions contre leurs lignes, équilibre global, totaux des projets contre `project_funding`. Les écarts sont enregistrés, journalisés en `error`, comptés par une métrique et traités par un administrateur ; rien n'est corrigé automatiquement.

## Conséquences

- Les montants ne sont jamais déduits de soldes saisis : ils se lisent dans le ledger.
- Un écart détecté au traitement d'une notification (montant différent, paiement après expiration) est enregistré de la même façon, sans exécution de rapprochement.
