# Module messaging

Messagerie (cahier des charges §10.4, avec §7.2 et §10.3) : conversations 1:1, demandes de message hors réseau, conversations de groupe nées d'une introduction à trois, pièces jointes privées, partage d'une publication, lu et non lu, temps réel. Protocole Socket.IO : `docs/architecture/realtime.md`. Pas de chiffrement de bout en bout (ADR 0057).

## Conversations (ADR 0055)

- `direct` : une seule par paire de membres (`direct_key`), créée par le premier message (`POST /v1/messaging/conversations`). `group` : trois membres, créée uniquement par une introduction conclue (ADR 0058).
- Participants génériques (`participant_type`, `participant_id`) : `member` aujourd'hui ; un autre type (une organisation, par exemple) s'ajoutera sans migration. État propre à chaque participant : position de lecture (`last_read_sequence`), marqué non lu, archivé, en sourdine, départ (`left_at`, groupes seulement).
- Statut : `active`, `request` (premier message hors réseau en attente) ou `declined`.

## Qui peut écrire à qui

- Membres connectés : librement, sans autre condition (`decideStart`, `domain/conversation.ts`).
- Hors réseau : email vérifié exigé (§7.2, `ACCESS_PREREQUISITES_MISSING` avec `email_verified`), puis préférence du destinataire (`GET|PUT /v1/me/messaging/settings`) :
  - `connections_only` : refus (`MESSAGING_RECIPIENT_NOT_ACCEPTING`) ;
  - `connections_and_second_degree` (valeur par défaut, `MESSAGING_DEFAULT_POLICY`, à valider) : seulement au 2e degré (au moins une connexion en commun) ;
  - `verified_members` : tout membre à l'email vérifié (la seule vérification d'une personne aujourd'hui, à confirmer).
- Le premier message hors réseau exige l'email vérifié et le profil minimum de l'expéditeur (`ACCESS_PREREQUISITES_MISSING`, `missing` : `email_verified`, `profile.minimum`, ADR 0109) et crée une demande : il arrive dans la boîte `requests` du destinataire ; l'expéditeur ne peut rien envoyer d'autre avant l'acceptation (`MESSAGING_REQUEST_PENDING`). Le destinataire accepte (`POST .../accept`, ou en répondant) ou refuse (`POST .../decline`) ; le refus est silencieux : l'expéditeur voit toujours `requestState: sent`, le destinataire ne voit plus la conversation. Une demande devient libre si les deux membres se connectent ensuite.
- Anti-abus : au plus `MESSAGING_REQUESTS_PER_DAY` premières demandes sur 24 heures glissantes par expéditeur (20, provisoire), `MESSAGING_REQUEST_LIMIT` au-delà.
- Blocage (module network) : aucune nouvelle conversation (`MESSAGING_RECIPIENT_NOT_FOUND`, comme pour un membre inconnu) et toute conversation avec un membre bloqué, dans un sens ou dans l'autre, disparaît des listes et répond 404, envoi compris.

## Messages

- Texte de 8 000 caractères au plus ; jusqu'à 5 pièces jointes (usage media `message_attachment`, privé, lisibles par les seuls participants qui voient la conversation : règle de lecture enregistrée auprès de media) ; une publication partagée (§10.3 « transférer en message »), vérifiée à l'envoi puis, pour chaque lecteur, à chaque lecture : `sharedPost.post` vaut `null` pour un lecteur hors de son audience. Un message vide est refusé (`MESSAGING_MESSAGE_EMPTY`).
- Numéro de séquence serveur par conversation (1, 2, 3... sans trou), attribué sous le verrou de la ligne de la conversation ; identifiant client (`clientMessageId`) unique par expéditeur : un envoi rejoué rend le message déjà enregistré, un même identifiant avec un autre contenu répond `MESSAGING_CLIENT_ID_REUSED` (ADR 0056).
- Modification par l'expéditeur pendant `MESSAGING_EDIT_WINDOW_MINUTES` (15, provisoire), avec l'indicateur `edited` ; suppression en pierre tombale : la séquence reste, le texte, les fichiers (détachés) et la publication partagée disparaissent (`deleted: true`).
- `moderation_status` (`visible`, `hidden`, `removed`) modifiable par `MessagingFacade.setMessageModerationStatus` (module trust) : le texte et les fichiers d'un message masqué ne sont plus servis.

## Lecture et état

- Lu et non lu par participant ; `POST .../read` avance la position de lecture (jamais en arrière) et diffuse l'accusé de lecture à tous les participants.
- `PATCH /v1/messaging/conversations/{id}` : `archived`, `muted`, `unread` (marquer comme non lu) ; un nouveau message ramène une conversation archivée dans la boîte de réception.
- Compteurs (`MessagingFacade.unreadSummary`, `pendingRequests`, `introductionsAwaiting`) servis par l'endpoint unifié du module notifications.

## Introductions à trois (ADR 0058)

