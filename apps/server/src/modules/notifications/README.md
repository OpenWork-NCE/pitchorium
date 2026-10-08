# Module notifications

Notifications in-app (temps réel) et email (cahier des charges §10.5, avec §10.4 et §14) : registre des types, regroupement, diffusion en lots, préférences par type et par canal, types transactionnels, digests quotidien et hebdomadaire selon le fuseau du membre, copie des messages non lus, compteurs unifiés, délivrabilité. Architecture : `docs/architecture/notifications.md` ; délivrabilité : `docs/architecture/email-deliverability.md`.

## Registre des types (ADR 0059)

`domain/notification-types.ts` déclare, pour chaque type de `NOTIFICATION_TYPES` (contrats) : les événements source, le caractère transactionnel, la priorité, les canaux par défaut (provisoires), le regroupement (`target`, `type` ou `none`) et la cible du lien profond (`pathOf`). Les clés i18n sont `notifications.types.<type>.one` et `.many` (`@pitchorium/i18n`). Les résolveurs de destinataires sont dans `application/notification-sources.ts` et lisent les façades des modules émetteurs.

Types couverts : `connection_request`, `connection_accepted`, `new_follower` (suivi manuel d'un membre), `reaction`, `comment`, `mention`, `followed_post` (faible priorité), `message`, `message_request`, `message_request_accepted`, `introduction_proposed`, `introduction_completed`, `introduction_declined` (sans nommer qui a décliné), `profile_views`, `project_contribution` (contributeur nommé seulement s'il l'a accepté), `tier_unlocked`, `project_update`, `project_ending_soon`, `project_funded`, `project_closed` (équipe, contributeurs et abonnés du projet selon le type), `project_interest`, `project_team_invitation`, `project_team_joined`, `project_team_invitation_declined`, `organization_invitation` (compte existant à l'adresse invitée), `organization_member_joined`, `organization_role_changed`, `organization_ownership_transferred`, `organization_verification_decided`, `kyc_decided`, `contribution_refunded`, `offline_contribution_declared`, `offline_contribution_decided`, `time_entry_declared`, `time_entry_answered`, `security_alert`, `event_registration_confirmed` (inscription ou liste d'attente), `event_waitlist_promoted`, `event_reminder` (tâche planifiée, `NOTIFICATIONS_EVENT_REMINDER_HOURS` avant le début), `event_canceled` (inscrits et liste d'attente), `mission_engagement_requested` (candidature ou sollicitation, à l'auteur de la mission), `mission_engagement_answered` (acceptée ou refusée), `mission_completed` (heures à confirmer par le bénéficiaire), `new_suggestions` (faible priorité, regroupée, tâche quotidienne), et ceux du module trust, tous transactionnels : `report_received` et `report_resolved` (au signalant membre), `moderation_decision` (au membre concerné, avec l'exposé des motifs dans l'email ; jamais pour un classement sans suite), `suspension_started`, `suspension_ended`, `appeal_received`, `appeal_decided` (avec la motivation finale) ; et ceux du module privacy, transactionnels : `export_ready`, `erasure_scheduled`, `erasure_reminder` (la confirmation de suppression est envoyée par privacy, le compte n'existant plus).

## Création

