# 0030. Mécanisme des vues de profil

Statut : acceptée (2026-10-07)

## Contexte

« Voir qui a consulté son profil, avec option de visite privée » (§10.2). La lecture d'un profil appartient à profiles, les vues à network ; network dépend de profiles, pas l'inverse. Une vue n'a pas de valeur transactionnelle : en perdre quelques-unes est acceptable, ralentir la lecture d'un profil ne l'est pas. Il faut dédupliquer par visiteur, profil et jour.

## Décision

- profiles expose un point d'extension (`ProfileViewListener`) que network enregistre au démarrage, comme l'annuaire des organisations : pas de dépendance cyclique. profiles le notifie après la lecture membre d'un autre profil, sans attendre ni propager d'erreur.
- network pousse la vue dans Redis sans l'attendre : un script Lua pose un marqueur `seen:<jour>:<visiteur>:<visité>` (`SET NX`, 2 jours) et ne met la vue en file que s'il est nouveau ; un seul aller-retour, déduplication avant la base.
- Le worker vide la file chaque minute par lots de 500 (`LPOP` avec compte) et insère avec `ON CONFLICT DO NOTHING` sur la clé (visité, jour, visiteur) : la base reste la garantie d'unicité. La préférence de visite privée du visiteur est lue au moment de l'écriture et figée avec la vue.
- Écartés : l'outbox (une écriture transactionnelle par lecture de profil, et un événement par vue), une route appelée par le client (contournable, et dépendante du frontend), une écriture synchrone en base (lecture ralentie).

## Conséquences

- Une vue apparaît dans les statistiques en une minute environ ; une panne de Redis ou un arrêt du worker entre la lecture de la file et l'insertion perd les vues concernées (toléré).
- Un changement de préférence ne réécrit pas les vues passées : une visite privée le reste.
- La rétention (`NETWORK_PROFILE_VIEWS_RETENTION_DAYS`, 90 jours provisoires) est appliquée par une purge quotidienne.
