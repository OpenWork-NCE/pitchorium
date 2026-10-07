# 0017. Confidentialité par défaut

Statut : acceptée (2026-10-07)

## Contexte

Le RGPD (article 25) impose que, par défaut, les données personnelles ne soient pas rendues accessibles à un nombre indéterminé de personnes sans intervention de la personne. Le cahier des charges (§10.1, §13) prévoit des pages publiques paramétrables et des détails métier publics ou privés.

## Décision

- Page publique désactivée par défaut, activable par le membre ; désactivée, elle répond 404, y compris depuis un ancien identifiant (ni l'existence ni le nouvel identifiant ne fuient).
- Trois niveaux (`public`, `members`, `private`) réglés séparément pour les détails du volet entrepreneur, ceux du volet contributeur et les listes de réseau ; défaut : `members`.
- La vue publique et la vue membre sont construites par une fonction pure qui n'expose que les champs autorisés ; l'intention, la visibilité et l'identifiant utilisateur ne sont visibles que du titulaire.
- La lecture publique est cachée au plus 60 secondes par les caches partagés, pour qu'une désactivation prenne effet rapidement.

## Conséquences

- L'existence d'un volet reste visible à qui voit le profil (`facets`), même quand ses détails sont masqués.
- Le module network appliquera le réglage des listes de réseau.
