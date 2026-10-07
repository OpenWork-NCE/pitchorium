# 0029. Blocage

Statut : acceptée (2026-10-07)

## Contexte

Un réseau d'affaires doit permettre de couper tout contact avec un membre importun (§13). Le blocage touche le réseau, le fil (publications, commentaires, réactions, mentions) et plus tard la messagerie ; le signalement relève du module trust.

## Décision

- Table `blocks` (bloqueur, bloqué). Bloquer, dans une transaction verrouillée sur la paire : supprime la connexion et les suivis entre les deux, dans les deux sens, ferme les demandes en attente (`cancelled`) et émet `network.block.created.v1`. Débloquer ne rétablit rien.
- Effet symétrique : aucun des deux ne peut demander une connexion, suivre, commenter, réagir ou mentionner l'autre, et leurs contenus sont masqués l'un pour l'autre.
- Le membre bloqué n'apprend pas le blocage : la relation, les listes et les actions répondent 404 comme pour un membre inconnu. Le bloqueur reçoit `NETWORK_MEMBER_BLOCKED` sur une action envers le membre qu'il a bloqué.
- La façade expose `blockedUserIds` (les deux sens) et `isBlockedBetween` ; content les applique au fil et aux interactions, messaging les appliquera.

## Conséquences

- Le profil d'un membre reste lisible par celui qu'il a bloqué (profiles ne dépend pas de network) ; seuls le réseau et les contenus sont masqués.
- Les listes de blocages sont courtes : le fil passe les identifiants bloqués en paramètre de sa requête.
