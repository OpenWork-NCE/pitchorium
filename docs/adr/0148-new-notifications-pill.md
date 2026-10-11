# 0148. Pastille des nouvelles notifications

Statut : acceptée (2026-10-11).

## Contexte

Le temps réel pousse chaque notification créée ou regroupée (`notifications:notification`). Relire la liste à chaque événement insérerait des lignes au-dessus de celle que l'on lit, ou déplacerait une notification regroupée en tête : la lecture sauterait, comme dans le fil avant l'ADR 0117.

## Décision

- Un événement de notification ne relit jamais la liste. La page des notifications compte les notifications arrivées (identifiants distincts, une notification regroupée comptée une fois) et montre la pastille « N nouvelles notifications », qui glisse depuis le haut (`pill-in`) ; elle relit la première page à la pression, ramène la lecture au début et se retire.
- Les compteurs du bandeau restent exacts en permanence : l'événement `counters` les écrit tels que l'api les donne, et chaque geste (lire, tout lire, supprimer) les relit.
- Hors de la page des notifications, un événement ne fait que mettre à jour les compteurs.

## Conséquences

- Un parcours simulé vérifie qu'une notification poussée ne change pas la liste avant la pression de la pastille.
- La liste n'est jamais relue au montage ni au focus (`refetchOnMount: false`) : seuls les gestes du membre et la pastille la relisent.