A, connecté à B et à C, propose une introduction avec une note (1 000 caractères, provisoire). B et C acceptent ou refusent chacun, une seule fois ; un refus clôt l'introduction (`declined`) ; deux acceptations la concluent : une conversation de groupe A, B, C s'ouvre avec la note de A comme premier message (`kind: introduction`). A peut ensuite quitter la conversation. Refus : membres non distincts ou A non connecté aux deux (`MESSAGING_INTRODUCTION_INVALID`, `MESSAGING_INTRODUCTION_NOT_CONNECTED`), B et C séparés par un blocage, même introduction déjà en attente (`MESSAGING_INTRODUCTION_PENDING`).

## Temps réel (ADR 0056)

Persistance avant toute diffusion ; diffusion après la validation de la transaction vers les rooms `user:<id>` de chaque participant, sur tous ses appareils (adaptateur Redis) ; synchronisation après reconnexion par la dernière séquence connue ; indicateur de saisie relayé sans persistance ; accusés de lecture diffusés. Les envois par socket suivent les mêmes règles que les routes HTTP (participation, blocages, conditions acceptées).

## Routes

- `GET /v1/messaging/conversations?box=inbox|requests|archived` (`messaging.read`), `POST /v1/messaging/conversations` (`messaging.conversation.start`, `Idempotency-Key`)
- `GET|PATCH /v1/messaging/conversations/{conversationId}`, `POST .../leave`, `GET .../messages?afterSequence=|beforeSequence=&limit=`, `POST .../messages` (`Idempotency-Key`), `POST .../read` (`messaging.conversation.participate`, rôle `participant` donné par `ConversationResolver`)
- `PATCH|DELETE /v1/messaging/conversations/{conversationId}/messages/{messageId}` (`messaging.message.update`, rôle `sender`)
- `POST /v1/messaging/conversations/{conversationId}/accept`, `POST .../decline` (`messaging.request.respond`, rôle `request_recipient`)
- `GET /v1/me/messaging/settings` (`messaging.read`), `PUT /v1/me/messaging/settings` (`messaging.settings.update`)
- `POST /v1/messaging/introductions` (`messaging.introduction.propose`, email vérifié, `Idempotency-Key`), `GET /v1/messaging/introductions`, `GET /v1/messaging/introductions/{introductionId}` (`messaging.read`), `POST .../accept`, `POST .../decline` (`messaging.introduction.respond`, rôle `introduced`)

## Schéma `messaging`

`conversations` (clé directe unique, demande, dernière séquence), `participants` (clé : conversation, type et identifiant), `messages` (séquence unique par conversation, identifiant client unique par expéditeur, pierre tombale), `introductions` (une seule en attente par trio), `settings` (préférence de messagerie).

## Façade publique (`index.ts`)

`MessagingFacade` : `setMessageModerationStatus`, `reportContext` (message signalé par un participant qui voit la conversation, avec au plus `REPORT_CONTEXT_MESSAGES_BEFORE` = 3 messages qui le précèdent, jamais toute la conversation ; texte nul pour un message supprimé), `unreadSummary`, `pendingRequests`, `introductionsAwaiting`, `unreadState`, `unreadMessages`, `isActive`, `participantIds` ; types `UnreadState`, `UnreadMessage` ; classes d'événements. Au démarrage, la façade enregistre auprès de media la règle de lecture des fichiers de type `message`.

## Événements émis

| Type                                         | Agrégat      | Payload                                                           |
| -------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `messaging.conversation.created.v1`          | conversation | `kind`, `status`, `createdBy`, `participantIds`, `introductionId` |
| `messaging.conversation.request-accepted.v1` | conversation | `requesterId`, `recipientId`, `reason` (`answer`, `connected`)    |
| `messaging.conversation.request-declined.v1` | conversation | `requesterId`, `recipientId`                                      |
| `messaging.message.sent.v1`                  | message      | `conversationId`, `senderId`, `sequence`, `kind`, `recipientIds`  |
| `messaging.message.edited.v1`                | message      | `conversationId`, `senderId`, `sequence`                          |
| `messaging.message.deleted.v1`               | message      | `conversationId`, `senderId`, `sequence`                          |
| `messaging.introduction.proposed.v1`         | introduction | `introducerId`, `firstId`, `secondId`                             |
| `messaging.introduction.accepted.v1`         | introduction | `introducerId`, `firstId`, `secondId`, `by`                       |
| `messaging.introduction.declined.v1`         | introduction | `introducerId`, `firstId`, `secondId`, `by`                       |
| `messaging.introduction.completed.v1`        | introduction | `introducerId`, `firstId`, `secondId`, `conversationId`           |

Aucun texte de message dans les événements.

## Événements consommés

Aucun.

## Dépendances

identity (email vérifié, conditions acceptées), profiles (identifiants publics, cartes), network (connexions, degré, blocages), content (publications visibles par un lecteur), media (pièces jointes, règle de lecture).

## Données personnelles (RGPD)

Export : messages écrits, conversations, introductions, préférence de messagerie. Suppression : les conversations appartiennent aussi aux autres participants ; les messages du membre deviennent des pierres tombales vides sans fichier, expédiées par le pseudonyme (« Membre supprimé ») ; la note d'une introduction qu'il a proposée est vidée ; sa préférence supprimée. Contrats enregistrés auprès du module privacy (`infrastructure/messaging-personal-data.ts`, ADR 0074).
