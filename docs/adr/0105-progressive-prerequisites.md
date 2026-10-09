# 0105. Complétion au fil de l'eau des prérequis

Statut : acceptée (2026-10-09). Complète l'ADR 0015 (refus `ACCESS_PREREQUISITES_MISSING`) côté web.

## Contexte

Le §7.2 (étape 4) ouvre les blocs métier au moment où ils servent. L'api refuse une action en listant les éléments manquants (`missing`) ; l'interface ne doit pas finir dans une impasse ni dupliquer les règles.

## Décision

- `PrerequisiteGateProvider` (feature `access`, monté par la coquille membre) et `useWithPrerequisites()` : une action refusée pour des éléments manquants ouvre le formulaire de chacun, dans l'ordre de l'api, dans un `Dialog` (feuille tirée du bas sur un téléphone) ; une fois tous complétés, l'action est rejouée. « Plus tard », ou un élément sans formulaire, rend le refus à l'appelant, qui l'affiche comme toute erreur.
- Les formulaires sont fournis par élément (`PrerequisiteForms`) : la feature `identity` livre `email_verified` (renvoi du lien, puis nouvelle lecture du compte), `legal_acceptance` (le formulaire de l'onboarding) et `two_factor` (vers la sécurité). Les volets entrepreneur et contributeur s'y ajouteront au PROMPT FRONT 3, le compte de versement et le KYC au FRONT 5B.
- Le dialogue et les formulaires se chargent au premier refus seulement.
- Branché sur la nouvelle lecture du fil et sur les réactions ; toute nouvelle écriture passe par `useWithPrerequisites`.

## Conséquences

- Un élément « profil minimum » n'existe pas dans l'api : il n'est pas exigé, donc pas branché (question 108).
- Tests : `prerequisite-gate.spec.tsx` (ordre, rejeu, abandon, élément sans formulaire) et le parcours réel `e2e-live/auth.spec.ts`.
