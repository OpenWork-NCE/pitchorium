# 0137. Interrogation de l'état au retour du prestataire

Statut : acceptée (2026-10-10).

## Contexte

Le prestataire renvoie le navigateur vers `/contributions/{id}/return` (adresse donnée par l'api). Cette adresse ne prouve rien : un contributeur peut l'ouvrir sans avoir payé, un paiement peut être confirmé après le retour (SEPA, Mobile Money), et le webhook peut arriver après. Seule l'api dit qu'un paiement est final.

## Décision

- Le serveur ne lit dans l'adresse que l'identifiant (un UUIDv7, rien d'autre n'est cru), puis la contribution par l'api ; 404 si elle n'est pas celle du membre.
- Le navigateur demande d'abord à l'api de relire l'état chez le prestataire (`POST /v1/me/contributions/{id}/return`), puis relit la contribution toutes les 3 secondes tant que l'onglet est visible, deux minutes de temps visible au plus (`lib/poll.ts`, testé avec une horloge simulée) : pause quand l'onglet est masqué, lecture immédiate au retour sur l'onglet, arrêt sur un état final, arrêt sur un refus 4xx, nouvel essai sur une erreur réseau.
- Trois écrans : en attente (indicateur sobre, possibilité de partir, « Vérifier à nouveau » après le délai, qui relit aussi le prestataire) ; payé (coche dessinée, montant compté en unités mineures, paliers dont le premier déblocage suit la création de la contribution, mention « pas un reçu fiscal », suivre et partager, WhatsApp en premier) ; non payé (`failed`, `expired`, `canceled` : explication, rien n'est prélevé, « Réessayer » avec les choix de la contribution).
- Pas de confettis ni d'effet festif (`ELITE-MOTION.md`) ; avec moins de mouvement, l'état final s'affiche directement.

## Conséquences

- Un paiement long à confirmer ne bloque personne : le membre retrouve son état dans ses contributions.
- La page n'affiche jamais « payé » sur la foi de l'adresse ni d'un paramètre du prestataire.
