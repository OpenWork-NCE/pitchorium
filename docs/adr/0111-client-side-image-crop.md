# 0111. Recadrage des images dans le navigateur

Statut : acceptée (2026-10-09).

## Contexte

La photo et la couverture d'un profil, le logo et la couverture d'une organisation ont un format imposé (carré, 4:1) et des dimensions minimales par usage du module media (§10.1, §10.7). Envoyer l'image d'origine laisse le serveur choisir le cadrage, transfère des fichiers de plusieurs mégaoctets sur des connexions mobiles lentes (Afrique, Caraïbes) et ne montre pas le résultat avant l'envoi.

## Décision

- Le membre choisit, cadre et zoome l'image dans le navigateur (`react-easy-crop` 6.2.4, chargé avec le dialogue seulement, ADR 0094), au ratio de sa place.
- La région retenue est dessinée sur un `canvas` à la taille de la plus grande variante gardée par l'api, jamais sous le minimum de l'usage (`IMAGE_FORMATS`, `outputSize` dans `features/media/lib/crop.ts`) ; JPEG pour une photo ou une couverture, PNG pour un logo (sa transparence).
- Le fichier passe par le circuit du module media (adresse d'envoi signée, progression sur un anneau, confirmation, vérifications du worker) avant d'être attaché ; un refus est dit avec sa raison (`reference.mediaRejectionReasons`).
- Le serveur reste seul responsable du nettoyage : le canvas ne transmet que des pixels, mais l'api vérifie toujours le type réel, l'antivirus et retire les métadonnées de chaque variante. Le navigateur ne prétend rien garantir.
- Un composant unique, `ImageCropDialog` (`features/media`), sert le profil et l'organisation : textes de la place en paramètres, `attach` et `remove` fournis par l'appelant.

## Conséquences

- Fichiers envoyés plus petits, cadrage vu avant l'envoi, même rendu sur toutes les pages.
- Un navigateur sans `canvas.toBlob` ne peut pas changer d'image (aucun navigateur cible n'est concerné).
- Les documents justificatifs (PDF, scans) ne passent pas par ce recadrage : ils sont envoyés tels quels.
