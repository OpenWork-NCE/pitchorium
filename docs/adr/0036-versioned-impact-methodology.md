# 0036. Méthodologie d'impact versionnée

Statut : acceptée (2026-10-08)

## Contexte

Le score d'impact auto-déclaré repose sur 12 critères et trois paliers (§2.1, §12), mais le cahier des charges ne fournit ni les critères, ni leurs échelles, ni leurs pondérations (questions ouvertes 1 à 3). Les critères changeront : une évaluation faite selon une version ne doit pas devenir fausse quand la méthodologie évolue, et rien ne doit être inventé en attendant.

## Décision

- Une méthodologie est une suite de versions numérotées (`impact.methodologies`) : nom, critères (clé, clés de traduction du libellé et de la description dans le namespace `reference`, échelle de réponse ordonnée avec une valeur entière par niveau, pondération entière). Les libellés sont traduits, jamais stockés.
- Cycle de vie réservé aux `admin` avec double authentification (`impact.methodology.manage`) : brouillon modifiable et supprimable, publication, archivage. Une version publiée ou archivée est immuable (`IMPACT_METHODOLOGY_NOT_DRAFT`). Une seule version est publiée à la fois (index unique partiel) : publier archive la précédente. Chaque étape est écrite au journal d'audit ; la publication émet `impact.methodology.published.v1`.
- Une évaluation (`impact.assessments`, en ajout seul) porte sur un sujet, le volet entrepreneur d'un membre ou un projet, et référence la version utilisée. Les réponses doivent viser la version publiée au moment de l'envoi (`IMPACT_METHODOLOGY_OUTDATED` sinon) et répondre à chaque critère par un niveau de son échelle. La dernière évaluation est la courante ; les précédentes forment l'historique consultable par le propriétaire. Première évaluation : `impact.assessment.submitted.v1` ; suivantes : `impact.assessment.updated.v1`.
- Score calculé dans `domain/` : moyenne pondérée des réponses rapportées au maximum de leur échelle, sur 100, arrondie au plus proche (demi vers le haut), en fractions exactes (`bigint`), donc indépendante de l'ordre des critères. Niveaux : `emerging` (moins de 40), `moderate` (40 à 69), `strong` (70 et plus), déduits des filtres 40+ et 70+ du §12 (à valider, question ouverte 3).
- Une nouvelle version n'invalide rien : une évaluation garde sa version, l'affiche, et signale `reassessmentSuggested`. Toute réponse qui expose un score porte `selfDeclared: true`, la version de la méthodologie et le détail par critère ; aucune notion de certification.
- Sans version publiée : les routes d'évaluation répondent `IMPACT_METHODOLOGY_UNAVAILABLE` (409), les scores ne sont pas affichés et les filtres d'impact de la vitrine sont ignorés. Aucune méthodologie réelle n'est livrée.
- Méthodologie de démonstration : `MethodologiesService.ensureDemo`, appelée seulement par `pnpm db:seed:dev`, crée et publie une version `demo: true` nommée « DEMO, non contractuelle » ; aucune route ne peut créer de version `demo`, et sa création comme sa publication sont refusées en production (`IMPACT_DEMO_REFUSED`).

## Conséquences

- Les critères réels s'ajoutent sans migration ni déploiement : un administrateur crée la version, les traductions de ses clés sont ajoutées au namespace `reference`, puis il publie.
- Archiver la version publiée sans la remplacer suspend toutes les évaluations et masque les scores : c'est un retrait volontaire.
- Le projet garde une copie de son score courant (module projects) pour filtrer la vitrine sans lire les tables d'impact.
