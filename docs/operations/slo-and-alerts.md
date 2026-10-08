# SLO et alertes

Toutes les métriques citées sont émises par le code (port `Metrics`, OpenTelemetry, exportées en OTLP quand `OTEL_EXPORTER_OTLP_ENDPOINT` est défini) ; le fournisseur de traces et de tableaux de bord reste à choisir (question 26).

## Objectifs de service (proposés)

| SLO                      | Objectif                      | Mesure                                                                                           |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Disponibilité de l'api   | 99,5 % par mois               | part des requêtes sans réponse 5xx : `pitchorium.http.server.requests` (attribut `status_class`) |
| Latence des lectures     | p95 < 300 ms                  | `pitchorium.http.server.duration` (ms), méthode `GET`                                            |
| Latence des écritures    | p95 < 800 ms                  | `pitchorium.http.server.duration`, méthodes d'écriture                                           |
| Fraîcheur des événements | 99 % publiés en moins de 30 s | `pitchorium.outbox.lag_seconds`                                                                  |

## Alertes

| Alerte                    | Condition (proposée)                                             | Métrique                                                                              | Runbook                       |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| Erreurs 5xx               | plus de 2 % des requêtes sur 5 minutes                           | `pitchorium.http.server.requests` (`status_class=5xx`)                                | `runbooks/incident.md`        |
| Latence                   | p95 au-dessus de l'objectif pendant 15 minutes                   | `pitchorium.http.server.duration`                                                     | `runbooks/incident.md`        |
| Retard de l'outbox        | plus de 120 s pendant 5 minutes                                  | `pitchorium.outbox.lag_seconds`                                                       | `runbooks/incident.md`        |
| Files                     | plus de 1 000 tâches en attente, ou une tâche en échec définitif | `pitchorium.queue.waiting`, `pitchorium.queue.failed`                                 | `runbooks/incident.md`        |
| Webhooks en échec         | plus de 5 en 15 minutes                                          | `pitchorium.payments.webhook.failed`, `pitchorium.notifications.webhook.failed`       | `runbooks/webhooks.md`        |
| Écart de rapprochement    | au moins un                                                      | `pitchorium.payments.reconciliation.discrepancy`                                      | `runbooks/reconciliation.md`  |
| Rebonds et plaintes       | plus de 10 rebonds définitifs par heure, ou une plainte          | `pitchorium.notifications.email.bounced`, `pitchorium.notifications.email.complained` | `runbooks/incident.md`        |
| Plafond de traduction     | 80 % du plafond mensuel atteint                                  | `pitchorium.localization.cap.warning`                                                 | `runbooks/incident.md`        |
| Suppression RGPD en échec | une                                                              | `pitchorium.privacy.erasure.residue`                                                  | `runbooks/rights-requests.md` |
| Service tiers             | fuite de mot de passe non vérifiable                             | `pitchorium.identity.pwned_check.unavailable`                                         | `runbooks/incident.md`        |

Les seuils sont des propositions à ajuster après un mois de mesures en production.

## Où chaque métrique est émise

- `pitchorium.http.server.requests` (compteur) et `pitchorium.http.server.duration` (histogramme, ms) : `httpMetricsMiddleware` (`apps/server/src/platform/http/http-metrics.ts`), attributs `method`, `route` (modèle de route, jamais le chemin concret), `status_class`.
- `pitchorium.outbox.lag_seconds` (histogramme) : relais de l'outbox, à la publication de chaque événement (attribut `type`).
- `pitchorium.queue.waiting` et `pitchorium.queue.failed` (jauges, attribut `queue`) : mesurées par le worker chaque minute (`QueueMetricsService`).
- `pitchorium.payments.webhook.failed` (attributs `provider`, `reason` : `rejected` ou `error`) et `pitchorium.notifications.webhook.failed` : gestionnaires des webhooks.
- `pitchorium.notifications.email.bounced` et `pitchorium.notifications.email.complained` : webhook Resend, par destinataire supprimé.
- Les autres (`payments.reconciliation.discrepancy`, `localization.*`, `privacy.*`, `trust.*`, `identity.pwned_check.unavailable`) : services des modules concernés.
