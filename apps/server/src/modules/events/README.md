# Module events

Événements (cahier des charges §14, V3), cités sans autre précision : le périmètre ci-dessous est une proposition à valider avec le client (ADR 0069, `docs/open-questions.md`). Événements gratuits uniquement, sans billetterie (ADR 0070).

## Événement

- Organisé par un membre (`organizer_id`), en son nom ou au nom d'une organisation dont il est `owner` ou `admin` (`EVENTS_ORGANIZATION_ROLE_REQUIRED`) ; rattachement facultatif à un projet dont il est membre de l'équipe (`EVENTS_PROJECT_ROLE_REQUIRED`).
- Contenu : titre (120), slug avec historique et redirections 301 (jamais réattribué, mots réservés), description en Markdown restreint (10 000, même sous-ensemble que les projets, `platform/kernel/markdown.ts`), type `online`, `in_person` ou `hybrid`, début et fin (instants avec décalage, stockés en UTC, 14 jours au plus) et fuseau IANA du lieu, lieu (nom, adresse, ville, pays ; exigé en présentiel et hybride), lien de connexion https (exigé en ligne et hybride, révélé aux seuls inscrits et aux organisateurs), langue, secteurs (5), pays (10 ; le pays du lieu est ajouté), image (usage media `event_image`), capacité (illimitée si absente). Limites provisoires (`docs/open-questions.md`).
- Visibilité `public` ou `members` (défaut), même règle que les publications : `public` exige la page publique du membre organisateur, ou une organisation (`EVENTS_PUBLIC_NOT_ALLOWED`) ; si le membre désactive sa page, ses événements publics sont lus `members`.
- Organisateurs : le créateur, et les `owner` et `admin` de l'organisation organisatrice (rôle `organizer` du résolveur). `moderation_status` (`visible`, `hidden`, `removed`) modifiable par la façade (module trust) ; un événement masqué ne reste visible que de ses organisateurs.

## Cycle de vie

`draft`, `published`, `canceled`, `completed` (`domain/event.ts`). Publication d'un brouillon non terminé ; annulation motivée d'un événement publié (les inscrits et la liste d'attente sont notifiés) ; `completed` par la tâche `complete-ended` (toutes les 5 minutes) une fois la fin passée. Suppression d'un brouillon seulement. Un changement d'horaire, de lieu, de lien, de titre ou de description d'un événement publié incrémente sa `SEQUENCE` iCalendar.

## Inscription (ADR 0070)

- Gratuite, ouverte de la publication au début (`EVENTS_REGISTRATION_CLOSED`) : une place tant qu'il en reste, sinon la liste d'attente. Une nouvelle inscription ne change que le consentement d'apparaître dans la liste des participants (`showInAttendees`, refusé par défaut).
- Désinscription : la place libérée va au premier de la liste d'attente (ordre d'inscription), aussitôt et dans la même transaction ; une hausse de capacité promeut de même. La capacité ne descend jamais sous le nombre d'inscrits (`EVENTS_CAPACITY_BELOW_REGISTERED`). Les écritures d'un événement sont sérialisées par le verrou de sa ligne.
- Participants : l'organisateur voit toutes les inscriptions, liste d'attente comprise ; un inscrit voit les inscrits qui ont consenti à apparaître.

## Calendriers (RFC 5545)

- Fichier ICS d'un événement : `GET /v1/events/{eventId}/ics` (lien de connexion pour un inscrit ou un organisateur), `GET /v1/public/events/{slug}/ics` (événement public, sans lien).
- Flux personnel des événements où le membre est inscrit (annulés compris, pour que les agendas les retirent ; terminés depuis 30 jours au plus) : `POST /v1/me/event-calendar` crée ou remplace un jeton secret (32 octets aléatoires, seule son empreinte SHA-256 est stockée) et renvoie `<API_PUBLIC_URL>/v1/calendars/<jeton>.ics` ; `DELETE /v1/me/event-calendar` le révoque.
- Instants en UTC (`DTSTART:...Z`), heure locale du lieu en tête de la description, lignes pliées à 75 octets, `UID` stable, `STATUS:CANCELLED` pour un événement annulé (`domain/ics.ts`).