- Idempotente par couple (source, destinataire) : table `deliveries` ; la source est l'identifiant de l'événement et le type, ou une clé stable pour les sources planifiées (`profile-views:<jour>`).
- Regroupement : un événement rejoint la notification ouverte (non lue, fenêtre non échue) de même clé ; l'acteur passe en tête, compté une fois (`actorCount`), `eventCount` augmente. Fenêtre `NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES` (24 h, provisoire), ouverte au premier événement. Les créations concurrentes d'un même groupe sont sérialisées par un verrou transactionnel.
- Jamais pour l'acteur lui-même ni à travers un blocage avec l'acteur.
- Abonnés d'une cible (publication d'un membre ou d'une organisation suivie, actualités, paliers et échéances d'un projet suivi) : diffusion en lots de `NOTIFICATIONS_FANOUT_BATCH_SIZE` (500) dans le worker, chaque lot dans sa transaction par insertions groupées, le suivant mis en file ensuite ; une publication réservée aux connexions ne va qu'aux abonnés connectés à l'auteur.
- Faible priorité (`followed_post`) : regroupée, jamais envoyée par email immédiat, au plus `NOTIFICATIONS_LOW_PRIORITY_PER_DAY` nouvelles notifications par membre sur 24 heures (20, provisoire).
- Vues de profil : tâche quotidienne sur la veille (UTC), une notification par membre consulté ; les visiteurs en visite privée sont comptés, jamais nommés.
- Livraison par lots (ADR 0064) : les notifications créées ou regroupées d'un appel (un lot d'abonnés, ou les destinataires directs d'un événement) enregistrent un seul `notifications.batch.created.v1` (interne) ; une tâche `deliver` pousse chaque notification et les compteurs par Socket.IO, puis envoie les emails immédiats des notifications nouvelles par groupes de 100 (`Mailer.sendMany`), chaque groupe marqué envoyé dès son envoi : une tâche reprise ne renvoie que les emails non marqués.

## Canaux et préférences (ADR 0060)

- Canaux : `in_app` (temps réel) et `email` (immédiat ou digest), derrière le port `NotificationChannelAdapter` ; un canal push s'ajoutera par ce port, il n'est pas implémenté.
- Préférences par type et par canal (`GET|PATCH /v1/me/notification-preferences`) ; sans choix, les canaux par défaut du type. Un type transactionnel (sécurité, paiements, KYC, conditions) garde ses canaux par défaut, envoyé aussitôt : le modifier répond `NOTIFICATIONS_PREFERENCE_LOCKED`.
- Les emails transactionnels envoyés par leur module (invitation à jeton, rôle, propriété et vérification d'une organisation ; sécurité du compte) gardent leur notification in-app, transactionnelle elle aussi, sans email ici (`EMAILED_BY_EMITTING_MODULE`) : jamais deux emails pour un même fait. L'arrivée d'un membre dans une organisation, non transactionnelle, est envoyée ici seulement (`organization_member_joined`, email par défaut). Inventaire : `docs/architecture/email-deliverability.md`.

## Digests (ADR 0061)

`emailDigest` : `off` (un email par notification), `daily` (§10.5, facultatif) ou `weekly` (§14, V2, le lundi). Tâche toutes les 15 minutes : un digest part à partir de `NOTIFICATIONS_DIGEST_HOUR` (8 h, provisoire), heure locale du fuseau du membre (module identity, `timeZone`), une fois par jour local (ou par lundi local).

## Messages non lus par email (§10.4)

Si le membre a activé l'email du type `message` (désactivé par défaut), un message non lu après `NOTIFICATIONS_UNREAD_MESSAGE_EMAIL_DELAY_MINUTES` (30, provisoire) déclenche un email ; les messages suivants d'une même conversation rejoignent le même email (une ligne par destinataire et conversation). Rien n'est envoyé si la conversation a été lue entre-temps, mise en sourdine ou masquée par un blocage.

## Délivrabilité (ADR 0062)

- Désinscription en un clic pour tout email non transactionnel : en-têtes `List-Unsubscribe` (`<API_PUBLIC_URL>/v1/notifications/unsubscribe?token=...`) et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), lien vers la page de l'application web en pied d'email ; jeton signé (HMAC SHA-256, `EMAIL_LINK_SECRET`) qui désactive l'email du type, ou le digest.
- Webhook Resend `POST /v1/notifications/webhooks/resend`, signé par Svix (`RESEND_WEBHOOK_SECRET`), dédupliqué par l'inbox : un rebond permanent ou une plainte ajoute l'adresse à la liste de suppression, que le mailer consulte avant chaque envoi.

## Lecture

