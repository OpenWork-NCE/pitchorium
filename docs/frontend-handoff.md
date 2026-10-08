# Passation au frontend

Ce que l'application web (`apps/web`, `docs/architecture/frontend.md`) doit savoir pour consommer l'api. Référence complète des routes : `docs/api/index.html` (générée depuis `apps/server/openapi/openapi.json`) ; client typé : `@pitchorium/api-client` (fetch et hooks TanStack Query, Orval) ; contrats Zod : `@pitchorium/contracts` ; textes : `@pitchorium/i18n`.

## Authentification (Better Auth)

- Client officiel `better-auth/client` avec `baseURL: <API_PUBLIC_URL>/v1/auth` et les plugins correspondants (`twoFactorClient`, `magicLinkClient`) ; toutes les requêtes en `credentials: 'include'` : la session est un cookie `HttpOnly` (`pitchorium.session_token`), jamais lisible par JavaScript, jamais stocké ailleurs.
- Connexion : Google, LinkedIn, Microsoft (`signIn.social`, retour sur `<WEB_APP_URL>`), email et mot de passe (12 caractères au moins, mots de passe compromis refusés), lien magique. Les codes d'erreur de `/v1/auth` ont le format de Better Auth `{ code, message }` : traduire par `authErrorTranslationKey` (`errors.auth.<CODE>`).
- `GET /v1/auth-configuration` (public) : fournisseurs OAuth à afficher, dans cet ordre, clé publique et apparence de Cloudflare Turnstile (ou `null`), versions des conditions, longueur minimale du mot de passe. Quand Turnstile est présent, son jeton part dans l'en-tête `X-Captcha-Response` de l'inscription, de la connexion par email, du lien magique, de la réinitialisation et du signalement sans compte (ADR 0103).
- Double authentification exigée des modérateurs et administrateurs : `twoFactor.enable`, puis `verifyTotp`.
- Réauthentification : une action sensible peut répondre `403 ACCESS_REAUTHENTICATION_REQUIRED` (session de plus de 15 minutes) : faire se reconnecter le membre, puis rejouer l'action.
- Écritures par cookie : l'en-tête `Origin` doit être une origine de confiance (le navigateur l'envoie) ; sinon `ACCESS_ORIGIN_NOT_ALLOWED`.

## Acceptation légale et prérequis

- `GET /v1/legal-documents/current` (public) : versions en vigueur des conditions et de la politique de confidentialité ; `POST /v1/me/legal-acceptances` avec les deux versions et la déclaration d'âge.
- Tant que les versions en vigueur ne sont pas acceptées, la plupart des actions répondent `403 ACCESS_PREREQUISITES_MISSING` avec `missing: ["legal_acceptance", ...]` ; les droits RGPD, le compte et la situation de modération restent accessibles.
- `missing` liste tout ce qu'il faut compléter (`email_verified`, `kyc_verified`, `two_factor`, `profile.entrepreneur_facet`, `profile.contributor_facet`, `payout_account`) : ouvrir le bon formulaire (onboarding progressif, §7.2). `GET /v1/me/prerequisites/{action}` répond sans tenter l'action (par exemple `project.publish`, `payment.collection.open`).

## En-têtes

