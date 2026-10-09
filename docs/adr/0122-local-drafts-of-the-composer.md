# 0122. Brouillons locaux du composeur

Statut : acceptée (2026-10-09).

## Contexte

Une publication s'écrit souvent en plusieurs fois, sur un téléphone, avec une connexion qui coupe : perdre un texte et des images déjà envoyées décourage de publier. Garder le brouillon sur le serveur ajouterait une donnée personnelle à exporter et à effacer pour un gain faible.

## Décision

- Pendant la saisie, le brouillon (document de l'éditeur, audience, langue, images envoyées avec leur texte alternatif, document, lien et aperçu demandé, projet) est enregistré dans IndexedDB (base `pitchorium-drafts`), 600 ms après la dernière modification (`lib/drafts/composer-drafts.ts`). Il n'est jamais envoyé.
- Il appartient à son membre : le brouillon d'un autre membre est effacé à la lecture. Il est rendu à la réouverture du composeur, avec « Effacer le brouillon ».
- Il est effacé après la publication, quand tout est vidé, et à la déconnexion (avec les actions hors ligne, ADR 0102).
- Les fichiers d'un brouillon de plus de 20 heures sont oubliés (le module media supprime un fichier jamais attaché après 24 heures) ; son texte reste.
- Une publication en cours de modification n'a pas de brouillon.

## Conséquences

- Un brouillon survit à la fermeture de l'onglet, au rechargement et à une coupure, sur cet appareil seulement.
- Un navigateur sans IndexedDB (navigation privée) ne garde rien, sans erreur.
- Tests unitaires : retrouvé pour son membre, effacé pour un autre et quand il est vide, fichiers oubliés après le délai.
