# 0147. Brouillons de la messagerie

Statut : acceptée (2026-10-11).

## Contexte

Un message commencé dans une conversation se perd si l'on change de conversation, recharge la page ou ferme l'onglet. Le composeur des publications garde déjà son brouillon sur l'appareil (ADR 0122) ; une conversation en demande un par conversation.

## Décision

- Le texte en cours de chaque conversation est gardé sur l'appareil, dans IndexedDB (base `pitchorium-message-drafts`, une entrée par conversation : membre, date, texte ; `lib/drafts/message-drafts.ts`), écrit 400 ms après la dernière frappe, relu à l'ouverture de la conversation.
- Il est effacé à l'envoi, quand le champ est vidé, à la déconnexion (toutes les entrées) et après 30 jours (provisoire). Le brouillon d'un autre membre du même appareil est effacé à la lecture.
- Le texte seul : un fichier se choisit de nouveau (ses envois au module media sont nettoyés par l'api).
- Un navigateur sans IndexedDB (navigation privée) ne garde rien ; rien n'est jamais envoyé à l'api.

## Conséquences

- Le module des brouillons n'est chargé qu'avec le composeur, lui-même chargé après la page, et à la déconnexion.
- Un test unitaire couvre la lecture par conversation, l'effacement et l'expiration ; un parcours simulé retrouve le brouillon après un rechargement et ne le montre pas dans une autre conversation.
