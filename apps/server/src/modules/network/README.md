# Module network

Graphe social (cahier des charges §10.2) : suivis, connexions, blocages, listes de réseau, relation entre deux membres et vues de profil. Les suggestions de personnes relèvent du module discovery, les introductions à trois d'une étape ultérieure, le signalement du module trust.

## Suivis (ADR 0027)

- Suivi unilatéral d'une cible générique (`target_type`, `target_id`) : `member` (enregistré par network), `organization` (enregistré par organizations), `project` (enregistré par projects : projets publiés et visibles, clé = identifiant du projet), et les types que d'autres modules enregistreront, sans migration. Chaque type valide sa cible par la façade du module propriétaire (`FollowTargetType.resolve`) et la décrit (`describe`) ; un type inconnu répond comme une cible inconnue (404).
- Clé publique d'une cible : identifiant public d'un membre (`handle`, actuel ou ancien), identifiant d'une organisation. L'identifiant utilisateur n'est jamais exposé.
- On ne se suit pas soi-même ; on ne suit pas un membre de part et d'autre d'un blocage.
- Origine d'un suivi : `manual`, ou `connection` quand il est créé par une connexion acceptée.

## Connexions (ADR 0028)

- Demande avec note facultative de 300 caractères ; email vérifié exigé (action `network.connection.request`). Acceptation ou refus par le destinataire, retrait par l'émetteur. Une seule demande en attente entre deux membres, dans un sens ou dans l'autre ; une demande qui croise une demande en attente du destinataire l'accepte.
- Une connexion acceptée crée le suivi mutuel (origine `connection`, un suivi manuel existant est conservé). Chacun peut cesser de suivre l'autre sans rompre la connexion. Supprimer la connexion retire les suivis d'origine `connection`, pas les suivis manuels.
- Anti-abus, valeurs provisoires et configurables (`docs/open-questions.md`) : plafond de demandes sur sept jours glissants (`NETWORK_CONNECTION_REQUESTS_PER_WEEK`, 100), délai avant une nouvelle demande après un refus (`NETWORK_DECLINE_COOLDOWN_DAYS`, 21 jours), expiration des demandes en attente (`NETWORK_REQUEST_TTL_DAYS`, 30 jours ; tâche planifiée toutes les 15 minutes, et fermeture à la volée).
- Les écritures entre deux membres sont sérialisées par un verrou transactionnel sur la paire.

## Blocage (ADR 0029)

- Bloquer un membre supprime la connexion, les suivis dans les deux sens et les demandes en attente (statut `cancelled`) ; rien n'est rétabli par le déblocage.
- Un membre bloqué ne trouve plus celui qui l'a bloqué (404 sur la relation, les listes, le suivi et les demandes) ; celui qui a bloqué reçoit `NETWORK_MEMBER_BLOCKED`.
- La façade expose les blocages (`blockedUserIds`, `isBlockedBetween`) : content masque les contenus et refuse commentaires et réactions ; messaging l'appliquera.
- Profils : network enregistre auprès de profiles un filtre d'accès (`BlockedProfilesFilter`, port `ProfileAccessFilter`) ; les deux membres ne voient plus le profil, la carte ni les mentions l'un de l'autre, avec la même réponse que pour un profil inexistant.

## Listes et relation

- Abonnés, abonnements (filtrables par type de cible) et connexions, paginés par curseur, les plus récents d'abord ; les membres bloqués de part et d'autre avec le lecteur sont retirés.
- Visibilité des listes d'un membre : réglage `networkLists` stocké par profiles (ADR 0017). `private` : le titulaire seul (403 `NETWORK_LIST_HIDDEN` pour un membre) ; `members` : les membres connectés ; `public` : aussi sans compte, si la page publique est activée (sinon 404).
- Relation avec un membre consulté : degré (`self`, `first`, `second`, `out_of_network`), calculé jusqu'au 2e degré seulement ; connexions en commun comptées jusqu'au plafond `NETWORK_MUTUAL_CONNECTIONS_CAP` (999, affiché « 999+ », `capped`) ; état de la connexion (connecté, demande envoyée ou reçue), suivis dans les deux sens, blocage ; nombre d'abonnés et de connexions si les listes sont visibles.

## Vues de profil (ADR 0030)

