# Notifications

Module `notifications` (cahier des charges §10.5, avec §10.4 et §14). Décisions : ADR 0059 (registre et regroupement), 0064 (livraison par lots), 0060 (préférences et types transactionnels), 0061 (digests et fuseaux), 0062 (délivrabilité). Détails du module : `apps/server/src/modules/notifications/README.md`.

## Du fait métier à la notification

```mermaid
sequenceDiagram
  participant M as Module émetteur (api)
  participant DB as PostgreSQL
  participant R as worker (relais outbox)
  participant H as worker (notifications.create)
  participant Q as file notifications.delivery
  participant D as worker (tâche deliver)
  participant S as Socket.IO (Redis)
  participant E as Mailer
  M->>DB: écriture métier + événement (outbox), même transaction
  R->>H: événement source (BullMQ)
  H->>H: résolveur du type : destinataires par les façades
  H->>DB: livraisons (source, destinataire), regroupement ou création, notifications.batch.created.v1
  H->>Q: abonnés d'une cible : premier lot (fan-out)
  Q->>DB: lot de 500 abonnés, même logique, insertions groupées, une transaction, un événement
  Q->>Q: lot suivant
  R->>Q: notifications.batch.created.v1 (handler notifications.deliver) : tâche deliver du lot
  D->>S: notifications:notification + counters de chaque destinataire (room user:id)
  D->>E: emails immédiats du lot par groupes de 100 (sendMany), marqués envoyés groupe par groupe
```

Pour 5 000 abonnés qui ont demandé l'email : 82 tâches et 50 s, contre 10 012 tâches et 166 s quand chaque notification et chaque email avaient leur tâche (ADR 0064).

## Regroupement

```mermaid
flowchart TD
  e[Événement pour un destinataire] --> d{Déjà livré pour cette source ?}
  d -- oui --> stop[Rien]
  d -- non --> o{Notification ouverte de même clé ?\nnon lue, fenêtre non échue}
  o -- oui --> g[Acteur en tête, compté une fois ; eventCount + 1]
  o -- non --> c{Faible priorité et plafond du jour atteint ?}
  c -- oui --> stop
  c -- non --> p{Un canal au moins ?}
  p -- non --> stop
  p -- oui --> n[Nouvelle notification, fenêtre ouverte]
```

- Clé : `type:cible` (réactions, commentaires, messages d'une conversation, contributions d'un projet...), `type` (abonnés, demandes de connexion, publications des membres suivis...) ou unique par événement.
- Exemple : trois réactions sur une même publication dans la fenêtre donnent une notification « Amina et 2 autres ont réagi à votre publication » (`actorCount` 3, `eventCount` 3, acteurs les plus récents en tête).

## Canaux

| Mode email  | Quand                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `immediate` | email du type activé, pas de digest choisi, priorité normale ; toujours pour un type transactionnel dont l'email est prévu |
| `digest`    | email du type activé et digest `daily` ou `weekly` choisi (types non transactionnels)                                      |
| `off`       | email du type désactivé, faible priorité sans digest, type `message` (copie des non lus à part)                            |

## Digests et fuseaux

```mermaid
sequenceDiagram
  participant T as Tâche digests (toutes les 15 min)
  participant N as notifications
  participant I as identity (fuseau)
  participant E as Mailer
  T->>N: membres ayant des notifications en attente de digest
  loop chaque membre
    T->>I: fuseau IANA
    T->>T: heure locale >= NOTIFICATIONS_DIGEST_HOUR, jour local (ou lundi) non encore servi
    T->>E: digest, désinscription en un clic
    T->>N: notifications marquées envoyées, dernier digest
  end
```

## Liens profonds

Chaque notification porte `target` : un type, une clé et le chemin de l'application web (contrat avec le frontend, `pathOf`) :

| Cible                      | Chemin                           |
| -------------------------- | -------------------------------- |
| `member`                   | `/members/<handle>`              |
| `post`                     | `/posts/<id>`                    |
| `conversation`             | `/messages/<id>`                 |
| `message_requests`         | `/messages/requests`             |
| `introduction`             | `/introductions/<id>`            |
| `project`                  | `/projects/<slug>`               |
| `project_invitations`      | `/me/project-invitations`        |
| `organization`             | `/organizations/<slug>`          |
| `organization_invitations` | `/me/organization-invitations`   |
| `contribution`             | `/me/contributions/<id>`         |
| `payout_account`           | `/me/payout-account`             |
| `offline_contribution`     | `/me/offline-contributions/<id>` |
| `time_entry`               | `/me/time-entries/<id>`          |
| `profile_views`            | `/me/profile-views`              |
| `connection_requests`      | `/network/requests`              |
| `account_security`         | `/me/security`                   |
| `event`                    | `/events/<slug>`                 |
| `mission_engagement`       | `/missions/engagements/<id>`     |
| `suggestions`              | `/discover`                      |

## Compteurs unifiés

`GET /v1/me/counters` et l'événement `counters` : notifications non lues (in-app), messages non lus et conversations concernées, demandes de message, invitations en attente (connexions, introductions, équipes de projet, organisations de l'adresse vérifiée). Poussés à chaque notification créée ou regroupée et à chaque lecture.

## Valeurs provisoires

Canaux par défaut de chaque type, fenêtre de regroupement (24 h), taille des lots de création et de livraison (500), plafond de faible priorité (20 par jour), délai de la copie des messages non lus (30 min), heure des digests (8 h locale), jour du digest hebdomadaire (lundi), rétention (90 jours) : `docs/open-questions.md`.
