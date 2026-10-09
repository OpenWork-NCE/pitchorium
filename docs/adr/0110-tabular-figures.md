# 0110. Chiffres tabulaires

Statut : acceptée (2026-10-09).

## Contexte

Poppins, police du texte (ADR 0087), n'a pas de chiffres à chasse fixe : ni fonctionnalité `tnum`, ni chiffres de même largeur par défaut (de 320 à 635 unités pour le 400). `tabular-nums` n'y change rien : les montants d'une colonne, les compteurs qui changent et les statistiques se désalignent. Les tableaux financiers (PROMPT FRONT 5B), les statistiques et les tableaux d'administration en dépendent.

## Mesures (fonttools 4.66.1, 2026-10-09)

- Poppins 400, 500 et 600 : pas de `tnum` (ni `pnum`, ni `lnum`), chiffres de largeurs différentes.
- Bricolage Grotesque (kit, statique 800 et variable) : `tnum`, `pnum` et `lnum` ; avec `tnum`, chaque chiffre mesure 580 unités (taille optique d'affichage) ; l'instance 800 servie par le web garde `tnum`.
- Noto Sans (dépôt Google Fonts, variable) : `tnum`, chiffres déjà de même largeur (572 unités) ; son sous-ensemble de repli ne contient aucun chiffre.

## Décision

- Les nombres alignés (colonnes numériques de `Table`, `Text numeric`) prennent les chiffres tabulaires de Bricolage Grotesque, la police de titre de la marque : aucune troisième famille. `pnpm brand:sync` produit `bricolage-grotesque-figures.woff2` depuis la police variable du kit : chiffres et ce qui les sépare (signes, séparateurs des milliers et des décimales, espaces fines du français, pourcentage), taille optique du texte (14), chasse 100, graisses 400 à 600 ; avec `tnum`, chaque chiffre mesure 616 unités.
- Pile `font-numeric` : ce sous-ensemble, par sa `unicode-range`, puis Poppins pour le reste ; avec `tabular-nums`. Fichier de 9 860 octets, jamais préchargé : seule une page qui affiche un nombre dans cette pile le télécharge.
- `Stat` garde Bricolage Grotesque 800 (rôle d'affichage), dont l'instance servie a ses chiffres tabulaires : la valeur ne bouge pas en largeur pendant qu'elle compte (H17).
- Noto Sans n'est pas retenue : ce serait une troisième famille visible dans chaque tableau, pour un besoin que la police de la marque couvre.

## Conséquences

- Un tableau financier, une statistique ou un compteur s'alignent sans réglage de plus : il suffit de la colonne `align: 'end'` ou de `Text numeric`.
- Un test vérifie que la `unicode-range` déclarée égale les plages du sous-ensemble (`FIGURE_RANGES`).
- Les chiffres d'un nombre aligné ont le dessin de Bricolage au milieu de libellés en Poppins : choix à valider par la marque avec les autres éléments dérivés du guide (question 99).
