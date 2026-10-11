# 0146. Ancrage et virtualisation de l'historique d'une conversation

Statut : acceptée (2026-10-11).

## Contexte

Une conversation s'ouvre sur son dernier message ; les messages plus anciens arrivent au-dessus quand on remonte (`beforeSequence`, 50 à la fois), un message nouveau arrive en dessous. Insérer du contenu au-dessus de la vue fait sauter la lecture, les fichiers et les publications partagées changent de hauteur après leur chargement, et une longue conversation garde des centaines de lignes dans le document.

## Décision

- Le fil d'une conversation est une suite de lignes (`threadRows`, `features/messaging/lib/thread-rows.ts`) : l'intitulé d'un jour, puis chaque message à sa place dans le groupe de son auteur. La clé d'une ligne est l'identifiant client du message, le même pendant l'envoi et une fois enregistré : le message optimiste n'est jamais remonté.
- Ancrage (`lib/anchor.ts`, fonctions pures testées) : à chaque changement des lignes, la première ligne vue avant le changement reprend la même distance au haut de la vue (`captureAnchor`, `restoreAnchor`). Les messages anciens arrivent au-dessus sans rien déplacer ; un message ajouté en dessous ne déplace rien non plus.
- La fin suit : quand la vue montrait la fin (`isAtEnd`, 48 px de tolérance) ou que le lecteur vient d'écrire, la vue suit le nouveau message ; sinon la pastille « N nouveaux messages » l'annonce sans bouger. Un contenu qui grandit après son affichage (une image, un document, la mesure d'une ligne) garde la fin visible quand elle l'était (`ResizeObserver`).
- Virtualisation : à partir de 150 lignes (`VIRTUALIZE_FROM`), seules les lignes proches de la vue sont dans le document (TanStack Virtual, chargé avec le premier long historique, jamais avec la page). Les positions viennent des mesures du virtualiseur ; une ligne au-dessus de la vue qui change de hauteur déplace le défilement d'autant (comportement de TanStack Virtual), l'ancrage fait le reste.
- Les messages anciens sont demandés quand la vue approche du haut (320 px) ; un bouton « Afficher les messages précédents » fait de même au clavier.

## Conséquences

- Un parcours simulé et un parcours réel vérifient qu'un message lu reste à la même place (à 2 px près) quand les messages anciens arrivent.
- Le défilement est celui du navigateur : ni défilement inversé, ni défilement simulé.
