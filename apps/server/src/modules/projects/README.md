# Module projects

Projets et campagnes (cahier des charges §11, avec §9.1, §9.3, §10.2, §10.3, §10.7) : brouillon, aperçu, publication, paliers, contreparties, financement flexible, actualités, manifestations d'intérêt, équipe, vitrine et page publique. Cycle de vie et flux du financement : `docs/architecture/projects-and-funding.md`.

## Projet

- Propriétaire : un membre avec un volet entrepreneur (`project.create`). Organisation porteuse facultative, si le membre y est `owner` ou `admin` (`PROJECTS_ORGANIZATION_ROLE_REQUIRED`).
- Contenu : titre (120), slug (historique et redirections 301, jamais réattribué), résumé (300), description en Markdown restreint (20 000), secteur (données de référence), zone d'impact (200), pays en Afrique (M49 002) ou dans les Caraïbes (029), 10 au plus (`PROJECTS_COUNTRY_NOT_ELIGIBLE`), galerie (usage media `project_gallery`, 20 images, la première sert de couverture), documents privés (`project_document`, 10 PDF), vidéo, instruments acceptés (§9.1), indicateur « nous ouvrons le capital » affiché comme intention seulement (§15, décision 5). Limites provisoires (`docs/open-questions.md`).
- Markdown restreint (sous-ensemble de CommonMark) : paragraphes et sauts de ligne, emphase et emphase forte, titres de niveau 2 et 3, listes à puces et numérotées, citations, code en ligne, séparateurs, liens vers des URL https (en ligne ou automatiques). Refusés (`PROJECTS_DESCRIPTION_INVALID`) : HTML brut, images, blocs de code, définitions de liens, tableaux, titres de niveau 1 ou au-delà de 3, liens non https.
- Vidéo (ADR 0042) : lien YouTube (`youtube.com/watch`, `youtu.be`, `shorts`, `embed`, `youtube-nocookie.com`) ou Vimeo (`vimeo.com/<id>[/<hash>]`, `player.vimeo.com/video/<id>`), en https ; seul l'identifiant validé est stocké et la page reçoit `https://www.youtube-nocookie.com/embed/<id>` ou `https://player.vimeo.com/video/<id>?dnt=1`. Autre lien : `PROJECTS_VIDEO_URL_INVALID`.

## Financement (ADR 0037, 0038, 0039)

