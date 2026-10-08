# Module trust

Confiance et sécurité (cahier des charges §13) : signalements, file de modération, décisions motivées, appels, suspensions, signaux automatiques et compteurs de transparence. Le flux est conçu pour être compatible avec le règlement européen sur les services numériques (DSA) : mécanisme de notification et d'action, exposé des motifs à la personne concernée, traitement interne des réclamations, données de transparence (ADR 0072). Les obligations réellement applicables à Pitchorium sont une question juridique (`docs/open-questions.md`).

## Signalements

- Cibles : `profile` (par son identifiant public, les identifiants de membres ne sont jamais exposés), `organization`, `post`, `comment`, `project`, `project_update`, `event`, `mission`, `message`, `media`. Chaque cible est résolue par la façade du module qui la possède (`TargetDirectory`) : existence, visibilité pour le signalant, membre concerné (auteur, propriétaire, organisateur, expéditeur), campagne en cours.
- Motifs (provisoires, `REPORT_REASONS`) : `spam`, `harassment`, `fraud`, `illegal_content`, `misleading_information`, `intellectual_property`, `other`.
- Un membre signale une cible une fois tant que son dossier est ouvert (`TRUST_REPORT_DUPLICATE`), jamais son propre contenu (`TRUST_SELF_REPORT`).
- Signalement de contenu illégal sans compte : `POST /v1/public/reports`, explication obligatoire, déclaration de bonne foi, nom et email facultatifs (sans email, pas d'information sur la décision), langue des emails ; limité à 5 par heure et par adresse IP (`ANONYMOUS_REPORTS_PER_HOUR`, provisoire), vérifié par Cloudflare Turnstile quand il est configuré (en-tête `X-Captcha-Response`, `CAPTCHA_REQUIRED` ou `CAPTCHA_FAILED`, ADR 0103). Un message ne peut pas être signalé sans compte.
- Dédoublonnage : un dossier ouvert par cible (index unique partiel), qui cumule les signalements, leurs motifs et leur nombre ; les signalements d'une même cible sont sérialisés par un verrou consultatif transactionnel.
- Accusé de réception puis information sur la décision : notifications `report_received` et `report_resolved` pour un membre ; emails `report_received`, `report_action_taken` ou `report_no_action` (`@pitchorium/emails`, gabarit `platform-notice`) envoyés par le worker au notifiant sans compte qui a laissé son adresse.
- Message signalé : le modérateur reçoit le message et au plus les 3 messages qui le précèdent dans la conversation (`REPORT_CONTEXT_MESSAGES_BEFORE`, façade de messaging), figés au moment du signalement ; jamais toute la conversation. Seul un participant qui voit la conversation peut le signaler.

## File de modération

- Priorité (`domain/priority.ts`, plus forte d'abord, puis la plus ancienne) : poids du motif le plus grave (`illegal_content` 80, `fraud` 70, `harassment` 60, `intellectual_property` et `misleading_information` 40, `spam` 20, `other` 10 ; signal automatique 30), plus 5 par signalement supplémentaire, au plus 50. Une fraude signalée sur un projet ou une actualité d'un projet en financement (`funding` ou `funded`) vaut 1 000 : elle passe avant tout. Les raisons de la priorité sont listées dans `priorityReasons`.
- Affectation à un modérateur ou un administrateur (ou retrait), avec historique (`assignments`), auditée.
- Décisions (`domain/decisions.ts`) :
  - `dismiss` : classement sans suite ;
  - `hide`, `remove` : `moderation_status` du contenu dans son module (`hidden` ou `removed` ; un fichier est `removed`) ; impossible sur un profil ou une organisation ;
  - `warn` : avertissement au membre concerné ;
  - `suspend` : suspension temporaire (`suspensionDays`, jusqu'à 365) ou définitive (`null`) ;
  - `freeze_project` : gel d'un projet, plus aucune contribution acceptée (`ProjectsFacade.setFundingFrozen`), puis remboursements possibles.
- Chaque décision porte son exposé des motifs : motif, faits (`statement`, 20 caractères au moins), fondement (`terms` ou `law`, avec une référence facultative), détection automatisée (dossier né d'un signal ; la décision est toujours humaine), fin de suspension, date limite d'appel. Le membre concerné le reçoit (notification transactionnelle `moderation_decision`, avec l'exposé dans l'email) et le lit dans `GET /v1/me/moderation`.
- La lecture d'un dossier, qui contient des données personnelles, est auditée (`trust.case-viewed`), comme l'affectation, la décision, l'appel, sa résolution et la levée d'une suspension.

## Permissions

- `moderator` et `admin` (double authentification) : lecture de la file, affectation, décisions sur les contenus, avertissement, suspension jusqu'à `TRUST_MODERATOR_MAX_SUSPENSION_DAYS` jours (30, provisoire), résolution des appels, levée d'une suspension.
- `admin` seulement (`TRUST_ADMIN_REQUIRED`) : suspension définitive ou plus longue, gel d'un projet, remboursements d'un projet gelé (action `trust.project.refund`, session récente exigée), compteurs de transparence.

## Suspension

- Le module enregistre auprès de access la source du niveau `suspended` (`AccessFacade.registerAccountStatusSource`) : une suspension commencée, ni levée ni échue.
- Un membre suspendu se connecte, lit sa situation (`trust.standing.read`), fait appel (`trust.decision.appeal`), consulte ses préférences et ses conditions, exporte ou supprime ses données ; toute autre action répond `ACCESS_ACCOUNT_SUSPENDED` : il ne publie, ne commente, n'écrit et ne contribue plus.
- Au début de la suspension, toutes ses sessions sont révoquées (`IdentityFacade.revokeAllSessions(userId, 'suspension')`).
- Fin : à l'échéance (tâche toutes les 5 minutes), levée anticipée motivée par un modérateur, ou appel accueilli ; `trust.suspension.ended.v1` porte la cause.

## Appels

- Un appel par décision, par le membre concerné, jusqu'à `TRUST_APPEAL_WINDOW_DAYS` jours (183, soit au moins six mois) ; un classement sans suite n'est pas susceptible d'appel par le membre concerné.
- Réexamen par un autre modérateur ou administrateur que l'auteur de la décision (`TRUST_SAME_MODERATOR`), décision finale motivée : `upheld` (maintenue) ou `overturned` (annulée : le contenu redevient visible, la suspension prend fin, le projet est dégelé).

## Remboursements d'un projet gelé

`POST /v1/admin/moderation/projects/{projectId}/refunds` (décision de gel en cours exigée, `TRUST_PROJECT_NOT_FROZEN` sinon) enregistre l'événement interne `trust.project.refunds-requested.v1` ; le worker rembourse chaque contribution payée encore remboursable par `PaymentsFacade.refundForModeration` (une tâche par contribution, idempotente : une contribution déjà remboursée est ignorée).

## Signaux automatiques

Sans apprentissage automatique ; un signal ouvre un dossier `origin = signal` sur le profil, jamais une sanction (seuils provisoires) :

- `message_requests` : `TRUST_SIGNAL_MESSAGE_REQUESTS_PER_DAY` (15) premiers messages hors réseau en 24 heures (`messaging.conversation.created.v1` au statut `request`) ;
- `connection_requests` : `TRUST_SIGNAL_CONNECTION_REQUESTS_PER_DAY` (50) demandes de connexion en 24 heures ;
- `reports_received` : `TRUST_SIGNAL_REPORTS_RECEIVED_PER_WEEK` (3) signalements reçus en 7 jours par les contenus d'un même membre.

L'activité comptée (table `activity`, une ligne par événement source) est purgée après 7 jours (04:20 UTC). Métriques : `pitchorium.trust.report.created`, `pitchorium.trust.signal.raised`, `pitchorium.trust.decision.taken`, `pitchorium.trust.appeal.resolved`.

## Transparence

`GET /v1/admin/moderation/transparency?from=&to=` (jour de fin inclus, 366 jours au plus) : signalements par motif et par type de cible, dont sans compte ; dossiers ouverts, issus de signaux, résolus, délai médian de résolution en heures ; décisions par type ; suspensions (dont définitives) ; appels reçus, maintenus, annulés, en attente. Aucune donnée personnelle.

## Routes

- `POST /v1/reports` (`trust.report.create`), `GET /v1/me/reports` (`trust.report.read`), `POST /v1/public/reports` (public, limité).
- `GET /v1/me/moderation`, `GET /v1/me/moderation/decisions` (`trust.standing.read`), `POST /v1/me/moderation/decisions/{decisionId}/appeal` (`trust.decision.appeal`, membre concerné).
- `GET /v1/admin/moderation/cases`, `GET /v1/admin/moderation/cases/{caseId}`, `GET /v1/admin/moderation/appeals` (`trust.moderation.read`) ; `POST /v1/admin/moderation/cases/{caseId}/assignment` (`trust.moderation.assign`) ; `POST /v1/admin/moderation/cases/{caseId}/decisions` (`trust.moderation.decide`) ; `POST /v1/admin/moderation/appeals/{appealId}/resolution` (`trust.appeal.resolve`) ; `POST /v1/admin/moderation/suspensions/{suspensionId}/lift` (`trust.suspension.lift`) ; `POST /v1/admin/moderation/projects/{projectId}/refunds` (`trust.project.refund`) ; `GET /v1/admin/moderation/transparency` (`trust.transparency.read`).

## Schéma `trust`

`cases` (un ouvert par cible), `reports` (signalant ou coordonnées facultatives, contexte limité d'un message), `assignments`, `decisions` (exposé des motifs, date d'annulation), `appeals` (un par décision), `suspensions`, `activity` (signaux).

## Façade publique (`index.ts`)

`TrustFacade` : `decisionNotice` (exposé d'une décision pour les notifications), `appealOutcome`, `activeSuspension` ; type `DecisionNotice` ; classes d'événements. Au démarrage, la façade enregistre la source de suspension auprès de access.

## Événements émis

| Type                                 | Payload                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `trust.report.created.v1`            | `caseId`, `targetType`, `reason`, `reporterId` (null : sans compte) |
| `trust.report.resolved.v1`           | `caseId`, `reporterId`, `outcome` (`action_taken`, `no_action`)     |
| `trust.decision.taken.v1`            | `caseId`, `subjectId`, `kind`, `targetType`, `targetId`             |
| `trust.decision.appealed.v1`         | `appealId`, `appellantId`                                           |
| `trust.decision.appeal-resolved.v1`  | `appealId`, `appellantId`, `outcome` (`upheld`, `overturned`)       |
| `trust.suspension.started.v1`        | `userId`, `decisionId`, `endsAt` (null : définitive)                |
| `trust.suspension.ended.v1`          | `userId`, `decisionId`, `cause` (`expired`, `lifted`, `overturned`) |
| `trust.project.refunds-requested.v1` | interne : `projectId`, `contributionIds`, `reason`, `requestedBy`   |

## Événements consommés

`messaging.conversation.created.v1`, `network.connection.requested.v1` (handler `trust.signals`) ; `trust.report.created.v1`, `trust.report.resolved.v1`, `trust.project.refunds-requested.v1` (handler `trust.jobs`). File `trust.moderation` : `end-suspensions` (toutes les 5 minutes), `purge-activity` (04:20 UTC), `notice`, `refund`.

## Dépendances

identity (révocation des sessions), access (rôles, source de suspension), profiles, organizations, content, projects, events, missions, messaging, media (résolution et modération des cibles), payments (contributions remboursables, remboursement).

## Données personnelles (RGPD)

Export : signalements faits, décisions le concernant avec leur exposé des motifs, appels, suspensions. Suppression : décisions, dossiers, appels et suspensions gardés comme preuve sous le pseudonyme ; coordonnées laissées sur un signalement effacées ; activité des signaux supprimée. Contrats enregistrés auprès du module privacy (`infrastructure/trust-personal-data.ts`, ADR 0074).
