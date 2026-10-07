# 0020. Format d'erreur des routes d'authentification

Statut : acceptée (2026-10-07)

## Contexte

Toutes les routes de l'api répondent en RFC 9457 avec un `code` du registre (`packages/contracts/src/errors/error-codes.ts`), traduit par le frontend. Les routes `/v1/auth/*` sont servies par Better Auth hors de NestJS (ADR 0013) : elles n'ont ni le filtre d'erreurs, ni la validation Zod, ni la génération OpenAPI de Nest.

## Décision

- `/v1/auth` garde le format natif de Better Auth : statut HTTP et corps `{ code, message }`. Les erreurs des redirections (rappel OAuth, lien magique, vérification d'email) arrivent dans le paramètre `error` de l'URL de retour, en majuscules (codes Better Auth) ou en minuscules (codes du rappel OAuth, par exemple `account_not_linked`). Le `message` est technique et en anglais : il n'est jamais affiché.
- Réécrire ces réponses en RFC 9457 obligerait à interpréter chaque réponse de Better Auth (dont les redirections) : coût et risque de régression à chaque version, sans gain pour l'utilisateur.
- Correspondance pour la traduction (`packages/contracts/src/auth-errors.ts`) : `authErrorTranslationKey(code, status)` donne la clé du namespace i18n `errors` :
  - un code du registre (`ACCESS_ORIGIN_NOT_ALLOWED`, `INTERNAL_ERROR`, émis par le handler de Pitchorium) garde sa clé ;
  - un code connu de `AUTH_ERROR_CODES` (codes Better Auth des routes utilisées, codes ajoutés par Pitchorium comme `PASSWORD_COMPROMISED`, codes de redirection mis en majuscules) a la clé `auth.<CODE>` ;
  - tout autre code retombe sur un code du registre selon le statut HTTP (`authErrorFallback` : 401 `UNAUTHENTICATED`, 429 `RATE_LIMITED`, 5xx `INTERNAL_ERROR`, etc.). La limite de débit de Better Auth répond 429 sans code.
- `pnpm i18n:check` exige une traduction française de chaque code de `AUTH_ERROR_CODES` ; un test unitaire du serveur vérifie que chaque code Better Auth listé existe dans Better Auth (`BASE_ERROR_CODES`, plugin two-factor).
- Les routes `/v1/auth` ne figurent pas dans l'OpenAPI ni dans le client Orval : le frontend utilise le client officiel de Better Auth, typé par la configuration du serveur.

## Conséquences

- Le frontend a deux chemins de traduction d'erreur, unifiés par `authErrorTranslationKey`.
- Une montée de version de Better Auth qui renomme un code fait échouer le test unitaire ; un nouveau code non listé s'affiche avec le message générique de son statut jusqu'à son ajout.
- Les codes de redirection en minuscules ne sont pas exportés par Better Auth : leur liste est tenue à la main et vérifiée par les tests d'intégration identity pour les cas couverts.
