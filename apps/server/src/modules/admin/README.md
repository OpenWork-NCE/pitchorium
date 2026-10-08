# Module admin

API du back-office (cahier des charges §13, §14, ADR 0078) ; le front d'administration est hors de ce dépôt. Aucun module ne dépend de admin : il lit et agit par les façades des autres modules.

## Convention des routes d'administration

Toutes les routes de back-office sont servies sous `/v1/admin/<domaine>` et exigent un rôle `admin` (ou `moderator` pour la modération et les mises en avant) avec double authentification ; les actions sensibles exigent une session récente (`ACCESS_REAUTHENTICATION_REQUIRED`, `ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES`). Elles restent implémentées par le module propriétaire du domaine :

| Domaine                                                                       | Routes                                                                                                        | Module        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| Membres et rôles                                                              | `/v1/admin/members`, `/v1/admin/members/{userId}`, `/v1/admin/members/{userId}/roles`                         | admin, access |
| Suspensions et file de modération                                             | `/v1/admin/moderation/...`                                                                                    | trust         |
| Demandes de droits RGPD                                                       | `/v1/admin/privacy/requests`                                                                                  | privacy       |
| KYC, rapprochement, contributions hors plateforme, remboursements             | `/v1/admin/payments/...`                                                                                      | payments      |
| Méthodologie d'impact                                                         | `/v1/admin/impact/methodologies`                                                                              | impact        |
| Vérification des organisations                                                | `/v1/admin/organizations/...`                                                                                 | organizations |
| Glossaire, usage de la traduction, langues                                    | `/v1/admin/localization/...`                                                                                  | localization  |
| Feature flags, mises en avant, tâches en échec, statistiques, journal d'audit | `/v1/admin/feature-flags`, `/v1/admin/highlights`, `/v1/admin/jobs`, `/v1/admin/stats`, `/v1/admin/audit-log` | admin         |

## Membres

- `GET /v1/admin/members?q=` : par une partie de l'email ou du nom, ou par l'identifiant public exact ; `GET /v1/admin/members/{userId}` : compte, rôles, langue, fuseau, double authentification, versions des conditions acceptées, suspension, KYC.
- Toute lecture de données personnelles par un administrateur est auditée (`admin.members-searched`, `admin.member-viewed`, `admin.audit-read`, et `trust.case-viewed` dans la modération).

## Feature flags

- `GET /v1/admin/feature-flags`, `PATCH /v1/admin/feature-flags/{key}` (`{ enabled, legalReference }`, session récente) : chaque changement est enregistré (`flag_changes` : auteur, date, référence juridique) et audité.
- `locale.*` : passe par le module localization, qui refuse une langue au catalogue incomplet ou sans relecture humaine approuvée (`LOCALIZATION_LOCALE_NOT_READY`, ADR 0077).
- `funding.equity`, `funding.loans` : activables seulement avec la référence d'une validation juridique (`ADMIN_LEGAL_REFERENCE_REQUIRED`) ; même activés, le module payments refuse le paiement en ligne tant qu'aucun adaptateur habilité n'existe (ADR 0051).

## Mises en avant éditoriales

Une seule interface pour les publications, les projets et les profils : `GET /v1/admin/highlights?targetType=`, `PUT|DELETE /v1/admin/highlights/{targetType}/{targetId}` (`post` et `project` par identifiant, `profile` par identifiant public ; moderators et admins). Les règles restent celles des modules : une publication réservée aux connexions, un projet non publié ou masqué, un profil sans page publique ne sont pas mis en avant.

## Tâches en échec définitif

`GET /v1/admin/jobs/failed?queue=&limit=` : tâches BullMQ dont les tentatives sont épuisées (`DEFAULT_JOB_OPTIONS`, conservées 7 jours), de toutes les files trouvées dans Redis (`FailedJobsService`, plateforme). `POST /v1/admin/jobs/{queue}/{jobId}/retry` : relance auditée et idempotente (`Idempotency-Key` ; une tâche qui n'est plus en échec n'est pas relancée : `not_failed`).

## Statistiques et journal d'audit

- `GET /v1/admin/stats` : membres (total, actifs sur 30 jours), projets par statut, contributions payées et montant net collecté en équivalent EUR, files en attente (dossiers de modération, appels, KYC, contributions hors plateforme, demandes RGPD, tâches en échec).
- `GET /v1/admin/audit-log?actorId=&action=&targetType=&targetId=&from=&to=` : journal paginé, le plus récent d'abord.

## Schéma `admin`

`flag_changes` (clé, état, référence juridique, auteur, date).

## Données personnelles (RGPD)

Export : changements de flags faits par l'administrateur. Suppression : auteur pseudonymisé, changements conservés comme preuve. Contrats enregistrés auprès du module privacy (`infrastructure/admin-personal-data.ts`, ADR 0074).

## Événements

Aucun émis, aucun consommé.

## Dépendances

identity, access, profiles, content, projects, payments, trust, privacy, localization ; plateforme : feature flags, audit, `FailedJobsService`.
