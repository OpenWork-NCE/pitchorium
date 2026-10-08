# Référence de l'api

- `index.html` : référence interactive (Scalar 1.71.0) du document `apps/server/openapi/openapi.json`, servie en local par `pnpm docs:api` (http://127.0.0.1:3300/). Le document est généré par `pnpm openapi:generate` et vérifié à chaque CI (identique au code).
- Chaque opération porte un résumé, une description de ses règles d'accès (action, rôles, prérequis, session récente, idempotence), la liste `x-error-codes` des codes stables qu'elle peut renvoyer (codes communs et codes de son module) et un exemple de problème RFC 9457 par code commun (`components.examples`). `x-access` donne l'action ou `public`.
- Client typé : `@pitchorium/api-client` (Orval) ; passation au frontend : `docs/frontend-handoff.md`.

## Versionnement et dépréciation

- Version majeure dans le chemin : `/v1`. Une rupture (champ retiré ou renommé, type changé, sémantique changée, code d'erreur retiré, validation plus stricte d'une entrée existante) ouvre `/v2` pour les routes concernées ; `/v1` reste servi pendant au moins six mois après l'annonce.
- Sans rupture, dans `/v1` : nouvelles routes, nouveaux champs de réponse, nouveaux champs facultatifs d'entrée, nouvelles valeurs d'énumération annoncées (le client doit tolérer une valeur inconnue), nouveaux codes d'erreur.
- Dépréciation d'une opération : `deprecated: true` dans OpenAPI, en-têtes `Deprecation` (RFC 9745) et `Sunset` (RFC 8594) avec la date de retrait, entrée dans `CHANGELOG.md`.
- Les codes d'erreur sont stables : un code publié n'est ni renommé ni réutilisé pour un autre sens.
- Les événements de domaine suivent la même règle avec leur suffixe de version (`.v1`, `docs/architecture/conventions.md`).
