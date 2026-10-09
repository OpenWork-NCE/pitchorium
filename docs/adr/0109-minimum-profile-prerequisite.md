# 0109. Profil minimum, prérequis défini par l'api

Statut : acceptée (2026-10-09). Ferme la question ouverte 108. Complète les ADR 0015 et 0105.

## Contexte

Une demande de connexion ou un premier message hors réseau arrive chez un membre qui ne connaît pas l'expéditeur : sans nom, titre ni pays, il ne sait pas qui l'aborde. Le §7.2 (étape 3) nomme ce « profil minimum » (photo, nom, titre, pays), sautable à l'inscription ; le cahier des charges ne dit pas s'il est exigé avant une action. Le mécanisme de complétion du web (ADR 0105) n'ouvre que les éléments que l'api renvoie dans `missing` : une règle de prérequis écrite dans le navigateur contredirait l'api, seule autorité (ADR 0015, ADR 0083).

## Décision

- Nouvel élément `profile.minimum` (contrats, `PREREQUISITE_ELEMENTS`) : nom affiché, titre et pays de résidence renseignés. La photo n'en fait pas partie : elle encourage, elle n'est pas nécessaire pour savoir qui écrit.
- Fourni par le module profiles (`ProfilePrerequisitesProvider`, règle `hasMinimumProfile` du domaine) et exigé par la politique d'access de `network.connection.request`, avec l'email vérifié : les deux manques sont dits ensemble.
- Le premier message hors réseau, décidé par le module messaging selon le degré de relation, l'exige aussi : `ACCESS_PREREQUISITES_MISSING` avec `missing` (`email_verified`, `profile.minimum`), par `ProfilesFacade.hasMinimumProfile`.
- Le web n'écrit aucune règle de prérequis : il affiche ce que l'api renvoie (`useWithPrerequisites`), ici le formulaire du profil minimum (nom, titre, pays), et lit les autres exigences (double authentification d'un rôle privilégié) par `GET /v1/me/prerequisites/{action}`.
- Règle provisoire, à confirmer (`docs/open-questions.md`).

## Conséquences

- Suivre un membre reste libre : seul ce qui sollicite l'autre membre exige d'être identifiable.
- Un membre qui a sauté l'étape du profil le complète au moment où il se connecte à quelqu'un, puis sa demande part (§7.2, étape 4).
- Tests : `access-policy.spec.ts`, `messaging-rules.spec.ts`, `profile-rules.spec.ts`, les suites d'intégration (les membres qui sollicitent un autre complètent leur profil minimum) et le scénario social de bout en bout.