- Devise de libellé : euro (`EUR`) ; la devise est stockée avec chaque montant pour une évolution ultérieure, toute autre devise est refusée (`PROJECTS_CURRENCY_NOT_SUPPORTED`). La conversion des paiements relève du module payments.
- Paliers : 1 à 5, seuils cumulatifs strictement croissants, chacun avec l'usage des fonds ; le dernier seuil est l'objectif (remplacer les paliers fixe l'objectif). Un palier est débloqué dès que le montant collecté atteint son seuil et le reste (date du premier déblocage).
- Durée de 30 à 90 jours, date de fin calculée à la publication, sans prolongation.
- Financement flexible : à l'échéance, les paliers atteints restent acquis, sans remboursement automatique ; l'objectif peut être dépassé, le projet reste ouvert jusqu'à sa date de fin.
- Verrouillage : après la première contribution payée, l'objectif, les seuils et les montants minimums des contreparties sont verrouillés (`PROJECTS_FUNDING_LOCKED`) ; les textes restent modifiables et toute modification d'un projet publié est auditée (`projects.project-updated`).
- Montants collectés : `ProjectsFacade.applyFunding(contributionId, projectId, Money)` et `reverseFunding(contributionId)`, idempotentes par contribution (`PROJECTS_CONTRIBUTION_CONFLICT` pour la même contribution avec d'autres valeurs), sous verrou de la ligne du projet : total, nombre de contributions, paliers débloqués, passage à `funded`, et retour à `funding` si une annulation repasse sous l'objectif avant l'échéance. Jusqu'au module payments, seuls les tests et `pnpm db:seed:dev` les appellent.

## Contreparties (ADR 0041)

Titre, description, montant minimum, instruments éligibles (`donation`, `reward_crowdfunding`, acceptés par le projet ; le love money n'a pas de contrepartie matérielle), quantité limitée ou illimitée, date de livraison estimée. La façade expose `reserve(rewardId, contributionId)`, `confirm(contributionId)` et `release(contributionId)`, idempotentes par contribution et sérialisées sur la ligne de la contrepartie : jamais plus d'unités que le stock (`PROJECTS_REWARD_SOLD_OUT`). Une contrepartie réservée ne peut pas être supprimée.

## Cycle de vie

- Statuts `draft`, `funding`, `funded`, `closed`. Publication : `draft` vers `funding` ; objectif atteint : `funded`, toujours ouvert ; date de fin : `closed` par la tâche planifiée `close-ended` (toutes les 5 minutes). La tâche `announce-ending-soon` (toutes les heures) émet une fois `projects.project.ending-soon.v1` quand la fin est à moins de `PROJECTS_ENDING_SOON_HOURS` (72 h, provisoire).
- Publication (`project.publish`, propriétaire, email vérifié et volet entrepreneur) : champs complets (`PROJECTS_NOT_PUBLISHABLE` avec `missing`), au moins un palier, évaluation d'impact si une méthodologie est publiée (`PROJECTS_IMPACT_ASSESSMENT_REQUIRED`), consentement explicite `publicDisplayConsent: true` à l'affichage public du nom, de la photo et du titre du porteur (ADR 0040), enregistré et audité. La galerie et les images d'actualités deviennent publiques.
- Aperçu de la page publique d'un brouillon, pour l'équipe seulement (`GET /v1/projects/{projectId}/preview`).
- Suppression possible à l'état `draft` seulement (`PROJECTS_NOT_DRAFT`) ; le slug reste réservé.

## Équipe

Rôles `owner` et `editor`, fonction affichée. Invitation par identifiant public (`project.team.manage`, propriétaires), acceptation avec consentement d'affichage public, refus, départ, retrait, changement de rôle ; jamais sans propriétaire actif (`PROJECTS_LAST_OWNER`). Si le porteur affiché cesse d'être propriétaire, le plus ancien propriétaire restant le remplace. La page publique ne montre que les membres actifs ayant consenti.

## Impact

Évaluation par l'équipe (`project.impact.assess`) par la façade du module impact ; à la création, l'évaluation du volet entrepreneur du porteur est copiée si elle répond à tous les critères de la version publiée (source `prefilled`), puis ajustable ; `prefill` donne les réponses encore valables. Le score courant est copié sur le projet pour les filtres de la vitrine. Toute vue porte `selfDeclared: true` et la version de la méthodologie ; sans méthodologie publiée, aucun score n'est affiché et le filtre `minImpact` est ignoré.

## Actualités et manifestations d'intérêt

- Actualités (§11.3) : texte (5 000) et images (usage `project_update_image`, 6), publiées par l'équipe d'un projet publié ; visibilité alignée sur celle du projet. Elles apparaissent dans le fil des abonnés du projet (élément `project_update`, source enregistrée auprès de content).
- Manifestation d'intérêt (§9.1, §11.2) pour une subvention, un prêt d'honneur, une prise de participation ou un contact général : message (2 000), montant indicatif non engageant, PDF privés (`project_interest_document`, 3), lisibles par l'auteur et l'équipe. Aucun paiement.

## Vitrine et lecture publique

- Vitrine paginée par curseur : projets publiés, visibles et non supprimés ; filtres `countryCode`, `sectorCode`, `status`, `minImpact`, `featured` ; tris `recent` (publication) et `ending_soon` (fin la plus proche, projets ouverts). La recherche plein texte relève du module discovery.
- Page (§11.2) : bloc principal, financement (collecté, objectif, progression, jours restants, instruments), résumé, histoire, vidéo, galerie, paliers avec leur état, contreparties avec leur disponibilité, dernières actualités, équipe, impact avec la mention auto-déclarée, champs de partage (`share`), état du lecteur (`viewer`) et données de gestion pour l'équipe (`management`). Documents listés aux membres connectés.
- Mise en avant éditoriale par un `moderator` ou un `admin` (`project.feature`, auditée). `moderation_status` (`visible`, `hidden`, `removed`) sur les projets et les actualités, modifiable par la façade (module trust).

## Routes

- `POST /v1/projects` (`project.create`, `Idempotency-Key`), `GET /v1/me/projects`, `GET /v1/projects` (vitrine), `GET /v1/public/projects` (public, `Cache-Control: public, max-age=60`)
- `GET /v1/projects/by-slug/{slug}` (membre, 301 pour un ancien slug), `GET /v1/public/projects/{slug}` (public, en cache 60 s, 301)
- `GET /v1/projects/{projectId}`, `GET /v1/projects/{projectId}/preview` (équipe), `PATCH /v1/projects/{projectId}`, `PUT /v1/projects/{projectId}/slug`, `DELETE /v1/projects/{projectId}` (brouillon, propriétaire)
- `PUT /v1/projects/{projectId}/tiers`, `PUT /v1/projects/{projectId}/gallery`, `PUT /v1/projects/{projectId}/documents`
- `POST /v1/projects/{projectId}/publish` (`project.publish`)
- `PUT|DELETE /v1/projects/{projectId}/feature` (`project.feature`)
- `POST /v1/projects/{projectId}/rewards` (`Idempotency-Key`), `PATCH|DELETE /v1/projects/{projectId}/rewards/{rewardId}`
- `POST /v1/projects/{projectId}/team/invitations` (`Idempotency-Key`), `PATCH|DELETE /v1/projects/{projectId}/team/{handle}`, `POST /v1/projects/{projectId}/team/leave`, `GET /v1/me/project-invitations`, `POST /v1/me/project-invitations/{projectId}/accept`, `POST /v1/me/project-invitations/{projectId}/decline`
- `POST /v1/projects/{projectId}/updates` (`project.updates.publish`, `Idempotency-Key`), `GET /v1/projects/{projectId}/updates`, `GET /v1/public/projects/{projectId}/updates`, `PATCH|DELETE /v1/projects/{projectId}/updates/{updateId}`
- `POST /v1/projects/{projectId}/interests` (`project.interest.express`, `Idempotency-Key`), `GET /v1/projects/{projectId}/interests` (`project.interest.read`, équipe)
- `GET|POST /v1/projects/{projectId}/impact-assessments`, `GET /v1/projects/{projectId}/impact-assessments/prefill` (`project.impact.assess`)
- `GET /v1/projects/{projectId}/posts`, `GET /v1/public/projects/{projectId}/posts` : publications rattachées (module content)

Les routes `:projectId` passent par `ProjectResolver` : un projet supprimé, ou non publié hors de l'équipe du lecteur, répond 404.

## Schéma `projects`

`projects` (index de la vitrine et des projets ouverts par date de fin), `slug_history`, `team_members`, `tiers`, `rewards`, `reward_reservations`, `funding_entries`, `updates`, `interests`.

## Façade publique (`index.ts`)

`ProjectsFacade` : `applyFunding`, `reverseFunding`, `reserve`, `confirm`, `release`, `setModerationStatus`, `setUpdateModerationStatus` ; `PROJECT_FOLLOW_TARGET` ; types `FundingSnapshot`, `ReservationStatus` ; classes d'événements. Au démarrage, la façade enregistre : le type de cible de suivi `project` (network), le validateur de rattachement des publications et la source d'actualités du fil (content), les projets portés (organizations ; les projets soutenus viendront du module payments), et les règles de lecture des fichiers privés de `project`, `project_update` et `project_interest` (media).

## Événements émis

| Type                              | Payload                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `projects.project.created.v1`     | `ownerId`, `organizationId`                              |
| `projects.project.updated.v1`     | `fields`                                                 |
| `projects.project.published.v1`   | `ownerId`, `endsAt`, `goalMinor`, `currency`             |
| `projects.project.funded.v1`      | `collectedMinor`, `goalMinor`, `currency`                |
| `projects.project.ending-soon.v1` | `endsAt`                                                 |
| `projects.project.closed.v1`      | `collectedMinor`, `goalMinor`, `currency`, `goalReached` |
| `projects.project.deleted.v1`     | `deletedBy`                                              |
| `projects.tier.unlocked.v1`       | `tierId`, `position`, `thresholdMinor`, `currency`       |
| `projects.update.published.v1`    | `updateId`, `authorId`                                   |
| `projects.reward.created.v1`      | `rewardId`                                               |
| `projects.reward.updated.v1`      | `rewardId`, `fields` (`deleted` pour une suppression)    |
| `projects.reward.sold-out.v1`     | `rewardId`                                               |
| `projects.team.member-added.v1`   | `userId`, `role`                                         |
| `projects.team.member-removed.v1` | `userId`, `reason` (`left`, `removed`), `by`             |
| `projects.interest.expressed.v1`  | `interestId`, `userId`, `kind`                           |

L'agrégat de chaque événement est le projet. Destinés aux notifications et à la découverte (étapes ultérieures).

## Événements consommés

Aucun.

## Dépendances

identity (par le garde d'access), access (politiques), profiles (cartes, identifiants, secteurs, pays), organizations (rôle, cartes, projets portés par enregistrement), media (fichiers, règles de lecture), network (cible de suivi, suivis du lecteur), content (rattachement, actualités du fil, publications rattachées), impact (méthodologie, évaluations).
