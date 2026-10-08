# Revue de sécurité

État au 2026-10-08 ; chaque point renvoie au code qui l'applique et, quand il existe, au test qui le vérifie.

## En-têtes HTTP

`helmet` (`apps/server/src/platform/http/http-app.ts`) sur toutes les réponses de l'api : `Content-Security-Policy` par défaut de helmet en production (désactivée hors production pour Swagger UI), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: same-origin` ; `X-Powered-By` retiré. Le proxy de référence (Caddy) ajoute HSTS avec `preload`. Vérifié par `test/integration/http.spec.ts`.

## CORS

Liste blanche `CORS_ORIGINS` (aucune origine si vide), `credentials: true`, en-têtes exposés limités (`X-Request-Id`, `Idempotent-Replayed`, `Retry-After`). Les écritures authentifiées par cookie exigent en plus un `Origin` (à défaut `Referer`) de confiance (`ACCESS_ORIGIN_NOT_ALLOWED`, ADR 0021) : protection CSRF indépendante de CORS.

## Cookies

Session Better Auth `pitchorium.session_token` (préfixe `__Secure-` en HTTPS) : `HttpOnly`, `Secure` dès que `API_PUBLIC_URL` est en HTTPS, `SameSite=Lax`, domaine parent `AUTH_COOKIE_DOMAIN`, 30 jours glissants ; aucune donnée dans `localStorage` côté client attendue (`docs/frontend-handoff.md`).

## Limitation de débit (inventaire)

| Famille                               | Limite (provisoire)                                                                                              | Où                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- |
| Toute route HTTP                      | `RATE_LIMIT_MAX` (120) par adresse IP et `RATE_LIMIT_TTL_SECONDS` (60 s), compteurs Redis                        | `HttpThrottlerGuard` |
| `/v1/auth/*`                          | `AUTH_RATE_LIMIT_MAX` par `AUTH_RATE_LIMIT_WINDOW_SECONDS` ; double authentification 3 par 10 s                  | Better Auth          |
| Signalement sans compte               | 5 par heure et par adresse                                                                                       | `ReportsController`  |
| Téléversements                        | `MEDIA_UPLOAD_REQUESTS_PER_HOUR` (60) par membre, quotas de fichiers et d'octets                                 | media                |
| Demandes de connexion                 | `NETWORK_CONNECTION_REQUESTS_PER_WEEK` (100), délai après refus                                                  | network              |
| Premiers messages hors réseau         | `MESSAGING_REQUESTS_PER_DAY` (20)                                                                                | messaging            |
| Contributions et sessions de paiement | `PAYMENTS_CONTRIBUTIONS_PER_HOUR`, `PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR`                                       | payments             |
| Traduction                            | `LOCALIZATION_MEMBER_DAILY_CHARACTERS`, plafond mensuel                                                          | localization         |
| Export RGPD                           | 1 par `PRIVACY_EXPORT_MIN_INTERVAL_HOURS` (24)                                                                   | privacy              |
| Socket.IO                             | handshake authentifié ; pas de limite par message (le temps réel n'accepte que des abonnements, aucune écriture) | realtime             |

Derrière un proxy, `TRUST_PROXY_HOPS` doit valoir le nombre exact de proxys pour que l'adresse IP retenue soit celle du client.

## Réauthentification

Actions `recentAuthentication` (session de moins de `ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES`, 15 minutes) : gestion des rôles, remboursement, remboursements d'un projet gelé, modification d'un feature flag, demande de suppression de compte. Les rôles privilégiés exigent en plus la double authentification (`two_factor`). Vérifié par `access-policy.spec.ts`.

## Entrées

- Corps JSON limités à 1 Mo (`useBodyParser('json', { limit: '1mb' })`, `413 PAYLOAD_TOO_LARGE`) ; fichiers jamais transmis à l'api (URL présignées, taille signée).
- Validation Zod de chaque entrée (`StrictValidationPipe` global, `apps/server/src/platform/http/strict-validation.pipe.ts`) : un corps portant une clé inconnue du contrat, à toute profondeur, est refusé (`400 VALIDATION_FAILED`, code `unrecognized_keys`, pointeur sur la clé) au lieu d'être ignoré ; chaque chaîne et chaque liste d'entrée est bornée (`test/architecture/contracts.spec.ts`, sur le document OpenAPI).
- Markdown restreint pour les textes longs, aperçus de liens protégés contre le SSRF (ADR 0033), fichiers analysés par ClamAV et réencodés (ADR 0022, 0023).

## Journaux

pino-http ne journalise jamais les corps. Chemins masqués (`[redacted]`) dans toute ligne : en-têtes `authorization`, `cookie`, `set-cookie`, `x-api-key`, signatures des webhooks (`stripe-signature`, `verif-hash`, `svix-signature`), et les champs `password`, `token`, `secret`, `apiKey`, `email`, `iban`, `cardNumber` de tout objet journalisé (`apps/server/src/platform/observability/log-redaction.ts`, test `log-redaction.spec.ts`). Les messages texte n'incluent pas de donnée personnelle par convention (identifiants seulement). Aucune donnée de carte ne transite par l'api (pages des prestataires).

## Autorisations

Refus par défaut (ADR 0015). `test/architecture/route-inventory.spec.ts` lit le document OpenAPI (extension `x-access` de chaque opération) : toute route a une action connue du registre ou figure dans la liste revue des routes publiques (29 lectures, 2 écritures : désabonnement signé et signalement sans compte) ; toute route `/v1/admin/*` exige un rôle. `test/integration/idor.spec.ts` appelle, avec la session d'un autre membre, la lecture, la modification et la suppression d'une publication réservée aux relations, d'un fichier et d'un export : `404` partout, comme pour une ressource absente. Ce test a révélé que la modification d'une publication invisible répondait `403` (existence divulguée) : `PostResolver` répond désormais `404` à qui ne peut pas la lire.

## Indisponibilité d'une dépendance

Le client Redis partagé échoue vite quand Redis est injoignable (une seule tentative, file hors ligne coupée après la première connexion) : les requêtes répondent `503 SERVICE_UNAVAILABLE` en quelques millisecondes au lieu d'attendre (mesures dans `docs/operations/resilience.md`).

## Analyses en CI

- Secrets dans tout l'historique : gitleaks 8.30.1 (job `security`) ; les deux faux positifs (valeurs factices des tests) sont listés par empreinte dans `.gitleaksignore`, une nouvelle valeur de test porte `gitleaks:allow`.
- Dépendances de production : `pnpm audit --prod --audit-level high` ; exception documentée dans `pnpm-workspace.yaml` (`braces`, outil de lint, aucun correctif publié). Next.js et drizzle-kit, pairs optionnels de Better Auth, ne sont plus résolus dans le serveur (`overrides`), ce qui retire une vulnérabilité critique de Next.js du graphe de production.
- Licences : `pnpm check:licenses` refuse GPL et AGPL (seules ou sans alternative permissive) dans les dépendances de production.
- CodeQL (`security-extended`) sur chaque push et chaque semaine (`.github/workflows/codeql.yaml`).
- Image : construite en CI, analysée par Trivy 0.74.0 (vulnérabilités hautes et critiques corrigeables : échec), SBOM CycloneDX publié en artefact (`sbom-cyclonedx`).
