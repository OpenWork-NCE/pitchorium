# 0102. Actions hors ligne gardées après la fermeture de l'onglet

Statut : acceptée (2026-10-08). Complète l'ADR 0097, ferme la question 102.

## Contexte

Une action faite hors ligne attend le réseau en pause (ADR 0097). Fermer l'onglet avant son retour la perdait : un message écrit dans un bus, une réaction ou un commentaire disparaissaient sans que le membre le sache. Garder des écritures sur l'appareil impose des limites : ne jamais y écrire une donnée d'authentification ou de paiement, ne pas les rejouer pour un autre membre du même appareil, ne pas les rejouer au-delà de la mémoire de l'idempotence de l'api.

## Décision

- Liste fermée des mutations gardées (`PERSISTED_MUTATIONS`, `lib/query/persisted-mutations.ts`) : un message (`['messaging', 'send']`), une réaction (`['content', 'reaction']`), un commentaire (`['content', 'comment']`). Leurs variables sont l'action et sa clé `Idempotency-Key` (`{ input, key }`) ; leur appel de l'api est enregistré comme valeur par défaut de leur clé, pour qu'une mutation restaurée, sans fonction propre, puisse partir.
- Seules les mutations en pause de cette liste sont écrites dans IndexedDB (base `pitchorium`, magasin `paused-mutations`), par `dehydrate` de TanStack Query sans aucune requête ; une autre mutation en pause (marquer les notifications lues) reste dans l'onglet. Rien de l'authentification (la session est un cookie `HttpOnly`) ni d'un paiement n'y entre.
- L'enregistrement porte l'identifiant du membre et sa date. À l'ouverture de l'espace membre (`PersistedMutations`, coquille membre), les actions de ce membre de moins de 24 heures sont restaurées puis rejouées dès que le réseau est là, avec leur clé : l'api ne les applique qu'une fois. Celles d'un autre membre ou plus anciennes sont effacées : l'api garde une clé d'idempotence 24 heures, au-delà une action pourrait s'appliquer deux fois.
- L'enregistrement est réécrit à chaque changement des mutations, effacé quand plus rien n'attend, et à la déconnexion (`useSignOut`).
- Les réactions d'une même publication partent dans leur ordre (`scope`).

## Conséquences

- Un navigateur sans IndexedDB (navigation privée stricte) garde le comportement de l'ADR 0097 : rien ne survit à l'onglet.
- Une nouvelle écriture rejouable n'est gardée que si elle entre dans la liste, par décision : jamais par défaut.
- Tests : `persisted-mutations.spec.ts` (liste, rejeu avec la même clé, autre membre, expiration) et le parcours « reaction made offline » de `e2e/member-shell.spec.ts` (fermeture de l'onglet hors ligne, réouverture, une seule écriture à l'api).
