# Conventions

## Langues

Code, identifiants, commentaires et messages de commit en anglais. Documentation en français.

## Nommage

| Élément                 | Convention                                                   | Exemple                                           |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Fichiers                | kebab-case, suffixe de rôle                                  | `outbox-relay.service.ts`, `health.controller.ts` |
| Classes, types          | PascalCase                                                   | `TransactionManager`, `ProblemDetails`            |
| Variables, fonctions    | camelCase                                                    | `relayBatch`                                      |
| Constantes globales     | SCREAMING_SNAKE_CASE                                         | `QUEUE_NAMES`                                     |
| Tables, colonnes, index | snake_case, index suffixés `_idx`, `_uq`, `_pk`              | `outbox_events_pending_idx`                       |
| Schémas PostgreSQL      | nom du module                                                | `projects`                                        |
| Routes HTTP             | kebab-case, pluriel, sous `/v1`                              | `/v1/health/ready`                                |
| Codes d'erreur          | SCREAMING_SNAKE_CASE, préfixés par le module hors plateforme | `PROJECTS_CAMPAIGN_CLOSED`                        |
| Événements              | `<module>.<agrégat>.<fait au passé>.v<version>`              | `projects.campaign.published.v1`                  |
| Files BullMQ            | `<module ou platform>.<usage>`                               | `platform.domain-events`                          |
| Feature flags           | `<domaine>.<sujet>`                                          | `locale.sw`, `funding.equity`                     |

## Structure d'un module

```text
src/modules/<module>/
  domain/          entités, value objects, événements, erreurs ; TypeScript pur
  application/     use cases et ports (classes abstraites) ; orchestre transactions, outbox, audit
  infrastructure/  adaptateurs : repositories Drizzle, clients externes
  interface/       contrôleurs HTTP, gateways WebSocket, processors de jobs, handlers d'événements
  <module>.module.ts
  index.ts         façade publique : seul fichier importable par les autres modules
  README.md
```

