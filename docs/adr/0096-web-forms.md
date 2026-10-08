# 0096. Système de formulaires du web

Statut : acceptée (2026-10-08).

## Contexte

L'api valide chaque écriture avec les schémas Zod de `@pitchorium/contracts` et renvoie ses erreurs en RFC 9457 : un code stable par problème, et pour une validation la liste des champs fautifs (`errors[].pointer` en JSON Pointer et le code Zod de l'erreur). Le web doit valider tôt sans dupliquer les règles, dire chaque erreur sous son champ, dans la langue de la personne, et ne jamais montrer un message technique.

## Décision

- react-hook-form 7.89.0 et `@hookform/resolvers` 5.9.1 sur les schémas des contrats (`useZodForm`) : le navigateur valide avec le même schéma que l'api, qui reste juge.
- Messages : la carte d'erreurs de Zod est remplacée à la validation par `issueMessage` (`lib/forms/issues.ts`), qui traduit le code et ses bornes depuis `web.forms.issues` ; une erreur de l'api, qui n'a que le code, prend le message générique de ce code (`serverIssueMessage`).
- `useApplyProblem` : les erreurs de champ du problème vont sous leur champ (`pointerToPath`), le premier prend le focus ; tout autre problème devient l'erreur du formulaire, traduite depuis `errors.<code>`, avec la référence de la requête.
- Système `Field` : libellé, description, erreur et compteur liés au contrôle (`aria-describedby`, `aria-invalid`, `aria-required`) ; chaque contrôle du design system lit son `Field`. `Form` désactive les bulles natives, annonce un résumé des erreurs et laisse react-hook-form focaliser le premier champ invalide.
- Montants en unités mineures (`MoneyInput`, sans flottant), dates en instant avec le fuseau nommé (`DateTimeInput`, remplacé par `DateTimeField`, ADR 0100).

## Conséquences

- Une nouvelle règle de validation s'écrit dans les contrats ; le formulaire la reçoit sans code de plus, et son message vient du code Zod.
- Une valeur facultative vide est transmise comme absente (`patterns.md`).
- Les catalogues n'ont pas de pluriel ICU (paramètres `{{nom}}`, ADR 0084) : les nombres variables ont deux clés, `one` et `other`, choisies par `Intl.PluralRules` (`usePlural`).
