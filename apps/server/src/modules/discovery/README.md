# Module discovery

Recherche, matching expliqué et page Découvrir (cahier des charges §2.1, §10.2, §10.6, §11.4). Architecture : `docs/architecture/discovery.md` ; décisions : ADR 0065 (projection), 0066 (multilinguisme et pondération), 0067 (matching à règles explicables), 0068 (précalcul des suggestions).

## Projection de recherche (ADR 0065)

- discovery ne lit jamais les tables des autres modules : le handler `discovery.index` (worker) réagit aux événements de profiles, organizations, projects, events et missions, relit l'entité par la façade de son module et réécrit ses documents dans la transaction de l'inbox.
- Un document par entité et par audience : `members` (ce qu'un membre connecté peut voir : profil de base et volets dont les détails ne sont pas privés) et `public` (ce qu'un visiteur peut voir : page publique activée, volets publics, événements et missions publics) ; une entité invisible des visiteurs n'a pas de document `public`. Brouillons, entités supprimées et modérées ne sont jamais indexés. Le membre derrière l'entité (`owner_id`) sert à écarter les blocages.
- Texte pondéré `tsvector` : A nom ou titre, B sous-titre (titre du profil, résumé, organisation), C description, D libellés français et anglais des secteurs, pays et casquettes. Attributs filtrables : pays, secteurs, étiquettes (`facet:`, `hat:`, `lang:`, `instrument:`, `format:`, `direction:`, `kind:`, `mode:`, `structure:`, `verified`, `featured`), statut, score d'impact, montant, dates.
- `pnpm discovery:reindex` reconstruit tout depuis les façades puis recalcule les suggestions ; `pnpm discovery:reindex --check` compare la projection aux sources (empreinte de chaque document) et répare. La même vérification tourne chaque jour à 03:50 UTC (tâche `check-drift`) et émet `discovery.index.drift-detected.v1` quand elle trouve un écart.

## Recherche (ADR 0066)

- Une barre pour les personnes, organisations, projets, événements et missions (`kinds` pour restreindre). Configuration `simple` sans accents (`lower(unaccent(...))`), chaque terme en préfixe (`irrig:*`), et tolérance aux fautes sur les noms par trigrammes (`<%`, similarité de mot 0,5).
- Score : rang plein texte (poids A 1, B 0,4, C 0,2, D 0,1) + 0,6 x similarité du nom + 0,4 si le nom commence par la requête (`domain/search-query.ts`).
- Filtres : pays, secteur, langue ; projets (§10.6) : état `funding`, `funded`, `closed`, impact minimum ; personnes : volet, casquette, mentorat ; organisations : type de structure, vérifiées ; événements : format, passés exclus par défaut ; missions : sens, type, mode. Un filtre propre à un type restreint la recherche à ce type.
- Autocomplétion : noms qui commencent par la requête, puis qui la contiennent comme mot, puis proches malgré une faute.
- Visibilité : un visiteur cherche dans les documents `public`, un membre dans les documents `members`, sans les entités des membres bloqués de part et d'autre.
- Pagination par curseur opaque (rang), 1 000 résultats au plus.

## Matching expliqué (ADR 0067, 0068)

