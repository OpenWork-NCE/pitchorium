# 0133. Couverture publique des paiements

Statut : acceptée (2026-10-10).

## Contexte

Un porteur doit savoir, avant de s'inscrire, s'il peut recevoir des contributions et à quelles conditions ; un contributeur, quels moyens existent pour son pays (§9.2, §9.3). La matrice de capacités (ADR 0043) n'était lisible que dans le code et la documentation. Un écran qui recopierait la couverture la laisserait dériver de ce que l'api accepte.

## Décision

- `GET /v1/public/payments/coverage`, sans session ni secret, avec un cache public d'une heure : la matrice est une donnée de déploiement.
- La réponse est construite à partir de la matrice (`domain/coverage.ts`), pour les prestataires actifs seulement : une capacité `verified: false`, ou qu'aucun pays de versement vérifié ne peut atteindre (paiement dans une devise locale non réglée), n'apparaît pas. Le prestataire simulé apparaît seul en mode simulé.
- Uniquement des codes stables : prestataire, pays ISO 3166-1, devise ISO 4217, moyen, opérateur de Mobile Money, conditions et pièces d'éligibilité, portée (`all`, `company`). Chacun a un libellé dans `packages/i18n` ; la réponse ne contient aucun texte.
- La version de la matrice et la date depuis laquelle toutes ses entrées ont été vérifiées sont exposées : changer une entrée, c'est vérifier la source et changer la version.
- Les conditions d'éligibilité de chaque prestataire font partie de la matrice, avec leurs sources (vérifiées le 2026-10-10, `docs/architecture/payments.md`).

## Conséquences

- Le front affiche la couverture et les conditions sans les recopier ; une capacité désactivée disparaît partout à la fois.
- Une route publique de plus dans l'inventaire revu (`route-inventory.spec.ts`, `docs/security/review.md`).
- Les opérateurs de Mobile Money deviennent des codes, aussi dans les options de paiement et les devis.
