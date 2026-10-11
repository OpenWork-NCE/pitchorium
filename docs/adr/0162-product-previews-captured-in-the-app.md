# 0162. Aperçus du produit capturés dans l'application

Statut : acceptée (2026-10-11).

## Contexte

Le site public décrivait Pitchorium sans le montrer : des cartes de fonctionnalités et un motif de marque. Aucune image externe n'est admise (banques d'images, illustrations ou photos produites par une IA, personnes inventées), ni aucune maquette qui promettrait une interface différente de la vraie.

## Décision

- `pnpm marketing:captures` capture des sections précises de l'application (financement et paliers d'un projet, page projet, suggestions avec leur raison, conversation, notification regroupée, tableau de bord d'engagement) sur le build des tests de bout en bout et l'api simulée, dans l'image Playwright officielle, puis les encode en AVIF et WebP à plusieurs largeurs, dans les deux thèmes (`docs/design/marketing-captures.md`).
- Reproductibles : horloge figée, mouvement réduit, polices chargées, données de démonstration seulement ; encodage sans aléa (test).
- Accueil : composition de trois aperçus légèrement superposés sur ordinateur (page projet, son financement, une notification), entrée D4 décalée et parallaxe de 8 % au plus ; sur téléphone, un seul aperçu sous le titre. Les mêmes aperçus illustrent les rangées éditoriales de l'accueil et les parcours de la page Fonctionnement.
- Performance : dimensions intrinsèques, aperçu principal préchargé pour le thème du système et la taille d'écran, les autres différés ; l'image de l'autre thème n'est jamais téléchargée.

## Conséquences

- Un changement visible d'un écran capturé se termine par la régénération des aperçus, commitée avec lui.
- `sharp` (0.35.5, déjà celui de l'api) devient une dépendance de développement du web.