- Une lecture de `GET /v1/profiles/{handle}` par un autre membre est signalée par profiles (`ProfileViewListener`, enregistré au démarrage) sans attente : un script Lua Redis pose un marqueur par visiteur, membre et jour (UTC) et met la vue en file seulement s'il est nouveau. Le worker écrit la file par lots chaque minute (tâche `flush-profile-views`), en ignorant les doublons (clé primaire). Une vue perdue (Redis indisponible) est tolérée ; la lecture n'est jamais ralentie.
- Visite privée : préférence du visiteur (`PATCH /v1/me/network/settings`), enregistrée avec la vue au moment de l'écriture. Le visité voit alors une mention anonymisée (le premier secteur que le visiteur montre aux membres, ou aucun), jamais l'identité.
- Statistiques du visité : vues sur 7, 30 et 90 jours, liste des visites (cartes des visiteurs non privés, mentions anonymisées), sans les membres bloqués.
- Rétention `NETWORK_PROFILE_VIEWS_RETENTION_DAYS` (90 jours, provisoire) ; purge quotidienne (tâche `purge-profile-views`).

## Routes

- `PUT|DELETE /v1/network/follows/{targetType}/{targetKey}` (`network.follow`), `GET /v1/network/follows/{targetType}/{targetKey}/followers` (`network.read`)
- `POST /v1/network/connection-requests` (`network.connection.request`, `Idempotency-Key`), `GET /v1/me/network/connection-requests?direction=received|sent` (`network.read`), `POST /v1/network/connection-requests/{requestId}/accept`, `POST .../decline`, `DELETE /v1/network/connection-requests/{requestId}` (retrait) (`network.connection.respond`)
- `DELETE /v1/network/connections/{handle}` (`network.connection.remove`)
- `PUT|DELETE /v1/network/blocks/{handle}` (`network.block`), `GET /v1/me/network/blocks` (`network.read`)
- `GET /v1/network/members/{handle}/followers`, `/following?type=`, `/connections`, `/relationship` (`network.read`)
- `GET /v1/public/network/members/{handle}/followers`, `/following`, `/connections` (public, `Cache-Control: public, max-age=60`)
- `GET|PATCH /v1/me/network/settings` (`network.read`, `network.settings.update`)
- `GET /v1/me/profile-views/summary`, `GET /v1/me/profile-views` (`network.profile-views.read`)

## Schéma `network`

`follows` (clé : abonné, type et identifiant de cible), `connections` (une ligne par sens), `connection_requests` (une seule demande en attente par paire, index unique sur `least`/`greatest`), `blocks`, `settings`, `profile_views` (clé : visité, jour, visiteur). Les index servent les listes lues à rebours, les plus récents d'abord, avec un départage par identifiant.

## Façade publique (`index.ts`)

`NetworkFacade` : `blockedUserIds`, `isBlockedBetween`, `followedIds`, `followedMemberIds`, `connectionIds`, `areConnected`, `degreeBetween` (degré jusqu'au 2e, pour la messagerie), `registerFollowTargetType` ; interfaces `FollowTargetType`, `FollowTargetSummary` ; classes d'événements.

## Événements émis

| Type                              | Agrégat                     | Payload                                                                            |
| --------------------------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| `network.follow.created.v1`       | abonné                      | `targetType`, `targetId`, `origin` (`manual`, `connection`)                        |
| `network.follow.removed.v1`       | abonné                      | `targetType`, `targetId`, `reason` (`unfollowed`, `connection_removed`, `blocked`) |
| `network.connection.requested.v1` | demande                     | `requesterId`, `addresseeId`                                                       |
| `network.connection.accepted.v1`  | demande                     | `requesterId`, `addresseeId`                                                       |
| `network.connection.declined.v1`  | demande                     | `requesterId`, `addresseeId`                                                       |
| `network.connection.withdrawn.v1` | demande                     | `requesterId`, `addresseeId`                                                       |
| `network.connection.removed.v1`   | membre qui retire ou bloque | `peerId`, `reason` (`removed`, `blocked`)                                          |
| `network.block.created.v1`        | membre qui bloque           | `blockedId`                                                                        |
| `network.block.removed.v1`        | membre qui débloque         | `blockedId`                                                                        |

Les vues de profil ne passent pas par l'outbox (ADR 0030).

## Événements consommés

Aucun.

## Tâches planifiées (file `network.maintenance`, worker)

`flush-profile-views` (chaque minute), `expire-connection-requests` (toutes les 15 minutes), `purge-profile-views` (chaque jour à 3 h 23).

## Dépendances

identity (indirectement, par le garde d'access), profiles (identifiants publics, cartes, réglages de confidentialité, secteurs, signalement des vues).
