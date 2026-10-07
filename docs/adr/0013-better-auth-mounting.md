# 0013. Montage de Better Auth

Statut : acceptée (2026-10-07)

## Contexte

L'authentification (email et mot de passe, lien magique, Google, LinkedIn, Microsoft, 2FA, sessions) repose sur Better Auth 1.7.7. Sa documentation demande de monter son handler avant tout body parser (Express) ; l'intégration NestJS communautaire (`@thallesp/nestjs-better-auth`) impose `bodyParser: false` et son propre garde global. Les écritures de Better Auth doivent en outre être atomiques avec les événements de l'outbox (ADR 0006).

## Décision

- Le handler est monté sur `/v1/auth` par un point d'extension de la plateforme (`@RawHttpHandler`, `mountRawHttpHandlers`) appelé par `configureHttpApp` avant `useBodyParser` : Better Auth lit le flux brut, les autres routes gardent le parseur JSON de Nest. Pas de dépendance à l'intégration communautaire : le garde global est celui du module access (ADR 0015).
- Conversion Node vers `Request` web par `better-call/node` (dépendance directe, même version que Better Auth).
- L'adaptateur Drizzle de Better Auth reçoit un proxy qui délègue à la transaction courante du `TransactionManager`. Chaque écriture de Better Auth est validée avec son événement identity dans une transaction courte (ADR 0019, qui remplace la transaction par requête initialement retenue ici).
- Les emails sont envoyés après la réponse (état de requête en AsyncLocalStorage) : jamais pour une écriture annulée, et sans écart de temps de réponse qui révélerait l'existence d'un compte.
- Toute écriture sur `/v1/auth` exige une origine de confiance (Better Auth ne la vérifie pas sur tous les endpoints, `sign-out` par exemple). L'adresse du client utilisée par le rate limiting est celle résolue par Express (`TRUST_PROXY_HOPS`), transmise dans un en-tête interne ; les en-têtes `X-Forwarded-For` bruts sont ignorés.
- Rate limiting de Better Auth stocké dans Redis (script Lua atomique) ; limite stricte (`AUTH_RATE_LIMIT_*`) sur la connexion, l'inscription, le lien magique, la réinitialisation, l'envoi de vérification et la vérification TOTP.

## Conséquences

- Les routes `/v1/auth` gardent le format d'erreur de Better Auth (`{ code, message }`) et ne figurent pas dans l'OpenAPI : le frontend utilise le client Better Auth pour elles ; la traduction de ces codes suit l'ADR 0020, le contrôle d'origine l'ADR 0021.
- Elles ne passent ni par les guards, ni par les filtres, ni par le logger HTTP de Nest : le handler journalise lui-même et pose `X-Request-Id`.
- Une requête d'authentification n'emprunte une connexion que le temps de chaque écriture, jamais pendant un appel réseau (ADR 0019).
