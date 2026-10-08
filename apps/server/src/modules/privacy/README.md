# Module privacy

Droits du RGPD (cahier des charges §13) : export des données (articles 15 et 20) et suppression du compte (article 17), registre des durées de conservation et suivi des demandes par les administrateurs (ADR 0074 et 0075).

## Contrats par module

Chaque module qui détient des données personnelles enregistre au démarrage, dans les deux processus, auprès de `PrivacyFacade.registerPersonalData` :

- un `PersonalDataExporter` : ce qu'il sait du membre, sérialisable, et ses fichiers ;
- un `PersonalDataEraser` : `erase(context)` supprime ou pseudonymise, idempotent et reprenable ; `blockers(userId)` facultatif, règles qui empêchent la suppression pour l'instant ;
- une description (écrite dans son fichier JSON) et un ordre d'exécution (`ERASURE_ORDER` : activité, contenus, propriété, finances, fichiers, profil, privacy, compte en dernier).

identity enregistre en plus l'annuaire des comptes (`registerAccountDirectory`) : l'adresse, le nom et la langue de la confirmation de suppression. privacy ne dépend d'aucun module. `test/architecture/personal-data.spec.ts` échoue si un module dont le schéma a des colonnes de données personnelles n'enregistre pas ses deux contrats.

## Export

- `POST /v1/me/privacy/exports` : une demande par `PRIVACY_EXPORT_MIN_INTERVAL_HOURS` (24 h, provisoire ; `PRIVACY_EXPORT_RATE_LIMITED` sinon, sauf si la précédente a échoué).
- Le worker construit l'archive ZIP (fflate, écrite en flux sur le disque puis envoyée dans le bucket privé `privacy/exports/<id>.zip`) : `README.txt`, un `<module>.json` par module (`module`, `description`, `exportedAt`, `data`), les fichiers du membre sous `files/` (au plus 200 Mio chacun, au-delà listés dans `README.txt`).
- Notification transactionnelle `export_ready` ; `POST /v1/me/privacy/exports/{exportId}/download-url` donne un lien présigné de `PRIVACY_EXPORT_URL_TTL_SECONDS` (300 s) ; l'archive est supprimée après `PRIVACY_EXPORT_TTL_HOURS` (72 h, tâche horaire).

## Suppression

- `POST /v1/me/privacy/erasure` (`{ "confirm": true }`, session récente exigée) : refusée par le premier blocage (`PRIVACY_CAMPAIGN_IN_PROGRESS`, `PRIVACY_SOLE_OWNER`), sinon programmée après `PRIVACY_ERASURE_GRACE_DAYS` (30 jours, provisoire) ; notification `erasure_scheduled`. `POST /v1/me/privacy/erasure/cancel` l'annule pendant le délai de grâce.
- Rappel `erasure_reminder` `PRIVACY_ERASURE_REMINDER_DAYS` (7) jours avant (tâche quotidienne, 07:10 UTC).
- Exécution par le worker (toutes les 15 minutes) : les blocages sont vérifiés à nouveau (`blocked`, réessayée ensuite) ; la demande passe `running` avec un pseudonyme aléatoire (UUID v4, jamais dérivé de l'identifiant : la pseudonymisation est irréversible) et l'adresse de confirmation ; chaque effaceur s'exécute dans sa transaction et s'inscrit dans `progress` (une exécution interrompue reprend où elle s'était arrêtée) ; le journal d'audit est pseudonymisé.
- Contrôle de résidus (`ResidueScanner`, plateforme) : l'identifiant et l'email du membre sont recherchés dans toutes les colonnes `uuid`, `text`, `citext`, `jsonb` et tableaux de tous les schémas, hors `platform.outbox_events` (purgée après `OUTBOX_RETENTION_DAYS`), `platform.idempotency_keys` (24 h) et la demande elle-même. Un résidu fait échouer la demande (`failed`, colonnes listées, métrique `pitchorium.privacy.erasure.residue`) ; sinon l'ancien membre reçoit l'email `account_erased` et la demande l'oublie (identifiant, adresse et pseudonyme effacés).
- Règles par module : `docs/compliance/retention.md`.

## Administration

`GET /v1/admin/privacy/requests?kind=` : exports et suppressions, état, échéance légale d'un mois (article 12), retard, blocage ou résidus.

## Routes

- `GET /v1/me/privacy`, `POST /v1/me/privacy/exports/{exportId}/download-url` (`privacy.read`) ; `POST /v1/me/privacy/exports` (`privacy.export.request`) ; `POST /v1/me/privacy/erasure` (`privacy.erasure.request`) ; `POST /v1/me/privacy/erasure/cancel` (`privacy.erasure.cancel`). Ouvertes à un membre suspendu ou en retard sur les conditions.
- `GET /v1/admin/privacy/requests` (`privacy.requests.read`, administrateurs).

## Schéma `privacy`

`exports` (état, clé de l'archive, taille, expiration), `erasures` (état, pseudonyme et contact pendant l'exécution, progression, blocage, résidus, dates).

## Façade publique (`index.ts`)

`PrivacyFacade` (`registerPersonalData`, `registerAccountDirectory`, `registeredModules`), `ErasureExecutorService` (worker : exécution immédiate pour les données de démonstration et les tests), `ERASURE_ORDER`, types des contrats, classes d'événements.

## Événements émis

| Type                              | Payload                                 |
| --------------------------------- | --------------------------------------- |
| `privacy.export.requested.v1`     | `userId`                                |
| `privacy.export.ready.v1`         | `userId`, `expiresAt`                   |
| `privacy.erasure.requested.v1`    | `userId`, `scheduledFor`                |
| `privacy.erasure.canceled.v1`     | `userId`                                |
| `privacy.erasure.reminder-due.v1` | interne : `userId`, `scheduledFor`      |
| `privacy.erasure.executed.v1`     | `modules` (aucun identifiant de membre) |

## Événements consommés

`privacy.export.requested.v1` (handler `privacy.exports`). File `privacy.requests` : `build-export`, `execute-erasures` (toutes les 15 minutes), `remind-erasures` (07:10 UTC), `expire-exports` (toutes les heures).

## Dépendances

Aucun module métier ; plateforme : stockage, mailer, audit, `ResidueScanner`.
