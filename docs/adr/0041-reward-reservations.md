# 0041. Réservation des contreparties

Statut : acceptée (2026-10-08)

## Contexte

Une contrepartie peut être en quantité limitée (§11.3, quantités suivies en V2). Entre le choix d'une contrepartie et la confirmation du paiement par le prestataire (§9.3), plusieurs contributeurs peuvent viser la dernière unité ; un paiement peut aussi échouer ou être remboursé. Les webhooks des prestataires peuvent être rejoués.

## Décision

- Compteurs `reserved` et `confirmed` sur la contrepartie, et une réservation par contribution (`reward_reservations`, clé : identifiant de la contribution du module payments).
- `reserve(rewardId, contributionId)` verrouille la ligne de la contrepartie (`SELECT ... FOR UPDATE`) dans une transaction, vérifie que le projet est ouvert et qu'une unité reste (`quantity - reserved - confirmed`), insère la réservation et incrémente `reserved`. Rejouer la même contribution renvoie sa réservation ; une autre contrepartie pour la même contribution est un conflit. La dernière unité réservée émet `projects.reward.sold-out.v1`.
- `confirm(contributionId)` passe l'unité de `reserved` à `confirmed` ; `release(contributionId)` la rend disponible (paiement échoué, remboursement). Les deux sont idempotents et relisent la réservation sous le verrou de la contrepartie.
- Une quantité illimitée (`null`) ne refuse jamais ; une quantité ne peut pas descendre sous les unités prises ; une contrepartie réservée ne peut pas être supprimée.

## Conséquences

- 50 réservations simultanées sur un stock de 10 donnent exactement 10 réservations (test unitaire avec verrou simulé, test d'intégration contre PostgreSQL).
- L'expiration des réservations jamais confirmées dépendra du module payments (délai de paiement du prestataire) ; elle se fera par `release`.
