# Incident

1. **Qualifier** : quelle alerte (`docs/operations/slo-and-alerts.md`), depuis quand, quel périmètre (api, worker, un prestataire). Ouvrir un fil d'incident daté, un responsable unique.
2. **Diagnostiquer** :
   - `GET /v1/health/ready` (api) et `/health/ready` (worker) : PostgreSQL, Redis, stockage ;
   - journaux JSON (pino) par `requestId` ; traces OpenTelemetry ; Sentry pour les erreurs 5xx ;
   - files : `GET /v1/admin/jobs/failed`, retard de l'outbox (`pitchorium.outbox.lag_seconds`).
3. **Contenir** : retirer une instance défaillante, désactiver une fonction par son flag (`PATCH /v1/admin/feature-flags/{key}`), passer un prestataire en panne au suivant (traduction : `LOCALIZATION_PROVIDERS`).
4. **Rétablir** : redéployer la version précédente de l'image (les migrations sont compatibles avec elle, règle expand et contract) ; relancer les tâches en échec une fois la cause corrigée.
5. **Communiquer** : informer le client ; en cas de violation de données personnelles, notifier l'autorité de contrôle sous 72 heures (RGPD, article 33) avec le DPO.
6. **Clore** : chronologie, cause, actions correctives, mise à jour des runbooks.

## Dépendance indisponible (comportement attendu)

| Dépendance                | Effet                                                                                               | Reprise                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------- |
| PostgreSQL                | api et worker non prêts (503)                                                                       | automatique à son retour     |
| Redis                     | api non prête ; les écritures déjà validées restent dans l'outbox                                   | le relais republie au retour |
| Stockage                  | téléversements et exports en échec, réessayés par BullMQ                                            | automatique                  |
| Prestataire de paiement   | création de session refusée (`PAYMENTS_PROVIDER_UNAVAILABLE`) ; webhooks rejoués par le prestataire | rapprochement quotidien      |
| Prestataire de traduction | prestataire suivant, sinon `LOCALIZATION_UNAVAILABLE`                                               | automatique                  |
| Resend                    | emails réessayés par la tâche de livraison                                                          | automatique                  |
| ClamAV                    | fichiers en `processing`, réessayés                                                                 | automatique                  |
