# Restauration

1. Déclarer l'incident (`incident.md`) ; arrêter le worker pour qu'aucune tâche n'écrive pendant la restauration ; mettre l'api en maintenance (instances arrêtées ou page d'attente au proxy).
2. PostgreSQL : restaurer la sauvegarde ou l'instant voulu (PITR) dans une nouvelle base ; pour un `pg_dump -Fc` : `pg_restore --no-owner --dbname <nouvelle base> <fichier>` (procédure exercée par `scripts/restore-drill.sh`).
3. Vérifier : `pnpm db:check`, journal des migrations, comptes de lignes des tables principales, connexion d'un compte de test.
4. Pointer `DATABASE_URL` vers la base restaurée, appliquer les migrations plus récentes que la sauvegarde (`dist/main.migrate.js`).
5. Redis : repartir d'une instance vide est acceptable (files rejouées par l'outbox, tâches planifiées recréées au démarrage du worker).
6. Fichiers : restaurer les objets manquants depuis le bucket de sauvegarde (`backup-and-restore.md`).
7. Redémarrer le worker puis l'api ; lancer `pnpm payments:reconcile --days <jours depuis la sauvegarde>` et `pnpm discovery:reindex --check`.
8. Informer les membres si des données ont été perdues entre la sauvegarde et l'incident.
