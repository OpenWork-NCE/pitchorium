# 0029. Blocage

Statut : acceptée (2026-10-07), complétée le 2026-10-08 (profils masqués)

## Contexte

Un réseau d'affaires doit permettre de couper tout contact avec un membre importun (§13). Le blocage touche le réseau, le fil (publications, commentaires, réactions, mentions) et plus tard la messagerie ; le signalement relève du module trust.

## Décision

- Table `blocks` (bloqueur, bloqué). Bloquer, dans une transaction verrouillée sur la paire : supprime la connexion et les suivis entre les deux, dans les deux sens, ferme les demandes en attente (`cancelled`) et émet `network.block.created.v1`. Débloquer ne rétablit rien.
- Effet symétrique : aucun des deux ne peut demander une connexion, suivre, commenter, réagir ou mentionner l'autre, et leurs contenus sont masqués l'un pour l'autre.
- Le membre bloqué n'apprend pas le blocage : la relation, les listes et les actions répondent 404 comme pour un membre inconnu. Le bloqueur reçoit `NETWORK_MEMBER_BLOCKED` sur une action envers le membre qu'il a bloqué.
- La façade expose `blockedUserIds` (les deux sens) et `isBlockedBetween` ; content les applique au fil et aux interactions, messaging les appliquera.
- Profils : les deux membres ne voient plus le profil l'un de l'autre. profiles déclare le port `ProfileAccessFilter` (`hiddenFrom(viewerId, userIds)`), que network implémente (`BlockedProfilesFilter`) et enregistre au démarrage par `registerProfileAccessFilter`, comme les types de cibles de suivi : profiles ne dépend pas de network. Sans filtre enregistré, le port ne masque rien.
- Le filtre s'applique à la vue membre (`GET /v1/profiles/{handle}`, identifiant actuel ou ancien : 404 `PROFILES_PROFILE_NOT_FOUND`, sans redirection), et, quand l'appelant passe le lecteur, à la lecture par identifiant public (`userIdOf`), aux mentions (`userIdsByHandles` : la mention d'un membre masqué reste du texte, comme un identifiant que personne ne porte), aux cartes (`memberCards` : auteurs, mentions affichées, commentaires, membres d'une organisation). Les listes de network excluaient déjà les membres bloqués.

## Conséquences

- Le membre bloqué reçoit la même réponse que pour un profil inexistant ; rien ne révèle le blocage, sauf au bloqueur dans ses propres actions réseau (`NETWORK_MEMBER_BLOCKED`) et sa liste de blocages.
- La page publique d'un profil (`GET /v1/public/profiles/{handle}`, sans session) reste lisible par tous, y compris par un membre bloqué déconnecté : elle est publique par choix de son titulaire.
- network résout lui-même les identifiants publics sans filtre (`userIdOf` sans lecteur), pour appliquer ses règles propres (404 pour le bloqué, `NETWORK_MEMBER_BLOCKED` pour le bloqueur, déblocage).
- Le code `CONTENT_MENTION_NOT_ALLOWED` ne sert plus qu'en garde-fou si aucun filtre n'est enregistré.
- Les listes de blocages sont courtes : le fil passe les identifiants bloqués en paramètre de sa requête.
