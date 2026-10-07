# 0057. Pas de chiffrement de bout en bout des messages

Statut : acceptée (2026-10-08).

## Contexte

Le §13 exige le signalement et la modération (file d'attente, masquage). Un chiffrement de bout en bout empêcherait la plateforme de lire un message signalé, de le masquer en connaissance de cause et de répondre à une réquisition. Il compliquerait aussi la synchronisation multi-appareils et la copie par email (§10.4).

## Décision

- Les messages ne sont pas chiffrés de bout en bout. Ils sont chiffrés en transit (HTTPS et WSS) et au repos par l'infrastructure (PostgreSQL managé et stockage objet chiffrés, sauvegardes comprises), à exiger de l'hébergeur retenu.
- Les pièces jointes sont privées (bucket privé, URL présignées courtes, lecture limitée aux participants).
- Les événements de domaine ne portent jamais le texte d'un message ; les journaux non plus.
- `moderation_status` sur chaque message, modifiable par le module trust.

## Conséquences

- L'accès des modérateurs aux messages signalés devra être tracé dans le journal d'audit (module trust).
- Les conditions d'utilisation devront dire que les messages ne sont pas chiffrés de bout en bout.
