# Module engagement

Tableau de bord d'impact et journal du temps partagé (cahier des charges §6.3, §9.4) : un tableau de bord d'engagement, pas un compte en banque. Les réactions, enregistrements et suivis du §10.3 relèvent des modules content et network.

## Tableau de bord d'impact

- Euros effectivement versés (mois en cours, UTC, et depuis le début) : équivalent EUR des contributions réussies, nettes des remboursements et des litiges perdus ; nombre de projets soutenus (part nette positive) ; minutes de mentorat et d'expertise déclarées, confirmées, contestées.
- Pour un membre (contributions en son nom) et pour une organisation (contributions faites en son nom ; pas d'heures, personnelles).
- Historique téléchargeable en CSV (RFC 4180, cellules protégées contre l'injection de formules).
- Projection reconstructible (ADR 0053) : `engagement.contribution_facts`, mise à jour sur les événements du module payments par relecture de sa façade, reconstruite par `EngagementService.rebuild`.

## Journal du temps partagé

- Le contributeur déclare des minutes (1 à 1 440) de mentorat ou d'expertise, à une date passée ou du jour, pour un projet visible (qu'il ne possède pas) ou pour un entrepreneur par identifiant public (pas lui-même) : `ENGAGEMENT_BENEFICIARY_INVALID`.
- Le bénéficiaire (l'entrepreneur, ou un propriétaire du projet) confirme ou conteste, une fois (`ENGAGEMENT_TIME_ENTRY_ALREADY_ANSWERED`).
- Une mission terminée (module missions) déclare son temps par la façade (`EngagementFacade.declareTime`), dans la transaction de la mission, avec les mêmes règles : pas de double saisie, le bénéficiaire confirme ou conteste comme pour toute déclaration ; l'événement porte alors `missionEngagementId`.

## Routes

- `GET /v1/me/impact-dashboard`, `GET /v1/me/impact-dashboard/history` (CSV) (`engagement.dashboard.read`)
- `GET /v1/organizations/{organizationId}/impact-dashboard`, `.../history` (CSV) (`engagement.organization.dashboard.read`, membres de l'organisation)
- `POST /v1/me/time-entries` (`engagement.time.declare`, `Idempotency-Key`), `GET /v1/me/time-entries`, `GET /v1/me/time-entries/received` (`engagement.time.read`)
- `POST /v1/time-entries/{timeEntryId}/confirm`, `POST /v1/time-entries/{timeEntryId}/dispute` (`engagement.time.respond`, bénéficiaire)

## Schéma `engagement`

`contribution_facts` (projection), `time_entries`.

## Façade publique (`index.ts`)

`EngagementFacade` (`declareTime`, `timeEntries` : minutes et réponse d'une déclaration), types `DeclaredTime` et `TimeBeneficiary`, `EngagementModule` (global) et les classes d'événements.

## Événements émis

| Type                                 | Payload                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `engagement.time-entry.declared.v1`  | `contributorId`, `projectId`, `entrepreneurId`, `kind`, `minutes`, `missionEngagementId` (mission d'origine ou null) |
| `engagement.time-entry.confirmed.v1` | `by`, `minutes`, `contributorId`                                                                                     |
| `engagement.time-entry.disputed.v1`  | `by`, `contributorId`                                                                                                |

## Événements consommés

`payments.contribution.succeeded.v1`, `payments.contribution.refunded.v1`, `payments.contribution.dispute-resolved.v1` (handler `engagement.project-contributions`).

## Dépendances

payments (faits des contributions), projects (projets, rôles d'équipe), profiles (cartes, identifiants publics), organizations (rôle dans l'organisation).

## Données personnelles (RGPD)

Export : contributions du tableau de bord, heures déclarées ou reçues. Suppression : la projection et le journal du temps gardés sous le pseudonyme (les heures comptent aussi pour l'autre partie). Contrats enregistrés auprès du module privacy (`infrastructure/engagement-personal-data.ts`, ADR 0074).
