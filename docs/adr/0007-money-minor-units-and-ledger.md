# 0007. Argent en unités mineures et ledger

Statut : acceptée (2026-10-07)

## Contexte

La plateforme encaisse réellement (dons, crowdfunding, love money) en plusieurs devises (EUR, XOF, XAF...) et prélève une commission. Les flottants produisent des erreurs d'arrondi.

## Décision

- Montants en entiers d'unités mineures : `bigint` + colonne de devise ISO 4217 en base, value object `Money` (bigint) dans le code, chaîne d'entiers dans l'API.
- Répartitions sans perte via `Money.allocate`.
- Les mouvements financiers du module `payments` seront enregistrés dans un ledger en écritures immuables (double entrée), les soldes étant dérivés et jamais saisis.

## Conséquences

- Aucun montant ne transite en flottant, y compris côté client.
- Le nombre de décimales par devise et la devise de libellé des campagnes restent à décider (voir `docs/open-questions.md`).
