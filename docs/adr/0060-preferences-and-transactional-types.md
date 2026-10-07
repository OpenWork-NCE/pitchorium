# 0060. Préférences et types transactionnels

Statut : acceptée (2026-10-08).

## Contexte

Le §10.5 prévoit des notifications in-app et email ; un membre doit pouvoir réduire ce qu'il reçoit, sauf ce qui touche à la sécurité, à l'argent et à ses obligations.

## Décision

- Préférence par type et par canal (`in_app`, `email`), stockée seulement quand le membre choisit ; sinon les canaux par défaut du type.
- Types transactionnels (sécurité, paiements, KYC, conditions) : canaux par défaut imposés, email immédiat, modification refusée (`NOTIFICATIONS_PREFERENCE_LOCKED`), sans lien de désinscription.
- Le mode email est figé à la création de la notification (`immediate`, `digest` ou `off`) ; sans aucun canal, aucune notification n'est créée.
- Port `NotificationChannelAdapter` : `in_app` (Socket.IO) et `email` aujourd'hui ; un canal push s'ajoutera par ce port.
- Les emails déjà envoyés par leurs modules (invitation d'organisation à jeton, décisions d'organisation, alertes de sécurité) ne sont pas doublés : ces types sont in-app par défaut.

## Conséquences

- Les canaux par défaut de chaque type sont à valider (`docs/open-questions.md`).
