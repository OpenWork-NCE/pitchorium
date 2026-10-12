# 0173. Libellés d'une méthodologie d'impact écrits par les administrateurs

Statut : acceptée (2026-10-12). Complète l'ADR 0036.

## Contexte

L'ADR 0036 rangeait les libellés d'une méthodologie dans le catalogue `reference` de `@pitchorium/i18n`, par clés (`labelKey`, `descriptionKey`) : traduits, jamais stockés. Une méthodologie réelle (questions ouvertes 1 à 3) ne pouvait donc paraître qu'après une modification du dépôt et un déploiement, et la console d'administration du FRONT 9A doit permettre de la rédiger, avec ses libellés dans chaque langue active.

## Décision

- Chaque critère porte, en plus de ses clés, des libellés et des descriptions écrits par un administrateur dans chaque langue de l'interface (`labels`, `descriptions`), et chaque niveau de son échelle des libellés (`labels`). Ils sont lus avant la clé du catalogue ; une clé sans libellé stocké reste servie par le catalogue (la méthodologie de démonstration).
- Une version n'est publiée que si chaque langue active a, pour chaque critère, sa description et chaque niveau, un libellé stocké ou présent dans le catalogue (`IMPACT_LABELS_MISSING`, avec les langues manquantes). Les vues d'administration en donnent la couverture (`labelCoverage`), pour que la console montre ce qui manque avant la publication. Une langue activée plus tard sans libellés ne change pas une version publiée, immuable : la page affiche alors la clé, jusqu'à une nouvelle version.
- L'aperçu du calcul (`POST /v1/admin/impact/methodologies/{id}/preview`) applique les règles d'une évaluation à des réponses d'essai.
- Les libellés stockés voyagent avec la version (colonne `criteria`, JSON) et avec le détail de chaque évaluation (`labels`, `descriptions`, `answerLabels`) : une évaluation garde le texte de sa version.

## Conséquences

- Le web lit le libellé stocké de la langue de la page, puis la clé du catalogue, puis la clé elle-même (`labelOf`, `features/impact/lib/labels.ts`).
- Les libellés d'une méthodologie ne passent pas par la relecture humaine des catalogues (`docs/architecture/i18n-workflow.md`) : leur exactitude est de la responsabilité de l'administrateur qui publie (question ouverte 144).