`GET /v1/me/notifications?unread=&cursor=&limit=` (curseur), `POST /v1/me/notifications/{id}/read`, `POST /v1/me/notifications/read-all`, `DELETE /v1/me/notifications/{id}`, `GET /v1/me/counters` (notifications et messages non lus, demandes de message, invitations en attente : connexions, introductions, équipes de projet, organisations), poussés aussi en temps réel (événement `counters`).

## Rétention

Purge quotidienne des notifications sans activité depuis `NOTIFICATIONS_RETENTION_DAYS` (90 jours, provisoire), de leurs livraisons et des emails de messages en attente.

## Routes

- `GET /v1/me/notifications`, `GET /v1/me/counters`, `GET /v1/me/notification-preferences` (`notifications.read`)
- `POST /v1/me/notifications/{notificationId}/read`, `POST /v1/me/notifications/read-all`, `DELETE /v1/me/notifications/{notificationId}` (`notifications.manage`)
- `PATCH /v1/me/notification-preferences` (`notifications.preferences.update`)
- `POST /v1/notifications/unsubscribe?token=` (public, jeton signé)
- Hors OpenAPI : `POST /v1/notifications/webhooks/resend` (signature Svix)

## Schéma `notifications`

`notifications` (destinataire, type, clé de regroupement, acteurs, compteurs, cible, données, fenêtre, lu, canal in-app, mode email, envoi), `deliveries` (clé : source et destinataire), `preferences` (clé : membre, type, canal), `settings` (digest et dernier envoi), `suppressions` (adresse, motif), `unread_message_emails` (clé : destinataire et conversation).

## Façade publique (`index.ts`)

`NotificationsFacade.notify(source, dispatch)` (données de développement, sources directes futures), type `Dispatch`, classes d'événements.

## Événements émis

| Type                                | Payload                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `notifications.batch.created.v1`    | interne : `type`, `created` et `grown` (identifiants des notifications du lot)                                   |
| `notifications.email.sent.v2`       | `kind` (`notification`, `digest`, `unread_messages`), `recipientIds`, `items` (un événement par groupe d'emails) |
| `notifications.email.bounced.v1`    | `recipientId` (compte de l'adresse, ou null), `providerEventId`                                                  |
| `notifications.email.complained.v1` | `recipientId`, `providerEventId`                                                                                 |

## Événements consommés

Ceux de la colonne « sources » du registre (handler `notifications.create`, worker) ; `notifications.batch.created.v1` (handler `notifications.deliver`, qui met en file la tâche `deliver` du lot). Tâches de la file `notifications.delivery` : `fanout`, `deliver`, `unread-message-emails` (chaque minute), `digests` (toutes les 15 minutes), `profile-views` (05:10 UTC), `event-reminders` (toutes les 15 minutes : événements qui commencent dans `NOTIFICATIONS_EVENT_REMINDER_HOURS`, 24 h provisoires, une fois par événement et inscrit), `new-suggestions` (06:20 UTC : nouvelles suggestions de la veille, module discovery), `purge` (04:40 UTC). Une déclaration de temps née d'une mission (`missionEngagementId`) n'a pas de notification `time_entry_declared` : `mission_completed` la remplace.

## Dépendances

identity (adresse, langue, fuseau), profiles (cartes des acteurs), network (abonnés, connexions, blocages, demandes, vues de profil), content (publication d'un commentaire), messaging (conversations, non lus, compteurs), projects (équipe, projet, invitations), organizations (membres, invitations), payments (contributeurs, contributions, hors plateforme), events (inscrits, événements qui commencent), missions (côtés d'un engagement), discovery (nouvelles suggestions), trust (exposé des motifs d'une décision et motivation d'un appel), privacy (événements de ses demandes).

## Données personnelles (RGPD)

Export : notifications reçues, préférences, réglage du digest. Suppression : notifications, livraisons, préférences, réglage et emails en attente supprimés ; le membre remplacé par le pseudonyme parmi les acteurs des notifications des autres ; de son adresse dans la liste de suppression, seule l'empreinte `sha256:` est gardée, consultée avant chaque envoi. Contrats enregistrés auprès du module privacy (`infrastructure/notifications-personal-data.ts`, ADR 0074).
