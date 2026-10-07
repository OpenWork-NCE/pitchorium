# Module impact

Score d'impact auto-déclaré (cahier des charges §2.1, §12) : méthodologie versionnée, évaluations du volet entrepreneur d'un membre ou d'un projet, niveaux émergent, modéré et fort, mention auto-déclarée et détail par critère ; aucune certification (ADR 0036). Les critères réels ne sont pas fournis (questions ouvertes 1 à 3) : aucune méthodologie réelle n'est livrée.

## Méthodologie (ADR 0036)

- Version numérotée : nom, critères (clé, `labelKey` et `descriptionKey` dans le namespace i18n `reference`, échelle de 2 à 10 niveaux avec une valeur entière de 0 à 100, pondération de 1 à 100), 30 critères au plus.
- Cycle de vie par les `admin` (double authentification) : brouillon (modifiable, supprimable), publication (la version publiée précédente est archivée), archivage. Une version publiée ou archivée est immuable. Chaque étape est auditée (`impact.methodology-drafted`, `-updated`, `-deleted`, `-published`, `-archived`).
- Méthodologie de démonstration (`demo: true`, « DEMO, non contractuelle ») : créée et publiée seulement par `pnpm db:seed:dev` (`MethodologiesService.ensureDemo`), refusée en production ; ses libellés sont dans `reference.impactDemo`.

## Évaluations

- Sujet : `entrepreneur_facet` (identifiant du membre) ou `project` (identifiant du projet, par la façade, module projects).
- Réponse à chaque critère par une clé de niveau, pour la version publiée (`IMPACT_METHODOLOGY_OUTDATED` sinon) ; `IMPACT_ANSWERS_INVALID` pour une réponse manquante, inconnue ou en trop.
- Score de 0 à 100 (`domain/scoring.ts`) : moyenne pondérée des valeurs rapportées au maximum de chaque échelle, arrondie demi vers le haut, en fractions exactes. Niveaux : `emerging` < 40, `moderate` de 40 à 69, `strong` ≥ 70 (seuils à valider).
- Historique conservé (une ligne par envoi) ; la plus récente est l'évaluation courante. Une évaluation faite selon une version remplacée garde sa version et propose une réévaluation (`reassessmentSuggested`).
- Toute vue porte `selfDeclared: true`, la version (`methodology`) et le détail par critère (`details`) pour l'affichage cliquable.
- Sans version publiée : `IMPACT_METHODOLOGY_UNAVAILABLE` (409) sur les routes d'évaluation, aucun score affiché par la façade (`current` renvoie `null`).

## Routes

- `GET /v1/impact/methodology` (public, `Cache-Control: public, max-age=60`) : version publiée et ses critères.
- `GET|POST /v1/admin/impact/methodologies`, `GET|PUT|DELETE /v1/admin/impact/methodologies/{methodologyId}`, `POST /v1/admin/impact/methodologies/{methodologyId}/publish`, `POST /v1/admin/impact/methodologies/{methodologyId}/archive` (`impact.methodology.manage` ; `Idempotency-Key` sur `POST` de création).
- `GET /v1/me/impact/assessments` (`impact.assessment.read`) : historique du volet entrepreneur, le plus récent d'abord.
- `POST /v1/me/impact/assessments` (`impact.assessment.submit`, volet entrepreneur exigé, `Idempotency-Key`).
- Les évaluations d'un projet passent par les routes du module projects.

## Schéma `impact`

`methodologies` (version unique, une seule publiée par index unique partiel), `assessments` (en ajout seul, index par sujet et date).

## Façade publique (`index.ts`)

`ImpactFacade` : `publishedMethodology`, `submit` (rejoint la transaction de l'appelant), `current`, `history`, `prefill` (réponses d'un sujet encore valables pour la version publiée) ; types `ImpactSubject`, `ImpactSubmission` ; classes d'événements.

## Événements émis

| Type                              | Agrégat    | Payload                                                                                                      |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `impact.methodology.published.v1` | version    | `version`, `demo`, `replacedVersion`                                                                         |
| `impact.assessment.submitted.v1`  | évaluation | `subjectType`, `subjectId`, `methodologyId`, `methodologyVersion`, `score`, `level`, `source`, `submittedBy` |
| `impact.assessment.updated.v1`    | évaluation | idem, pour un sujet déjà évalué                                                                              |

## Événements consommés

Aucun.

## Dépendances

Aucun module métier. Le prérequis `profile.entrepreneur_facet` des routes `/v1/me/impact` est appliqué par le module access.
