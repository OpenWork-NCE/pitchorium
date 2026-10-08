# Module missions

Missions d'expertise (cahier des charges §6.3, §10.1, §14) : mécénat de compétences bénévole, sans paiement, sans rémunération, sans offre d'emploi ; le recruteur reste une casquette, pas un job board (ADR 0071). Contenu et déroulé non décrits par le cahier des charges : périmètre provisoire (`docs/open-questions.md`).

## Deux sens

- Offre (`POST /v1/missions/offers`) : un contributeur avec la casquette `mentor` (mentorat) ou `expert` (expertise) selon le `kind` (`MISSIONS_HAT_REQUIRED`) publie une mission packagée : titre, description, domaine (texte libre), secteurs, format `session` (8 h au plus) ou `short_mission` (80 h au plus, `MISSIONS_HOURS_EXCEEDED`), heures estimées, mode `remote` ou `on_site` (un pays au moins sur place), pays, langues, capacité (missions en cours à la fois).
- Demande (`POST /v1/missions/requests`) : un entrepreneur (volet entrepreneur) ou l'équipe d'un projet publié (`projectId`) publie un besoin : description, compétences recherchées, échéance souhaitée (`MISSIONS_BENEFICIARY_REQUIRED`, `MISSIONS_PROJECT_ROLE_REQUIRED`).
- Les champs sont stricts : un champ de prix, de taux, de contrat ou de rémunération est refusé, pas ignoré ; le vocabulaire d'une offre d'emploi (CDI, salaire, rémunération, recrutement, full-time, hiring...) dans les textes et les messages est refusé (`MISSIONS_JOB_POSTING_REFUSED`, liste provisoire dans `domain/mission.ts`).
- Visibilité `members` par défaut, `public` avec la page publique de l'auteur ; `moderation_status` modifiable par la façade (module trust). Fermeture par l'auteur : plus de nouvel engagement, ceux en cours continuent.

## Engagements

- Candidature à une demande (le membre donne son temps : casquette exigée) ou sollicitation d'une offre (le membre est aidé : volet entrepreneur, ou équipe du projet nommé), avec un message ; un seul échange ouvert par mission, expert et bénéficiaire (`MISSIONS_ENGAGEMENT_EXISTS`) ; jamais sur sa propre mission.
- Réponse de l'auteur de la mission : acceptée (dans la limite de la capacité d'une offre, `MISSIONS_CAPACITY_REACHED`) ou refusée, avec un message facultatif.
- Mission en cours, puis terminée par l'expert ou annulée par l'un ou l'autre (une demande en attente est retirée par qui l'a faite).
- Achèvement : l'expert déclare les minutes, la date et une description ; le module appelle la façade d'engagement (`declareTime`) dans la même transaction : une entrée du journal du temps partagé, au nom du projet ou de l'entrepreneur, que le bénéficiaire confirme ou conteste par les routes d'engagement (§9.4). Pas de double saisie.
- Pas d'avis ni de notation (non prévus par le cahier des charges).

## Routes

- `POST /v1/missions/offers` (`mission.offer.create` : email vérifié et volet contributeur), `POST /v1/missions/requests` (`mission.request.create` : email vérifié), avec `Idempotency-Key`
- `GET /v1/missions` (`mission.read` ; filtres `direction`, `kind`, `mode`, `sectorCode`, `countryCode`, `language`), `GET /v1/public/missions` (public, `Cache-Control: public, max-age=60`), `GET /v1/me/missions`, `GET /v1/me/mission-engagements?role=&status=` (`mission.read`)
- `GET /v1/missions/{missionId}` (`mission.read`), `GET /v1/public/missions/{missionId}` (public, mission publique)
- `PATCH /v1/missions/{missionId}`, `GET /v1/missions/{missionId}/engagements` (`mission.update`), `POST /v1/missions/{missionId}/close` (`mission.close`) : auteur, ou équipe du projet de la demande
- `POST /v1/missions/{missionId}/engagements` (`mission.engage`, email vérifié, `Idempotency-Key`)
- `GET /v1/mission-engagements/{engagementId}` (`mission.engagement.read`), `POST .../accept` et `.../decline` (`mission.engagement.respond`, auteur), `POST .../complete` (`mission.engagement.complete`, expert), `POST .../cancel` (`mission.engagement.cancel`, expert ou bénéficiaire)

Résolveurs : `MissionResolver` (mission visible du lecteur, rôle `author`), `EngagementResolver` (rôles `expert`, `beneficiary`, `responder` ; 404 pour tout autre membre).

## Schéma `missions`

`missions` (index des missions ouvertes par date de publication, par auteur, par projet), `engagements` (un seul échange ouvert par mission, expert et bénéficiaire, index unique partiel).

## Façade publique (`index.ts`)

`MissionsFacade` : `discoverySources`, `idsAfter`, `cards`, `engagementParties` (notifications), `setModerationStatus` ; types `MissionDiscoverySource`, `EngagementParties` ; classes d'événements.

## Événements émis

| Type                               | Agrégat    | Payload                                                              |
| ---------------------------------- | ---------- | -------------------------------------------------------------------- |
| `missions.mission.published.v1`    | mission    | `authorId`, `direction`, `projectId`                                 |
| `missions.mission.updated.v1`      | mission    | `fields`                                                             |
| `missions.mission.closed.v1`       | mission    | `by`                                                                 |
| `missions.engagement.requested.v1` | engagement | `missionId`, `requesterId`, `responderId`                            |
| `missions.engagement.accepted.v1`  | engagement | `missionId`, `requesterId`, `responderId`                            |
| `missions.engagement.declined.v1`  | engagement | `missionId`, `requesterId`, `responderId`                            |
| `missions.engagement.completed.v1` | engagement | `missionId`, `expertId`, `beneficiaryId`, `projectId`, `timeEntryId` |
| `missions.engagement.canceled.v1`  | engagement | `missionId`, `by`                                                    |

Consommés par discovery (index des missions ouvertes) et notifications.

## Événements consommés

Aucun.

## Dépendances

identity (par le garde d'access), profiles (casquettes, volet entrepreneur, cartes, page publique, données de référence), projects (équipe, carte du projet), engagement (journal du temps), network (blocages).
