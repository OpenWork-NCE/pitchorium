# Module notifications

Notifications in-app (temps réel) et email (cahier des charges §10.5, avec §10.4 et §14) : registre des types, regroupement, diffusion en lots, préférences par type et par canal, types transactionnels, digests quotidien et hebdomadaire selon le fuseau du membre, copie des messages non lus, compteurs unifiés, délivrabilité. Architecture : `docs/architecture/notifications.md`.

## Registre des types (ADR 0059)

`domain/notification-types.ts` déclare, pour chaque type de `NOTIFICATION_TYPES` (contrats) : les événements source, le caractère transactionnel, la priorité, les canaux par défaut (provisoires), le regroupement (`target`, `type` ou `none`) et la cible du lien profond (`pathOf`). Les clés i18n sont `notifications.types.<type>.one` et `.many` (`@pitchorium/i18n`). Les résolveurs de destinataires sont dans `application/notification-sources.ts` et lisent les façades des modules émetteurs.

Types couverts : `connection_request`, `connection_accepted`, `new_follower` (suivi manuel d'un membre), `reaction`, `comment`, `mention`, `followed_post` (faible priorité), `message`, `message_request`, `message_request_accepted`, `introduction_proposed`, `introduction_completed`, `introduction_declined` (sans nommer qui a décliné), `profile_views`, `project_contribution` (contributeur nommé seulement s'il l'a accepté), `tier_unlocked`, `project_update`, `project_ending_soon`, `project_funded`, `project_closed` (équipe, contributeurs et abonnés du projet selon le type), `project_interest`, `project_team_invitation`, `project_team_joined`, `project_team_invitation_declined`, `organization_invitation` (compte existant à l'adresse invitée), `organization_member_joined`, `organization_role_changed`, `organization_ownership_transferred`, `organization_verification_decided`, `kyc_decided`, `contribution_refunded`, `offline_contribution_declared`, `offline_contribution_decided`, `time_entry_declared`, `time_entry_answered`, `security_alert`.

## Création

- Idempotente par couple (source, destinataire) : table `deliveries` ; la source est l'identifiant de l'événement et le type, ou une clé stable pour les sources planifiées (`profile-views:<jour>`).
- Regroupement : un événement rejoint la notification ouverte (non lue, fenêtre non échue) de même clé ; l'acteur passe en tête, compté une fois (`actorCount`), `eventCount` augmente. Fenêtre `NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES` (24 h, provisoire), ouverte au premier événement. Les créations concurrentes d'un même groupe sont sérialisées par un verrou transactionnel.
- Jamais pour l'acteur lui-même ni à travers un blocage avec l'acteur.
- Abonnés d'une cible (publication d'un membre ou d'une organisation suivie, actualités, paliers et échéances d'un projet suivi) : diffusion en lots de `NOTIFICATIONS_FANOUT_BATCH_SIZE` (500) dans le worker, chaque lot dans sa transaction, le suivant mis en file ensuite ; une publication réservée aux connexions ne va qu'aux abonnés connectés à l'auteur.
- Faible priorité (`followed_post`) : regroupée, jamais envoyée par email immédiat, au plus `NOTIFICATIONS_LOW_PRIORITY_PER_DAY` nouvelles notifications par membre sur 24 heures (20, provisoire).
- Vues de profil : tâche quotidienne sur la veille (UTC), une notification par membre consulté ; les visiteurs en visite privée sont comptés, jamais nommés.
- Chaque notification créée ou regroupée enregistre `notifications.notification.created.v1` (interne) : le worker pousse la notification et les compteurs par Socket.IO, et envoie l'email immédiat d'une notification nouvelle.

## Canaux et préférences (ADR 0060)

- Canaux : `in_app` (temps réel) et `email` (immédiat ou digest), derrière le port `NotificationChannelAdapter` ; un canal push s'ajoutera par ce port, il n'est pas implémenté.
- Préférences par type et par canal (`GET|PATCH /v1/me/notification-preferences`) ; sans choix, les canaux par défaut du type. Un type transactionnel (sécurité, paiements, KYC, conditions) garde ses canaux par défaut, envoyé aussitôt : le modifier répond `NOTIFICATIONS_PREFERENCE_LOCKED`.
- Les emails d'organisation (invitation à jeton, décisions) et de sécurité restent envoyés par leurs modules : ces types sont in-app par défaut.

