# 0083. Flux de données du web

Statut : acceptée (2026-10-08).

## Contexte

L'api NestJS porte toutes les règles métier et vérifie l'origine des écritures par cookie (ADR 0021). Le web doit rendre les pages publiques côté serveur (SEO, premier affichage) et rester réactif dans l'espace membre, sans dupliquer de règle.

## Décision

- Premier rendu par les Server Components : ils appellent l'api avec le client Orval, configuré côté serveur (`lib/api/server.ts`) avec l'origine interne (`API_INTERNAL_URL`) et les seuls en-têtes utiles de la requête entrante (cookie de session, `Accept-Language`).
- Navigateur : TanStack Query 5 (`QueryClient` documenté dans `lib/query/query-client.ts` : données fraîches une minute, pas de relecture au focus, pas de nouvel essai sur une erreur 4xx ni sur une mutation), données préchargées par le serveur puis hydratées (`HydrationBoundary`). Le fournisseur n'est monté que dans les groupes qui lisent l'api depuis le navigateur.
- Instance fetch du navigateur (`lib/api/browser.ts`) : cookies (`credentials: include`), `Accept-Language`, une `Idempotency-Key` par POST sauf clé fournie par l'appelant pour son intention ; erreurs RFC 9457 typées (`ApiProblemError` avec code et `X-Request-Id`), vérifiées sans bibliothèque de validation. `X-Time-Zone` part avec chaque appel de Better Auth (inscription).
- Pas de Server Actions pour les mutations métier : toute écriture passe par l'api, depuis le navigateur, avec le contrôle d'origine et l'idempotence de l'api.
- Authentification : client `better-auth/react` sur `<NEXT_PUBLIC_API_URL>/v1/auth`, membre courant par `GET /v1/me` (lu une fois par requête).
- Temps réel : `socket.io-client` sur le namespace `/`, monté par l'espace membre ; un événement invalide les requêtes concernées (seuls les compteurs sont écrits tels quels), les charges utiles sont validées par les schémas de `@pitchorium/contracts`.
- État d'URL (filtres, onglets, recherche) : `nuqs`, monté par les groupes qui l'utilisent.
- Langues actives : route publique `GET /v1/locales` (module identity), cache d'une minute.

## Conséquences

- Le client Orval est un singleton par graphe de modules : le serveur et le navigateur le configurent chacun de leur côté, jamais l'un pour l'autre.
- `@pitchorium/contracts`, `@pitchorium/api-client` et `@pitchorium/i18n` déclarent `sideEffects: false` ; les constantes de langue vivent hors des schémas Zod (`locales.ts`) pour que les pages publiques n'embarquent pas Zod.
