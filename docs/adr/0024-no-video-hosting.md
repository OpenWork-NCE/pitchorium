# 0024. Pas d'hébergement vidéo

Statut : acceptée (2026-10-07)

## Contexte

La création d'un projet comprend une vidéo (cahier des charges §11.1). Héberger des vidéos demande du transcodage, plusieurs débits, un lecteur et beaucoup de stockage et de bande passante, sans lien avec le cœur du produit.

## Décision

- Aucune vidéo n'est téléversée ni stockée : le module media n'accepte ni type ni usage vidéo.
- La vidéo d'un projet sera un lien YouTube ou Vimeo, validé et intégré par le module projects (prompt 4) : liste fermée d'hôtes, identifiant de la vidéo extrait de l'URL, lecteur intégré sans cookies quand l'hébergeur le permet (`youtube-nocookie.com`).

## Conséquences

- Les porteurs publient leur vidéo sur une plateforme tierce avant de la lier.
- La disponibilité et la confidentialité de la vidéo dépendent de cette plateforme.