## Digests (ADR 0061)

`emailDigest` : `off` (un email par notification), `daily` (§10.5, facultatif) ou `weekly` (§14, V2, le lundi). Tâche toutes les 15 minutes : un digest part à partir de `NOTIFICATIONS_DIGEST_HOUR` (8 h, provisoire), heure locale du fuseau du membre (module identity, `timeZone`), une fois par jour local (ou par lundi local).

## Messages non lus par email (§10.4)

Si le membre a activé l'email du type `message` (désactivé par défaut), un message non lu après `NOTIFICATIONS_UNREAD_MESSAGE_EMAIL_DELAY_MINUTES` (30, provisoire) déclenche un email ; les messages suivants d'une même conversation rejoignent le même email (une ligne par destinataire et conversation). Rien n'est envoyé si la conversation a été lue entre-temps, mise en sourdine ou masquée par un blocage.

## Désinscription en un clic

Tout email non transactionnel porte les en-têtes `List-Unsubscribe` (`<API_PUBLIC_URL>/v1/notifications/unsubscribe?token=...`) et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), et un lien vers la page de l'application web en pied d'email ; le jeton signé (HMAC SHA-256, `EMAIL_LINK_SECRET`) désactive l'email du type, ou le digest.

## Lecture

`GET /v1/me/notifications?unread=&cursor=&limit=` (curseur), `POST /v1/me/notifications/{id}/read`, `POST /v1/me/notifications/read-all`, `DELETE /v1/me/notifications/{id}`, `GET /v1/me/counters` (notifications et messages non lus, demandes de message, invitations en attente : connexions, introductions, équipes de projet, organisations), poussés aussi en temps réel (événement `counters`).

## Rétention

Purge quotidienne des notifications sans activité depuis `NOTIFICATIONS_RETENTION_DAYS` (90 jours, provisoire), de leurs livraisons et des emails de messages en attente.

## Routes

- `GET /v1/me/notifications`, `GET /v1/me/counters`, `GET /v1/me/notification-preferences` (`notifications.read`)
- `POST /v1/me/notifications/{notificationId}/read`, `POST /v1/me/notifications/read-all`, `DELETE /v1/me/notifications/{notificationId}` (`notifications.manage`)
- `PATCH /v1/me/notification-preferences` (`notifications.preferences.update`)
- `POST /v1/notifications/unsubscribe?token=` (public, jeton signé)

## Schéma `notifications`

`notifications` (destinataire, type, clé de regroupement, acteurs, compteurs, cible, données, fenêtre, lu, canal in-app, mode email, envoi), `deliveries` (clé : source et destinataire), `preferences` (clé : membre, type, canal), `settings` (digest et dernier envoi), `suppressions` (adresse, motif), `unread_message_emails` (clé : destinataire et conversation).

## Façade publique (`index.ts`)

`NotificationsFacade.notify(source, dispatch)` (données de développement, sources directes futures), type `Dispatch`, classes d'événements.

## Événements émis

| Type                                    | Payload                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `notifications.notification.created.v1` | interne : `recipientId`, `type`, `created`                                   |
| `notifications.email.sent.v1`           | `recipientId`, `kind` (`notification`, `digest`, `unread_messages`), `items` |
| `notifications.email.bounced.v1`        | `recipientId` (compte de l'adresse, ou null), `providerEventId`              |
| `notifications.email.complained.v1`     | `recipientId`, `providerEventId`                                             |

## Événements consommés

Ceux de la colonne « sources » du registre (handler `notifications.create`, worker) ; `notifications.notification.created.v1` (handler `notifications.deliver`). Tâches de la file `notifications.delivery` : `fanout`, `unread-message-emails` (chaque minute), `digests` (toutes les 15 minutes), `profile-views` (05:10 UTC), `purge` (04:40 UTC).

## Dépendances

identity (adresse, langue, fuseau), profiles (cartes des acteurs), network (abonnés, connexions, blocages, demandes, vues de profil), content (publication d'un commentaire), messaging (conversations, non lus, compteurs), projects (équipe, projet, invitations), organizations (membres, invitations), payments (contributeurs, contributions, hors plateforme).
