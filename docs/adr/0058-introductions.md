# 0058. Introductions à trois

Statut : acceptée (2026-10-08).

## Contexte

Le §10.4 et le §14 (V2) prévoient l'introduction à trois : A présente B à C, geste propre aux réseaux d'affaires.

## Décision

- A propose une introduction de B et C avec une note ; A doit être connecté à B et à C, et B et C ne doivent pas être séparés par un blocage. Une seule introduction en attente par trio (index unique partiel).
- B et C répondent chacun une fois. Un refus clôt l'introduction (`declined`, A en est informé) ; deux acceptations la concluent (`completed`).
- La conclusion ouvre, dans la même transaction, une conversation de groupe de trois membres dont le premier message (`kind: introduction`) est la note de A. C'est la seule façon de créer une conversation de groupe. A peut ensuite la quitter.
- Événements `messaging.introduction.proposed|accepted|declined|completed.v1` pour les notifications.

## Conséquences

- La conversation de groupe ne passe jamais par une demande de message : chacun a consenti en acceptant.
- La longueur de la note (1 000 caractères) est provisoire (`docs/open-questions.md`).