Un module dont les providers diffèrent selon le processus (contrôleurs et Better Auth côté api, handlers d'événements côté worker) expose `forApi()` et `forWorker()` ; `src/business-modules.ts` assemble les listes de chaque processus. Les modules dont d'autres injectent la façade (identity, access) sont globaux pour Nest ; les imports restent limités à `index.ts`.

Les tables sont déclarées dans `packages/db/src/schemas/<module>.ts` avec le `pgSchema` du module. Les ports sont des classes abstraites, utilisables directement comme jetons d'injection Nest. Un module ne lit jamais les tables d'un autre : il appelle sa façade ou réagit à ses événements.

## Authentification, acteur et actions

- Better Auth sert `/v1/auth/*` (ADR 0013) ; le frontend utilise son client pour ces routes. La session est un cookie `HttpOnly` (`pitchorium.session_token`).
- Refus par défaut (ADR 0015) : toute route non marquée `@Public()` exige une session et déclare son action avec `@RequireAction('<action>', { resource })`. Une route protégée sans action est refusée.
- Une action est déclarée dans `ACTIONS` (`packages/contracts/src/access.ts`) et sa politique dans `ACTION_POLICIES` (`modules/access/domain/action-policies.ts`), avec sa ligne dans la matrice de `access-policy.spec.ts`. Nommage : `<domaine>.<objet>.<verbe>` ou `<domaine>.<verbe>`, par exemple `profile.update`, `project.publish`.
- `resource` est une classe `ResourceResolver` (provider du module) qui charge la ressource ciblée ; `null` répond 404. Par défaut, la ressource est le compte de l'acteur (routes `/v1/me/...`).
- Dans un contrôleur : `@CurrentPrincipal()` (`userId`, `sessionId`, tous modules) ou `@CurrentActor()` (rôles et faits de confiance, module access). L'idempotence est cloisonnée par principal.
- Écritures authentifiées par cookie : l'en-tête `Origin` (à défaut `Referer`) doit appartenir aux origines de confiance, sinon `ACCESS_ORIGIN_NOT_ALLOWED`.

## Prérequis

Une action refusée faute d'éléments complétés répond `403 ACCESS_PREREQUISITES_MISSING` avec `missing`, la liste complète des éléments (`legal_acceptance`, `email_verified`, `kyc_verified`, `two_factor`, `profile.entrepreneur_facet`, `profile.contributor_facet`, `payout_account`). `GET /v1/me/prerequisites/{action}` donne la même liste sans tenter l'action ; pour une action réservée à un rôle porté sur une ressource, elle répond pour un membre qui détient ce rôle. Un module qui possède des éléments les fournit au module access par un `PrerequisiteProvider` enregistré au démarrage.

## Erreurs et codes

- Toute réponse d'erreur suit RFC 9457 (`application/problem+json`) : `type` (`urn:pitchorium:problem:<code>`), `title`, `status`, `code`, `instance`, `requestId`, `detail` et `errors` selon le cas.
- Exception : `/v1/auth` répond au format de Better Auth `{ code, message }` ; `authErrorTranslationKey` (`packages/contracts/src/auth-errors.ts`) donne la clé de traduction de ces codes (ADR 0020).
- Les codes sont déclarés dans `packages/contracts/src/errors/error-codes.ts` avec leur statut HTTP et un titre technique anglais. Chaque nouveau code reçoit une traduction FR et EN dans `packages/i18n/src/locales/*/errors.json` (vérifié par `pnpm i18n:check`).
- Un échec métier attendu lève une `DomainError(code, message)`. Seul ce message est exposé dans `detail` ; toute autre erreur devient `INTERNAL_ERROR` sans détail, journalisée et envoyée à Sentry.
- Les erreurs de validation listent `errors: [{ pointer, code }]`, où `pointer` est un JSON Pointer et `code` le code d'issue Zod.
- Seul membre d'extension exposé depuis `DomainError.details` : `missing` (prérequis).

## Argent

- Montant en unités mineures, entier, avec une devise ISO 4217 : `bigint` + colonne `currency` en base, `Money` dans le code, `{ amountMinor: string, currency }` dans l'API.
- L'exposant de chaque devise vient de la liste ISO 4217 (`platform/kernel/currency.ts`) : EUR, USD, GBP, KES, NGN, GHS 2 décimales ; XOF, XAF, RWF, UGX 0 ; KWD 3. Un code hors de la liste est refusé. `Money.fromDecimal` refuse plus de décimales que l'exposant au lieu d'arrondir ; `toDecimal` écrit le montant en unités majeures avec exactement l'exposant (`12.50`, `5000`).
- Jamais de flottant, ni en base, ni en calcul, ni en JSON.
- Répartitions (commission, versement) avec `Money.allocate`, qui ne perd aucune unité. Le sens d'arrondi d'une commission reste une décision métier.
- Les mouvements financiers seront enregistrés dans un ledger en écritures immuables (voir ADR 0007).

## Identifiants

UUIDv7 générés par l'application via le port `IdGenerator`, jamais par la base. Le type de colonne est `uuid`.

## Dates

`timestamptz` en base, `Date` en mémoire, ISO 8601 UTC dans l'API. Toute lecture de l'heure passe par le port `Clock`.

## Pagination

Par curseur : requête `?cursor=&limit=` (`cursorPageQuerySchema`, limite 1 à 100, 20 par défaut), réponse `{ items, nextCursor }` (`cursorPageSchema`). Le curseur est opaque pour le client.

## Contrats et OpenAPI

Les schémas Zod partagés vivent dans `packages/contracts` ; les DTO NestJS sont créés avec `createZodDto`. Ne pas ajouter `.meta({ id })` sur un schéma utilisé comme DTO racine : `nestjs-zod` 5 échoue alors à nettoyer le document OpenAPI. Le document est en OpenAPI 3.1 (champs nullables en `type: [T, "null"]`). `pnpm openapi:generate` puis `pnpm api-client:generate` mettent à jour le document et le client ; la CI échoue s'ils ne sont pas commités.

## Événements et outbox

- Un use case qui émet un événement écrit dans l'outbox dans la même transaction que son écriture métier : `transactions.run(async () => { ...; await outbox.record(event); })`. `OutboxService.record` refuse d'écrire hors transaction.
- Le payload est JSON, sans donnée personnelle superflue (identifiants et codes plutôt que noms ou emails ; un handler relit les données par la façade du module émetteur), et versionné par le suffixe `.vN` du type.
- Les événements dont le nom de fait comporte plusieurs mots les relient par un tiret : `identity.user.email-verified.v1`.
- Un handler est un provider décoré par `@DomainEventHandler({ name, eventTypes })`, enregistré côté worker. Le `name` est stable : il sert de source d'idempotence dans l'inbox.

## Idempotence

- Les routes d'écriture exposées aux clients portent `@Idempotent()` : l'en-tête `Idempotency-Key` devient obligatoire. Une requête rejouée renvoie la réponse stockée avec `Idempotent-Replayed: true` ; la même clé avec un autre corps renvoie `IDEMPOTENCY_KEY_REUSED` ; une requête en échec libère la clé.
- Les messages externes (webhooks de paiement) passent par `InboxService.process(source, externalId, work)`.

## Internationalisation

L'API ne renvoie jamais de texte localisé : uniquement des codes (erreurs, statuts, types). Les textes des emails viennent de `@pitchorium/i18n`. Le français est la source ; une langue n'est activée qu'avec son flag `locale.<code>` et un statut `reviewed` dans le manifeste.

## Feature flags

Lecture avec `FeatureFlagsService.isEnabled(key)` (cache de 10 s, flag inconnu = désactivé). Les flags sont créés par `pnpm db:seed` ; le seed ne modifie jamais l'état d'un flag existant.

## Tests

| Type                       | Emplacement                                                   | Commande                |
| -------------------------- | ------------------------------------------------------------- | ----------------------- |
| Unitaires                  | `src/**/*.spec.ts`, à côté du code                            | `pnpm test`             |
| Architecture               | `apps/server/test/architecture/`                              | `pnpm test`             |
| Intégration et HTTP        | `apps/server/test/integration/` (Testcontainers, Supertest)   | `pnpm test:integration` |
| Sandboxes des prestataires | `apps/server/test/providers/` (API de test réelles, ADR 0054) | `pnpm test:providers`   |

Le kernel (`src/platform/kernel`) est couvert à 100 %, seuil vérifié par `pnpm test`. Les tests d'intégration utilisent de vrais PostgreSQL, Valkey et Mailpit (lu par son API) ; seuls le stockage S3 et les fournisseurs OAuth sont remplacés, ces derniers par un serveur OIDC local (`test/integration/support/oauth-providers.ts`). Les tests unitaires du domaine sont à côté du code, dans `domain/`.

## Commits

Conventional Commits en anglais, scope obligatoire : `type(scope): description`.

- Types : `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`.
- Scopes : `repo`, `config`, `infra`, `db`, `contracts`, `api-client`, `i18n`, `emails`, `platform`, `server`, `ci`, `docs` et un scope par module métier (`identity`, `projects`...).
- Un commit correspond à une intention. Vérifié par commitlint (hook `commit-msg` et CI).
- Chaque commit compile et passe le typecheck seul : un commit qui dépend d'un autre vient après lui, jamais avant (vérification : `pnpm build && pnpm typecheck` sur chaque commit, par exemple avec `git rebase --exec`).

## Documentation

Toute modification de structure, de convention, de commande ou de variable d'environnement met à jour la documentation concernée (README, `docs/`, `.env.example`, README de module) dans le même commit. Toute information métier manquante est consignée dans `docs/open-questions.md` plutôt qu'inventée.

## Caractères interdits

Aucun caractère de dessin de boîte (U+2500 à U+257F) ni bannière décorative, dans aucun fichier. Vérifié par `pnpm check:box-drawing` en CI.
