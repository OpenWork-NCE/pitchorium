# 0070. Événements gratuits uniquement

Statut : acceptée (2026-10-08).

## Contexte

Une billetterie payante ferait de Pitchorium un intermédiaire de paiement pour un autre usage que les contributions aux projets : nouveaux flux de fonds, remboursements en cas d'annulation, TVA sur les billets, obligations d'organisateur. Le cahier des charges ne la demande pas, et le modèle de paiement retenu (ADR 0043) ne couvre que les contributions.

## Décision

- Les événements sont gratuits : ni prix, ni billet, ni paiement, ni lien vers une billetterie externe dans le modèle.
- L'inscription réserve une place dans la limite de la capacité ; au-delà, le membre rejoint une liste d'attente ordonnée par date d'inscription. Une place libérée (désinscription, hausse de capacité) va au premier de la liste, dans la même transaction que la libération, et le membre promu est notifié. Une capacité absente signifie illimitée.
- La capacité ne descend jamais sous le nombre d'inscrits ; les écritures d'un événement sont sérialisées par le verrou de sa ligne.

## Conséquences

- La billetterie payante est hors périmètre (consigné dans `docs/open-questions.md`) ; l'introduire demanderait une décision sur le prestataire, la TVA et les remboursements.
- Un organisateur qui veut faire payer passe par ses propres outils, en dehors de la plateforme.