## Fil, découverte, notifications

- Fil : les événements publiés des membres et organisations suivis par le lecteur sont des éléments `event` (source enregistrée auprès de content), sans organisateur bloqué.
- Discovery indexe les événements publiés et terminés (façade `discoverySources`, `idsAfter`, `cards`).
- Notifications (module notifications) : inscription ou liste d'attente, promotion, rappel avant le début, annulation.
- Le suivi d'un événement par le registre de network n'est pas retenu : l'inscription en tient lieu (écart documenté dans l'ADR 0069).

## Routes

- `POST /v1/events` (`event.create`, `Idempotency-Key`), `GET /v1/events` (`event.read` ; filtres `countryCode`, `sectorCode`, `format`, `language`, `from`), `GET /v1/public/events` (public, `Cache-Control: public, max-age=60`), `GET /v1/me/events?role=organizer|attendee` (`event.read`)
- `GET /v1/events/by-slug/{slug}` (`event.read`, 301 pour un ancien slug), `GET /v1/public/events/{slug}` (public, en cache 60 s, 301), `GET /v1/public/events/{slug}/ics` (public)
- `GET /v1/events/{eventId}`, `GET /v1/events/{eventId}/ics` (`event.read`)
- `PATCH /v1/events/{eventId}`, `PUT /v1/events/{eventId}/slug` (`event.update`), `POST /v1/events/{eventId}/publish` (`event.publish`, email vérifié), `POST /v1/events/{eventId}/cancel` (`event.cancel`), `DELETE /v1/events/{eventId}` (`event.delete`, brouillon) : organisateurs
- `PUT|DELETE /v1/events/{eventId}/registration` (`event.register`, email vérifié), `GET /v1/events/{eventId}/attendees` (`event.attendees.read`, organisateurs et inscrits)
- `POST|DELETE /v1/me/event-calendar` (`event.calendar.manage`), `GET /v1/calendars/{jeton}.ics` (public, jeton secret)

Les routes `:eventId` passent par `EventResolver` : un événement que le lecteur ne peut pas voir (brouillon, masqué, blocage avec l'organisateur) répond 404.

## Schéma `events`

`events` (index des listes par date de fin, du fil par organisateur et date de publication), `slug_history`, `registrations` (clé : événement et membre ; index de la file d'attente), `calendar_tokens` (empreinte du jeton).

## Façade publique (`index.ts`)

`EventsFacade` : `discoverySources`, `idsAfter`, `cards`, `summaries`, `attendeeIds`, `startingBetween` (rappels), `setModerationStatus` ; types `EventDiscoverySource`, `EventSummary` ; classes d'événements.

## Événements émis

| Type                              | Payload                                         |
| --------------------------------- | ----------------------------------------------- |
| `events.event.created.v1`         | `organizerId`, `organizationId`, `projectId`    |
| `events.event.published.v1`       | `organizerId`, `organizationId`, `startsAt`     |
| `events.event.updated.v1`         | `fields` (dont `slug`, `moderationStatus`)      |
| `events.event.canceled.v1`        | `by`                                            |
| `events.event.completed.v1`       | aucun                                           |
| `events.registration.created.v1`  | `userId`, `status` (`registered`, `waitlisted`) |
| `events.registration.canceled.v1` | `userId`, `status`                              |
| `events.registration.promoted.v1` | `userId`                                        |

L'agrégat de chaque événement est l'événement. Consommés par discovery (index) et notifications.

## Événements consommés

Aucun.

## Tâches planifiées (file `events.maintenance`, worker)

`complete-ended` (toutes les 5 minutes).

## Dépendances

identity (par le garde d'access), profiles (cartes, page publique, données de référence), organizations (rôle, cartes, organisations gérées), projects (équipe, carte du projet), media (image), network (suivis et blocages), content (source du fil).