- `Idempotency-Key` (UUID par intention de l'utilisateur, réutilisé pour un nouvel essai) : obligatoire sur les écritures marquées idempotentes (documentées dans OpenAPI) ; une réponse rejouée porte `Idempotent-Replayed: true`, une clé réutilisée avec un autre corps répond `IDEMPOTENCY_KEY_REUSED`.
- `X-Time-Zone` : fuseau IANA du navigateur (`Intl.DateTimeFormat().resolvedOptions().timeZone`) à l'inscription ; modifiable ensuite par `PUT /v1/me/preferences`.
- `Accept-Language` : langue à l'inscription parmi les langues actives.
- Réponses : `X-Request-Id` (à joindre à tout signalement de bug), `Retry-After` sur `429`.

## Erreurs et langues

- Toute erreur hors `/v1/auth` suit RFC 9457 (`application/problem+json`) avec un `code` stable : afficher `errors.<code>` de `@pitchorium/i18n`, jamais `title` ni `detail` (techniques, en anglais). Erreurs de validation : `errors: [{ pointer, code }]` (JSON Pointer, code Zod) pour placer le message sur le champ.
- L'api ne renvoie jamais de texte traduit : statuts, types, motifs sont des codes à libeller par le namespace `reference` (`reference.<groupe>.<valeur>`).
- Langues actives : `GET /v1/locales` (public, pour un visiteur) et `activeLocales` de `GET /v1/me` (FR et EN au lancement) ; ne jamais proposer une langue absente de cette liste.

## Pagination

Par curseur : `?cursor=&limit=` (1 à 100, 20 par défaut), réponse `{ items, nextCursor }` ; `nextCursor` nul en fin de liste ; le curseur est opaque.

## Téléversement de fichiers

1. `POST /v1/media/uploads` avec l'usage, le type et la taille : la réponse donne une URL `PUT` présignée (type et taille signés) et l'identifiant.
2. `PUT` du fichier directement vers le stockage avec les en-têtes fournis.
3. `POST /v1/media/{mediaId}/confirm` ; le fichier passe `processing` (antivirus, type réel, variantes) puis `ready` ou `rejected` (motif codé) ; ne l'attacher à une ressource qu'une fois `ready`.
4. Lecture : URL publique (CDN) d'un fichier public, `GET /v1/media/{mediaId}/download-url` pour un fichier privé. Pas de vidéo hébergée : lien YouTube ou Vimeo.

## Temps réel

Socket.IO sur le namespace `/` (même origine de confiance et même cookie), protocole et charges utiles dans `docs/architecture/realtime.md` et `packages/contracts/src/realtime.ts` : messages avec numéro de séquence (rattrapage par `GET` après une reconnexion), notifications, compteurs (`counters`). Un événement poussé n'est qu'un raccourci : l'état fait foi par les routes HTTP.

## Feature flags

Le client ne lit pas les flags : leurs effets passent par les réponses (langues actives dans `GET /v1/locales` et `GET /v1/me`, moyens de paiement proposés par le devis, codes d'erreur). L'equity et les prêts restent une « intention » affichée (« nous ouvrons le capital » et un contact), jamais un paiement (§15).

## Comptes de démonstration

`pnpm db:seed:dev` : `<identifiant avec des points>@demo.pitchorium.test` (par exemple `aissatou.ba@demo.pitchorium.test`), mot de passe `pitchorium-demo-2026` ; modératrices `claudine.pierre.louis@...` et `koffi.agbodjan@...` (double authentification à activer) ; un administrateur se crée par `pnpm admin:create --email <email>`. Données entièrement fictives.

## Règles de visibilité à respecter à l'affichage

- Un profil, une publication, un projet, un événement ou une mission absent d'une réponse (ou `404`) n'existe pas pour ce lecteur : ne pas afficher de lien mort ni de compteur qui le trahirait.
- Un acteur absent (`null`, carte manquante) est un membre supprimé, bloqué ou non visible : afficher « Membre supprimé » ou rien, jamais son identifiant.
- Respecter `visibility` des publications (`public`, `members`, `connections`), la page publique optionnelle d'un profil, les détails métier privés, les listes de réseau masquées, les visites privées (« un membre du secteur X »).
- Contenus masqués par la modération : non renvoyés, sauf à leur auteur qui voit l'état ; un message masqué a un corps `null`.
- Contributeurs : nommés seulement s'ils ont accepté l'affichage public et ne sont pas anonymes.

## Mentions obligatoires

- **Impact auto-déclaré** : à côté de tout score ou niveau d'impact, la mention du namespace `reference` (`reference.impactMentions.*`), jamais de vocabulaire de certification (§12).
- **Traduction automatique** : avec tout texte traduit par `POST /v1/translations`, la mention `notice` (`common.machineTranslation`) et le prestataire ; l'original reste accessible.
- **Pas un reçu fiscal** : la confirmation d'une contribution n'est pas un reçu fiscal (texte des emails de confirmation, à reprendre sur la page de confirmation).
- **Paiements** : commission de 5 % affichée avant le paiement, un don n'est pas un titre, un palier débloqué n'est pas une garantie de succès (§9.5).
- **Modération** : un exposé des motifs et la voie d'appel accompagnent toute décision (`/me/moderation`).
