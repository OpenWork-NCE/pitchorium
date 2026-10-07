# 0028. Connexion et suivi mutuel

Statut : acceptée (2026-10-07)

## Contexte

Le cahier des charges distingue le suivi (unilatéral, pour voir les actualités) et la connexion (relation d'affaires avec note de 300 caractères et acceptation) (§10.2). Il faut définir leur lien, le calcul du degré de relation et des connexions en commun, et des protections contre l'abus de demandes, sans valeurs fournies.

## Décision

- Demandes dans `connection_requests` (statuts `pending`, `accepted`, `declined`, `withdrawn`, `expired`, `cancelled`), une seule en attente par paire (index unique sur `least`/`greatest` des deux identifiants). Une demande qui croise une demande en attente du destinataire l'accepte.
- Connexions dans `connections`, une ligne par sens : toute requête part de `user_id` (liste, test, intersection).
- Une connexion acceptée crée le suivi mutuel (origine `connection`). Chacun peut cesser de suivre l'autre sans rompre la connexion ; le fil suit les suivis, pas les connexions. Supprimer la connexion retire seulement les suivis d'origine `connection`.
- Anti-abus configurable, valeurs provisoires : 100 demandes sur sept jours glissants, 21 jours avant de solliciter de nouveau un membre qui a refusé, expiration des demandes après 30 jours. Le refus n'est pas notifié comme tel à l'émetteur (la demande sort de sa liste en attente).
- Degré calculé jusqu'au 2e seulement (connexions en commun > 0) : un 3e degré demanderait de parcourir les connexions de chaque connexion. Le nombre de connexions en commun est compté par intersection sur la clé primaire, arrêtée à `NETWORK_MUTUAL_CONNECTIONS_CAP` (999, affiché « 999+ ») : coût borné par la plus petite des deux listes et par le plafond.
- Écritures entre deux membres sérialisées par un verrou transactionnel sur la paire ; le plafond hebdomadaire par un verrou par émetteur.

## Conséquences

- Les valeurs anti-abus sont des questions ouvertes ; elles se règlent par variables d'environnement.
- Les demandes expirées sont fermées par une tâche planifiée et à la volée lors d'une nouvelle demande.
- Le hors réseau inclut le 3e degré et au-delà.
