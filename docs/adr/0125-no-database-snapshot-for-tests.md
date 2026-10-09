# 0125. Pas d'instantané de base pour les tests

Statut : acceptée (2026-10-10).

## Contexte

Il était proposé de remplacer, dans les suites de bout en bout, les migrations et les données de démonstration par un instantané (`pg_dump` au format personnalisé et médias de MinIO), indexé par l'empreinte des migrations, du code du seed et des fixtures, restauré en quelques secondes et régénéré quand l'empreinte change.

Mesures : migrations et `db:seed` 1 s, `db:seed:dev` 4 à 8 s sur le poste et 7 s dans la CI, soit environ 9 s par pile de parcours, hors des cinq postes les plus coûteux (ADR 0123). Les données de démonstration sont datées par rapport à l'instant du seed (`new Date()` : événements à venir, échéances, publications récentes) : un instantané de plusieurs jours décalerait ces dates et rendrait des parcours instables.

## Décision

- Pas d'instantané : chaque pile de test applique les migrations, `db:seed` et `db:seed:dev`, qui restent la seule source des données.
- La décision est à revoir si la préparation de la base dépasse 60 s par pile ; l'empreinte devrait alors inclure la date du jour.

## Conséquences

- Aucun cache à maintenir ni à prouver identique à une base fraîchement préparée.
- Chaque pile de parcours garde ses 9 s de préparation.
