# 0132. Barre d'action mobile de la page projet

Statut : acceptée (2026-10-10)

## Contexte

Sur ordinateur, le bloc financement et les actions de la page projet restent visibles dans la colonne de droite (`position: sticky`). Sur téléphone, le bloc passe en tête de page et disparaît au défilement de l'histoire. La coquille membre n'a jamais de barre inférieure de navigation (ADR 0099).

## Décision

- `MobileActionBar` : une région nommée « Actions du projet », fixée en bas de l'écran sous `lg`, avec l'état de la campagne en quelques mots (pourcentage et jours restants, ou l'état final) et les actions de la page (suivre ; se connecter pour un visiteur ; manifester un intérêt pour un membre).
- Ce n'est pas une navigation : aucun lien de section ni d'onglet, propre à la page projet, absente de l'aperçu et des autres pages. La page réserve sa hauteur en bas pour que rien ne soit masqué ; la zone sûre de l'écran est respectée.
- « Contribuer » s'y ajoutera au FRONT 5B.

## Conséquences

- L'action principale reste à portée de pouce sans réintroduire de barre de navigation.
- Toute action ajoutée à la page projet doit trouver sa place dans cette barre ou dans le bloc financement.
