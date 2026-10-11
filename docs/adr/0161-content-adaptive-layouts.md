# 0161. Mises en page qui s'adaptent au contenu

Statut : acceptée (2026-10-11).

## Contexte

Les listes de projets du site public et de la vitrine posaient une grille de trois colonnes quel que soit leur nombre : une carte seule occupait un tiers de la largeur, deux cartes laissaient une colonne vide, une section sans projet restait affichée. La direction artistique refuse les grilles à moitié remplies et les sections vides.

## Décision

- `gridLayout(count)` (`features/projects/lib/grid-layout.ts`, règle pure testée) choisit la mise en page d'après le nombre de cartes : aucune pour 0 (la section est masquée), `feature` pour 1 (une grande carte pleine largeur, couverture à côté du texte à partir de `md`, variante `feature` de `ProjectCard`), `pair` pour 2 (deux colonnes), `grid` à partir de 3.
- `ProjectGrid` (façade de `features/projects`) l'applique ; il sert la section « Des projets à découvrir » de l'accueil et la « Sélection de l'équipe » de la vitrine.
- Accueil : la sélection éditoriale de l'api (`featured`) est complétée par les projets en financement les plus récents, jusqu'à trois, sans doublon (`homeProjects`).

## Conséquences

- Une nouvelle liste de cartes de projets passe par `ProjectGrid` plutôt qu'une grille fixe.
- Les autres listes à nombre variable (Découvrir, recherche) suivent la même règle : aucune colonne vide pour une ou deux cartes.
