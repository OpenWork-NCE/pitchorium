# Résilience

Comportement de l'api et du worker quand une dépendance tombe ; mesuré le 2026-10-08 sur les services locaux (arrêt du conteneur pendant que l'api répond).

## Redis (Valkey) indisponible

- Api : `GET /v1/health/ready` répond `503` (l'orchestrateur retire l'instance) ; `GET /v1/health/live` reste `200` (pas de redémarrage inutile). Les routes répondent `503 SERVICE_UNAVAILABLE` en 2 à 6 ms : la limitation de débit et les compteurs passent par Redis, et le client partagé échoue vite (`createRedisClient` : une tentative, pas de file hors ligne après la première connexion). Avant ce réglage, une écriture attendait plus de 15 s.
- Worker : BullMQ se reconnecte seul ; les événements restent dans l'outbox PostgreSQL, publiés au retour de Redis.
- Retour : tout répond normalement dès la reconnexion (mesuré 5 s après le redémarrage), sans intervention.

## Stockage objet (R2, MinIO) indisponible

- `GET /v1/health/ready` répond `503` ; le reste de l'api répond (`200` sur le fil, les messages ; une URL de téléversement présignée se calcule sans appel au stockage).
- Worker : le traitement d'un fichier échoue et se réessaie (tentatives et attente exponentielle de `DEFAULT_JOB_OPTIONS`) ; épuisé, il apparaît dans `GET /v1/admin/jobs/failed` et se relance par `POST /v1/admin/jobs/{queue}/{jobId}/retry`.

## Prestataire de paiement, d'email, de traduction

- Paiement : la création d'une contribution qui ne peut pas ouvrir de session répond `502 PAYMENTS_PROVIDER_UNAVAILABLE` et ne débite rien ; les webhooks manqués sont rattrapés par la réconciliation planifiée et `pnpm payments:reconcile` (`runbooks/reconciliation.md`, `runbooks/webhooks.md`).
- Email : envoi par une tâche du worker, réessayée ; une panne longue finit en tâche en échec, relançable.
- Traduction : `LOCALIZATION_PROVIDER_FAILED`, jamais de texte non traduit présenté comme traduit (ADR 0076).
- Antivirus (ClamAV) : le fichier reste en quarantaine, jamais publié sans analyse ; tâche réessayée.

## Worker tué brutalement

Expérience : 200 messages envoyés par l'api, worker tué par `SIGKILL` pendant le traitement, redémarré 3 s plus tard. Mesure : le nombre d'événements comptés dans la notification du destinataire augmente de **200 exactement**, l'outbox se vide (0 événement non publié). Deux moments d'arrêt testés : avant la publication (199 événements encore dans l'outbox) et pendant le traitement des tâches (toutes publiées, certaines en cours).

Mécanismes : outbox transactionnelle (rien n'est perdu entre l'écriture métier et la file), identifiant de tâche égal à l'identifiant d'événement (pas de doublon à la republication), reprise des tâches bloquées par BullMQ, inbox par consommateur (`platform.inbox_messages`, unicité `(source, external_id)`) : un effet n'est jamais appliqué deux fois. Le test d'intégration `test/integration/inbox.spec.ts` couvre la relivraison.

## Lettres mortes (par file)

Toutes les files appliquent `DEFAULT_JOB_OPTIONS` (`apps/server/src/platform/queue/queue-options.ts`) : 8 tentatives avec attente exponentielle (1 s, 2 s, 4 s... soit environ 4 minutes), tâches réussies gardées 24 h, tâches en échec définitif gardées **7 jours**. Une tâche en échec définitif :

- est comptée par la jauge `pitchorium.queue.failed` (attribut `queue`), qui déclenche l'alerte « Files » ;
- se consulte dans `GET /v1/admin/jobs/failed?queue=` et se relance, de façon auditée et idempotente, par `POST /v1/admin/jobs/{queue}/{jobId}/retry` (ADR 0078) ;
- se rejoue sans risque : chaque traitement est idempotent (inbox, clés métier).

| File                                                                                                                                        | Effet d'un échec définitif                                     | Action                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `platform.domain-events`                                                                                                                    | un consommateur n'a pas reçu un événement                      | relancer après correction ; l'inbox ignore les consommateurs déjà servis  |
| `platform.maintenance`                                                                                                                      | purge (clés d'idempotence, outbox) en retard                   | relancer ; la prochaine exécution planifiée rattrape aussi                |
| `notifications.delivery`                                                                                                                    | notification ou email non envoyé                               | relancer ; un email transactionnel en retard reste utile                  |
| `payments.provider-sync`                                                                                                                    | synchronisation ou email de paiement en retard                 | relancer, puis réconcilier (`runbooks/reconciliation.md`)                 |
| `media.processing`                                                                                                                          | fichier resté en traitement                                    | relancer quand ClamAV et le stockage répondent                            |
| `privacy.requests`                                                                                                                          | export ou suppression en retard                                | relancer ; le délai légal court (`runbooks/rights-requests.md`)           |
| `trust.moderation`                                                                                                                          | effet d'une décision (masquage, gel, remboursements) en retard | relancer en priorité (`runbooks/moderation.md`)                           |
| `discovery.matching`, `content.processing`, `events.maintenance`, `projects.maintenance`, `network.maintenance`, `localization.maintenance` | projection, aperçu ou tâche planifiée en retard                | relancer ; une projection se reconstruit aussi (`pnpm discovery:reindex`) |
