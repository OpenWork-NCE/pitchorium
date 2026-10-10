# 0143. Doublure locale de Turnstile au niveau 2

Statut : acceptée (2026-10-10).

## Contexte

Les parcours critiques du niveau 2 (ADR 0123, 0127) passaient par Cloudflare : le widget des clés de test dans la page, siteverify appelé par l'api, et le test d'intégration de Turnstile appelait le vrai siteverify. Une panne ou une lenteur de Cloudflare pouvait donc bloquer une poussée sans rien dire de Pitchorium.

## Décision

- L'api accepte, hors production seulement, deux adresses d'une doublure au même contrat : `TURNSTILE_VERIFY_URL` (siteverify, utilisé par le vérificateur de l'api et par le plugin captcha de Better Auth) et `TURNSTILE_SCRIPT_URL` (script du widget, publié dans `GET /v1/auth-configuration` comme `turnstile.scriptUrl`, `null` sinon). La configuration refuse l'une ou l'autre en production.
- Le web charge `scriptUrl` quand l'api le donne, sinon le script de Cloudflare. Le script local est chargé par le nôtre (`strict-dynamic`) : la CSP ne change pas, aucun cadre n'est créé.
- La doublure (`apps/server/test/turnstile/local-turnstile.ts`) est servie par les faux fournisseurs : `window.turnstile.render/reset/remove` avec les mêmes rappels, et siteverify (`{ success, error-codes }`), avec le comportement des clés de test officielles (`1x` réussit, `2x` échoue, jeton `XXXX.DUMMY.TOKEN.XXXX`).
- Niveau 2 : `LIVE_TURNSTILE=local` et `--grep-invert @external`. La fixture `noCloudflare` fait échouer tout parcours dont une page demande `challenges.cloudflare.com` ; un parcours `@critical` vérifie que l'inscription passe par le siteverify local (compteur). Le test d'intégration utilise le même siteverify local.
- Niveau 3 : les parcours `@external` gardent le vrai widget et les clés de test de Cloudflare (job `live-external`).

## Conséquences

- Le niveau 2 ne dépend plus de Cloudflare ; le vrai widget, la CSP réelle de son cadre et le vrai siteverify restent vérifiés chaque nuit.
- Le contrat de la doublure suit celui de Cloudflare à la main : un changement de l'api de Cloudflare se voit au niveau 3.
