# Sauvegardes et reprise

## Objectifs proposés (à valider avec le client)

- **RPO** (perte de données maximale) : 15 minutes pour PostgreSQL (sauvegarde continue des WAL d'un service managé, restauration à un instant donné), 24 heures pour Redis (files et limites de débit, reconstructibles), 24 heures pour les fichiers (copie quotidienne vers un bucket de sauvegarde, faute de versionnage natif vérifié sur R2, voir plus bas).
- **RTO** (durée de remise en service) : 4 heures pour une restauration complète sur une nouvelle infrastructure, 1 heure pour une restauration de base sur l'infrastructure existante.

## PostgreSQL

- Service managé : sauvegarde automatique quotidienne conservée 30 jours et restauration à un instant donné (PITR) ; une copie hebdomadaire `pg_dump -Fc` dans un autre fournisseur ou une autre région.
- Auto-hébergé (`self-hosted`) : `pg_dump -Fc` quotidien chiffré vers un bucket distinct, et archivage des WAL si le RPO de 15 minutes est retenu.
- La restauration ne rejoue pas l'outbox : les événements non publiés au moment de la sauvegarde le sont au redémarrage du worker ; ceux déjà publiés ne le sont pas deux fois (inbox).

### Exercice de restauration

`scripts/restore-drill.sh` (racine) l'exécute réellement sur l'infrastructure locale : copie de la base de développement dans une base d'exercice, sauvegarde `pg_dump -Fc`, destruction de la base, restauration dans une base neuve, vérification (journal des migrations identique, nombre de lignes et empreinte de chaque table identiques). À rejouer à chaque changement d'hébergeur et au moins une fois par trimestre sur une copie de production.

## Redis

Données reconstructibles : files BullMQ (les tâches perdues sont rejouées par l'outbox et les tâches planifiées), limites de débit, salles Socket.IO. Persistance AOF recommandée pour ne pas perdre les tâches en cours.

## Fichiers (Cloudflare R2)

- Aucun versionnage natif des objets n'a été trouvé dans la documentation de R2 au 2026-10-08 (à revérifier dans la page de compatibilité S3, opération `PutBucketVersioning`, au moment du déploiement) : la protection repose sur des copies. Bucket privé : réplication quotidienne vers un bucket de sauvegarde d'un autre compte (`rclone sync`, objets supprimés conservés 30 jours par une règle de cycle de vie) ; bucket public : reconstructible depuis les originaux privés et les variantes, copié de la même manière.
- Règles de cycle de vie : `quarantine/` (téléversements non confirmés) supprimés après 2 jours ; `privacy/exports/` après 3 jours (en plus de la purge applicative à 72 heures).
- Les fichiers supprimés par l'application le sont des buckets de production immédiatement ; la copie de sauvegarde les garde au plus 30 jours (registre de conservation).

## Secrets

Les secrets ne sont pas dans les sauvegardes de base : ils sont dans le gestionnaire de secrets de l'hébergeur, sauvegardé selon sa politique ; une copie chiffrée hors ligne est tenue par le responsable technique.