- Règles lisibles, pondérées et versionnées dans `domain/matching.ts` (`MATCHING_RULES_VERSION`, `MATCHING_WEIGHTS`), provisoires (`docs/open-questions.md`) : besoin de l'entrepreneur et casquette du contributeur (`NEED_TO_HATS`), mentorat proposé ou cherché, secteur commun, pays de l'entreprise ou du projet dans les pays d'intervention, financement visé ou objectif dans le ticket (même devise), instruments compatibles, entrepreneurs complémentaires (même pays et autre secteur, ou même secteur et autre pays), mission qui répond à un besoin ou cherche une casquette du membre, mission à distance ou dans un pays du membre, événement dans un pays du membre, langue commune.
- Chaque règle ajoute son poids et une raison (clé du namespace i18n `discovery` et paramètres) ; une suggestion exige 20 points ; la phrase principale assemble les deux raisons les plus lourdes (`sentences.one` ou `.two`, `suggestionSentenceText` de `@pitchorium/i18n`).
- Listes : `people` (« Personnes pertinentes pour vous »), `complementary_entrepreneurs`, `projects` (pour le volet contributeur), `missions`, `events`, et les contributeurs potentiels d'un projet, lus par son équipe.
- Exclusions : soi-même, ses propres projets, missions et événements, les volets aux détails privés (sauf pour leur titulaire), les membres connectés, les blocages, les candidats écartés (« pas intéressé », conservé) et ceux qui ne sont plus indexés.
- Précalcul (file `discovery.matching`, worker) : un changement de profil recalcule les listes du membre (`member`) ; un changement d'un candidat met à jour sa seule ligne dans les listes des membres qu'il concerne (`candidate`, 2 000 sujets au plus) ; un projet recalcule ses contributeurs potentiels (`project`). Les candidats sont générés par filtres indexés (GIN), 500 au plus par liste, avant le calcul du score ; 50 suggestions gardées par liste.

## Page Découvrir et fil

- Sections paginées (grilles larges) : projets récents, fin de campagne proche, profils suggérés (membres, avec leur phrase de raison), sélection éditoriale (projets mis en avant), événements à venir, missions ouvertes.
- Fil : discovery enregistre auprès de content la source des éléments `suggestion` qui ferment un fil trop maigre (meilleures suggestions des listes, alternées).

## Routes

- `GET /v1/discovery/search` (`discovery.search`), `GET /v1/public/discovery/search` (public, `Cache-Control: public, max-age=60`)
- `GET /v1/discovery/autocomplete` (`discovery.search`), `GET /v1/public/discovery/autocomplete` (public)
- `GET /v1/discovery/suggestions?list=` (`discovery.suggestions.read`)
- `POST /v1/discovery/dismissals` (« pas intéressé »), `DELETE /v1/discovery/dismissals/{kind}/{key}` (`discovery.suggestions.dismiss`)
- `GET /v1/projects/{projectId}/suggested-contributors` (`discovery.project-suggestions.read`, équipe du projet)
- `GET /v1/discovery/page`, `GET /v1/discovery/sections/{section}` (`discovery.page.read`), `GET /v1/public/discovery/page`, `GET /v1/public/discovery/sections/{section}` (public, sans profils suggérés)

## Schéma `discovery`

`search_documents` (clé : type, entité, audience ; index GIN du texte, trigrammes du nom, étiquettes, pays, secteurs ; index des sections), `match_profiles` (attributs de matching d'un membre, index GIN des casquettes, besoins, secteurs, pays), `suggestions` (clé : sujet, liste, candidat ; index du classement et des candidats), `dismissals`.

## Façade publique (`index.ts`)

`DiscoveryFacade` (`newSuggestionCounts`, pour la notification quotidienne des nouvelles suggestions), `IndexMaintenanceService` (commande `discovery:reindex`), type `DriftReport`, classes d'événements.

## Événements émis

| Type                                | Agrégat | Payload                                 |
| ----------------------------------- | ------- | --------------------------------------- |
| `discovery.suggestion.dismissed.v1` | membre  | `candidateKind`, `candidateId`          |
| `discovery.index.drift-detected.v1` | index   | `missing`, `stale`, `orphaned`, `kinds` |

## Événements consommés (handler `discovery.index`)

- profiles : `profiles.profile.created|updated|entrepreneur-facet-updated|contributor-facet-updated|handle-changed|visibility-changed.v1`
- organizations : `organizations.organization.created|updated|deleted.v1`, `organizations.verification.approved|revoked.v1`
- projects : `projects.project.published|updated|funded|closed|deleted.v1`
- events : `events.event.published|updated|canceled|completed.v1`
- missions : `missions.mission.published|updated|closed.v1`

## Tâches (file `discovery.matching`, worker)

`member`, `project`, `candidate` (après un événement), `check-drift` (chaque jour à 03:50 UTC).

## Dépendances

profiles, organizations, projects, events, missions (sources de l'index et images des cartes), network (connexions et blocages), content (source des suggestions du fil), identity (par le garde d'access).
