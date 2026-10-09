# 0121. Virtualisation et accessibilité du fil

Statut : acceptée (2026-10-09). Complète l'ADR 0032.

## Contexte

Le fil se lit page par page sans fin ; au bout de quelques pages, des centaines d'articles avec leurs images et leurs boutons alourdissent la page d'un téléphone de milieu de gamme. Ne rendre que les articles proches de l'écran (virtualisation) ne doit casser ni le lecteur d'écran, ni le clavier, ni le retour arrière, ni le premier rendu par le serveur.

## Décision

- Motif WAI-ARIA `feed` : `role="feed"` nommé, chaque entrée un `article` focalisable avec `aria-posinset` et `aria-setsize` (`-1` tant qu'une page suit), `aria-busy` pendant le chargement de la suivante ; Page suivante et Page précédente déplacent le focus d'un article à l'autre (en faisant venir un article non rendu), Ctrl Fin et Ctrl Début sortent du fil. Les modules de suggestions d'un écran étroit sont des articles nommés.
- Virtualisation (TanStack Virtual 3.14.13, fenêtre) dans le flux de la page : les entrées proches de l'écran sont rendues normalement, entre deux espaces de la hauteur mesurée des autres ; aucune position absolue, donc aucun décalage quand une hauteur se corrige.
- Les six premières entrées sont rendues par le serveur et hydratées telles quelles ; ensuite seulement, la liste virtualisée prend le relais, à partir de leurs hauteurs réelles. Un membre qui fait défiler avant la fin de l'hydratation (fréquent sur une connexion lente) ne provoque ni écart d'hydratation ni saut.
- La page suivante est demandée quand les dernières entrées approchent de l'écran ; « Afficher plus » reste pour le clavier et les technologies d'assistance.
- Retour par l'historique : la position (défilement et hauteurs mesurées) est gardée pour l'onglet (`sessionStorage`, 30 minutes) et rendue au retour, les pages déjà lues restant dans le cache de TanStack Query.
- Une publication masquée ou supprimée quitte la liste par une transformation ; les suivantes remontent par une animation de transformation (FLIP), jamais par une animation de hauteur.

## Conséquences

- Le nombre de nœuds de la page reste borné quelle que soit la longueur du fil.
- La recherche dans la page du navigateur (Ctrl F) ne trouve que les entrées rendues : limite connue de toute virtualisation.
- Tests : parcours au clavier, position rendue au retour arrière, entrées et modules à leur place, défilement avant l'hydratation sans erreur (console propre).
