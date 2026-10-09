# 0120. Photos allégées dans le navigateur

Statut : acceptée (2026-10-09). Complète l'ADR 0111.

## Contexte

Une photo de téléphone pèse de 3 à 8 Mo ; le module media en accepte 10 (`post_image`) mais n'en garde que des variantes de 1 600 et 800 pixels de large. Sur une connexion mobile africaine (4G lente, forfait à la donnée), envoyer l'original coûte des dizaines de secondes et autant de mégaoctets pour rien.

## Décision

- Avant l'envoi, une photo JPEG, PNG ou WebP de plus de 1 Mo, ou de plus de 2 048 pixels de côté, est redessinée dans le navigateur (`features/content/lib/image-compression.ts`) : côté le plus long à 2 048 pixels au plus (au-dessus de la plus grande variante, pour une photo verticale 4:5), jamais agrandie, JPEG de qualité 0,82, sur un fond blanc (une transparence deviendrait noire).
- L'orientation de l'appareil est appliquée aux pixels au décodage (`createImageBitmap(file, { imageOrientation: 'from-image' })`), comme le fait le serveur.
- L'original part tel quel quand il est assez léger, quand le navigateur ne sait pas le décoder, ou quand le résultat n'est pas plus léger.
- Le serveur reste seul juge : type réel, antivirus, dimensions, métadonnées retirées de chaque variante (ADR 0022). Le navigateur ne promet rien sur l'EXIF.

## Conséquences

- Une photo de 4,5 Mo part en quelques centaines de kilooctets ; l'état « Allègement de la photo » précède l'envoi dans le composeur.
- Une image PNG transparente lourde perd sa transparence (fond blanc) ; une image légère la garde.
- Tests unitaires : taille ajustée sans agrandissement, seuils, redessin droit en JPEG, repli sur l'original.
