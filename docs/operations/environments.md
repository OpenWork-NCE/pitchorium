# Matrice des environnements

Toutes les variables lues par l'api et le worker, validées au démarrage par `apps/server/src/platform/config/env.ts`, puis celles de l'application web (section « Web ») (un démarrage échoue sur une valeur invalide, sans jamais afficher de valeur). Local : `apps/server/.env` copié de `.env.example`. Staging : comme la production, avec les clés de test des prestataires, `PAYMENTS_MODE=live` sur leurs sandboxes et des données fictives. Production : valeurs ci-dessous ; une ligne « défaut » garde la valeur par défaut, « à fixer » attend une décision ou un compte (`docs/production-readiness.md`). Un test vérifie que chaque variable du schéma figure ici et dans `.env.example`.

## Communes (api et worker)

| Variable                                   | Type                                                         | Défaut                                          | Local (`.env.example`)                    | Staging          | Production                        |
| ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------- | ---------------- | --------------------------------- |
| `NODE_ENV`                                 | énumération : development, test, production                  | `development`                                   | `development`                             | `production`     | `production`                      |
| `LOG_LEVEL`                                | énumération : fatal, error, warn, info, debug, trace, silent | `info`                                          | `info`                                    | comme production | défaut                            |
| `DATABASE_URL`                             | URL                                                          | —                                               | (valeur de développement)                 | comme production | secret (gestionnaire de secrets)  |
| `DATABASE_POOL_MAX`                        | entier                                                       | `10`                                            | `10`                                      | comme production | défaut                            |
| `REDIS_URL`                                | URL                                                          | —                                               | (valeur de développement)                 | comme production | secret (gestionnaire de secrets)  |
| `QUEUE_PREFIX`                             | texte                                                        | `pitchorium`                                    | `pitchorium`                              | comme production | défaut                            |
| `S3_ENDPOINT`                              | URL                                                          | —                                               | `http://localhost:9000`                   | comme production | à fixer                           |
| `S3_REGION`                                | texte                                                        | `auto`                                          | `auto`                                    | comme production | défaut                            |
| `S3_ACCESS_KEY_ID`                         | texte                                                        | —                                               | (valeur de développement)                 | clé de test      | secret (gestionnaire de secrets)  |
| `S3_SECRET_ACCESS_KEY`                     | texte                                                        | —                                               | (valeur de développement)                 | clé de test      | secret (gestionnaire de secrets)  |
| `S3_FORCE_PATH_STYLE`                      | booléen                                                      | `false`                                         | `true`                                    | comme production | défaut                            |
| `S3_BUCKET_PUBLIC`                         | texte                                                        | —                                               | `pitchorium-public`                       | comme production | à fixer                           |
| `S3_BUCKET_PRIVATE`                        | texte                                                        | —                                               | `pitchorium-private`                      | comme production | à fixer                           |
| `S3_PUBLIC_BASE_URL`                       | URL                                                          | —                                               | `http://localhost:9000/pitchorium-public` | comme production | à fixer                           |
| `MAIL_TRANSPORT`                           | énumération : smtp, resend                                   | —                                               | `smtp`                                    | comme production | `resend`                          |
| `MAIL_FROM`                                | texte                                                        | —                                               | `Pitchorium <no-reply@pitchorium.local>`  | comme production | à fixer                           |
| `SMTP_URL`                                 | URL                                                          | —                                               | (valeur de développement)                 | clé de test      | secret (gestionnaire de secrets)  |
| `RESEND_API_KEY`                           | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `SENTRY_DSN`                               | URL                                                          | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `SENTRY_ENVIRONMENT`                       | texte                                                        | —                                               | —                                         | comme production | facultative                       |
| `OTEL_EXPORTER_OTLP_ENDPOINT`              | URL                                                          | —                                               | —                                         | comme production | facultative                       |
| `WEB_APP_URL`                              | URL                                                          | `http://localhost:3200`                         | `http://localhost:3200`                   | comme production | défaut                            |
| `LEGAL_TERMS_VERSION`                      | texte                                                        | —                                               | `draft-2026-10`                           | comme production | à fixer                           |
| `LEGAL_PRIVACY_VERSION`                    | texte                                                        | —                                               | `draft-2026-10`                           | comme production | à fixer                           |
| `NETWORK_PROFILE_VIEWS_RETENTION_DAYS`     | entier                                                       | `90`                                            | `90`                                      | comme production | défaut                            |
| `API_PUBLIC_URL`                           | URL                                                          | `http://localhost:3000`                         | `http://localhost:3000`                   | comme production | défaut                            |
| `EMAIL_LINK_SECRET`                        | texte                                                        | `DEVELOPMENT_EMAIL_LINK_SECRET`                 | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `MESSAGING_DEFAULT_POLICY`                 | énumération                                                  | `connections_and_second_degree`                 | `connections_and_second_degree`           | comme production | défaut                            |
| `MESSAGING_EDIT_WINDOW_MINUTES`            | entier                                                       | `15`                                            | `15`                                      | comme production | défaut                            |
| `NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES` | entier                                                       | `1440`                                          | `1440`                                    | comme production | défaut                            |
| `NOTIFICATIONS_LOW_PRIORITY_PER_DAY`       | entier                                                       | `20`                                            | `20`                                      | comme production | défaut                            |
| `ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES`  | entier                                                       | `15`                                            | `15`                                      | comme production | défaut                            |
| `TRUST_MODERATOR_MAX_SUSPENSION_DAYS`      | entier                                                       | `30`                                            | `30`                                      | comme production | défaut                            |
| `TRUST_APPEAL_WINDOW_DAYS`                 | entier                                                       | `183`                                           | `183`                                     | comme production | défaut                            |
| `TRUST_SIGNAL_MESSAGE_REQUESTS_PER_DAY`    | entier                                                       | `15`                                            | `15`                                      | comme production | défaut                            |
| `TRUST_SIGNAL_CONNECTION_REQUESTS_PER_DAY` | entier                                                       | `50`                                            | `50`                                      | comme production | défaut                            |
| `TRUST_SIGNAL_REPORTS_RECEIVED_PER_WEEK`   | entier                                                       | `3`                                             | `3`                                       | comme production | défaut                            |
| `LOCALIZATION_PROVIDERS`                   | énumération : deepl, google, simulated                       | —                                               | —                                         | comme production | `deepl,google` (sans `simulated`) |
| `DEEPL_API_KEY`                            | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `DEEPL_API_BASE_URL`                       | URL                                                          | `https://api-free.deepl.com`                    | `https://api-free.deepl.com`              | comme production | défaut                            |
| `GOOGLE_TRANSLATE_API_KEY`                 | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `LOCALIZATION_MEMBER_DAILY_CHARACTERS`     | entier                                                       | `20_000`                                        | `20000`                                   | comme production | défaut                            |
| `LOCALIZATION_MONTHLY_CHARACTERS_CAP`      | entier                                                       | `500_000`                                       | `500000`                                  | comme production | défaut                            |
| `LOCALIZATION_CACHE_TTL_DAYS`              | entier                                                       | `30`                                            | `30`                                      | comme production | défaut                            |
| `PRIVACY_ERASURE_GRACE_DAYS`               | entier                                                       | `30`                                            | `30`                                      | comme production | défaut                            |
| `PRIVACY_ERASURE_REMINDER_DAYS`            | entier                                                       | `7`                                             | `7`                                       | comme production | défaut                            |
| `PRIVACY_EXPORT_MIN_INTERVAL_HOURS`        | entier                                                       | `24`                                            | `24`                                      | comme production | défaut                            |
| `PRIVACY_EXPORT_TTL_HOURS`                 | entier                                                       | `72`                                            | `72`                                      | comme production | défaut                            |
| `PRIVACY_EXPORT_URL_TTL_SECONDS`           | entier                                                       | `300`                                           | `300`                                     | comme production | défaut                            |
| `PAYMENTS_MODE`                            | énumération : simulated, live                                | `simulated`                                     | `simulated`                               | comme production | `live`                            |
| `STRIPE_SECRET_KEY`                        | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `STRIPE_WEBHOOK_SECRET`                    | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `STRIPE_API_BASE_URL`                      | URL                                                          | `https://api.stripe.com`                        | `https://api.stripe.com`                  | comme production | défaut                            |
| `FLUTTERWAVE_SECRET_KEY`                   | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `FLUTTERWAVE_WEBHOOK_SECRET_HASH`          | texte                                                        | —                                               | —                                         | clé de test      | secret (gestionnaire de secrets)  |
| `FLUTTERWAVE_API_BASE_URL`                 | URL                                                          | `https://api.flutterwave.com`                   | `https://api.flutterwave.com`             | comme production | défaut                            |
| `PAYMENTS_SIMULATED_WEBHOOK_SECRET`        | texte                                                        | `simulated-webhook-secret-for-development-only` | (valeur de développement)                 | clé de test      | secret (gestionnaire de secrets)  |
| `PAYMENTS_COMMISSION_RATE_BPS`             | entier                                                       | `500`                                           | `500`                                     | comme production | défaut                            |
| `PAYMENTS_COMMISSION_VERSION`              | texte                                                        | `2026-10`                                       | `2026-10`                                 | comme production | défaut                            |
| `PAYMENTS_SESSION_TTL_MINUTES`             | entier                                                       | `60`                                            | `60`                                      | comme production | défaut                            |
| `PAYMENTS_MIN_EUR_MINOR`                   | entier                                                       | `100`                                           | `100`                                     | comme production | défaut                            |
| `PAYMENTS_MAX_EUR_MINOR`                   | entier                                                       | `1_000_000`                                     | `1000000`                                 | comme production | défaut                            |
| `PAYMENTS_CONTRIBUTIONS_PER_HOUR`          | entier                                                       | `10`                                            | `10`                                      | comme production | défaut                            |
| `PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR`    | entier                                                       | `5`                                             | `5`                                       | comme production | défaut                            |
| `PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR` | entier                                                       | `100_000`                                       | `100000`                                  | comme production | défaut                            |
| `PAYMENTS_ANONYMOUS_DONATIONS`             | booléen                                                      | `false`                                         | `false`                                   | comme production | défaut                            |

## api

| Variable                               | Type        | Défaut             | Local (`.env.example`)    | Staging          | Production                       |
| -------------------------------------- | ----------- | ------------------ | ------------------------- | ---------------- | -------------------------------- |
| `API_HOST`                             | texte       | `0.0.0.0`          | `0.0.0.0`                 | comme production | défaut                           |
| `API_PORT`                             | entier      | `3000`             | `3000`                    | comme production | défaut                           |
| `CORS_ORIGINS`                         | URL (liste) | —                  | `http://localhost:3200`   | comme production | à fixer                          |
| `TRUST_PROXY_HOPS`                     | entier      | `0`                | `0`                       | comme production | défaut                           |
| `WEB_CLIENT_ADDRESS_SECRET`            | texte       | —                  | (valeur de développement) | clé de test      | secret partagé avec le web       |
| `RATE_LIMIT_TTL_SECONDS`               | entier      | `60`               | `60`                      | comme production | défaut                           |
| `RATE_LIMIT_MAX`                       | entier      | `120`              | `120`                     | comme production | défaut                           |
| `IDEMPOTENCY_TTL_HOURS`                | entier      | `24`               | `24`                      | comme production | défaut                           |
| `AUTH_SECRET`                          | texte       | —                  | (valeur de développement) | clé de test      | secret (gestionnaire de secrets) |
| `AUTH_TRUSTED_ORIGINS`                 | URL (liste) | —                  | —                         | comme production | à fixer                          |
| `AUTH_COOKIE_DOMAIN`                   | texte       | —                  | —                         | comme production | facultative                      |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS`       | entier      | `60`               | `60`                      | comme production | défaut                           |
| `AUTH_RATE_LIMIT_MAX`                  | entier      | `10`               | `10`                      | comme production | défaut                           |
| `AUTH_PWNED_PASSWORD_CHECK`            | booléen     | `true`             | (valeur de développement) | clé de test      | secret (gestionnaire de secrets) |
| `GOOGLE_CLIENT_ID`                     | texte       | —                  | —                         | comme production | facultative                      |
| `GOOGLE_CLIENT_SECRET`                 | texte       | —                  | —                         | clé de test      | secret (gestionnaire de secrets) |
| `LINKEDIN_CLIENT_ID`                   | texte       | —                  | —                         | comme production | facultative                      |
| `LINKEDIN_CLIENT_SECRET`               | texte       | —                  | —                         | clé de test      | secret (gestionnaire de secrets) |
| `MICROSOFT_CLIENT_ID`                  | texte       | —                  | —                         | comme production | facultative                      |
| `MICROSOFT_CLIENT_SECRET`              | texte       | —                  | —                         | clé de test      | secret (gestionnaire de secrets) |
| `TURNSTILE_SITE_KEY`                   | texte       | —                  | —                         | clé de test      | obligatoire                      |
| `TURNSTILE_SECRET_KEY`                 | texte       | —                  | —                         | clé de test      | secret (gestionnaire de secrets) |
| `TURNSTILE_APPEARANCE`                 | énumération | `interaction-only` | `interaction-only`        | comme production | défaut                           |
| `MEDIA_UPLOAD_URL_TTL_SECONDS`         | entier      | `900`              | `900`                     | comme production | défaut                           |
| `MEDIA_DOWNLOAD_URL_TTL_SECONDS`       | entier      | `300`              | `300`                     | comme production | défaut                           |
| `MEDIA_QUOTA_MAX_FILES`                | entier      | `500`              | `500`                     | comme production | défaut                           |
| `MEDIA_QUOTA_MAX_BYTES`                | entier      | `1_073_741_824`    | `1073741824`              | comme production | défaut                           |
| `MEDIA_UPLOAD_REQUESTS_PER_HOUR`       | entier      | `60`               | `60`                      | comme production | défaut                           |
| `ORGANIZATIONS_MAX_CREATED_PER_USER`   | entier      | `5`                | `5`                       | comme production | défaut                           |
| `ORGANIZATIONS_INVITATION_TTL_DAYS`    | entier      | `7`                | `7`                       | comme production | défaut                           |
| `NETWORK_CONNECTION_REQUESTS_PER_WEEK` | entier      | `100`              | `100`                     | comme production | défaut                           |
| `NETWORK_DECLINE_COOLDOWN_DAYS`        | entier      | `21`               | `21`                      | comme production | défaut                           |
| `NETWORK_REQUEST_TTL_DAYS`             | entier      | `30`               | `30`                      | comme production | défaut                           |
| `NETWORK_MUTUAL_CONNECTIONS_CAP`       | entier      | `999`              | `999`                     | comme production | défaut                           |
| `MESSAGING_REQUESTS_PER_DAY`           | entier      | `20`               | `20`                      | comme production | défaut                           |
| `RESEND_WEBHOOK_SECRET`                | texte       | —                  | —                         | clé de test      | secret (gestionnaire de secrets) |
| `CONTENT_FEED_EDITORIAL_THRESHOLD`     | entier      | `10`               | `10`                      | comme production | défaut                           |
| `ORGANIZATIONS_VERIFICATION_CRITERIA`  | texte       | —                  | —                         | comme production | à fixer                          |

## worker

| Variable                                           | Type                           | Défaut      | Local (`.env.example`) | Staging          | Production                       |
| -------------------------------------------------- | ------------------------------ | ----------- | ---------------------- | ---------------- | -------------------------------- |
| `WORKER_HEALTH_PORT`                               | entier                         | `3001`      | `3001`                 | comme production | défaut                           |
| `OUTBOX_POLL_INTERVAL_MS`                          | entier                         | `1000`      | `1000`                 | comme production | défaut                           |
| `OUTBOX_BATCH_SIZE`                                | entier                         | `100`       | `100`                  | comme production | défaut                           |
| `OUTBOX_MAX_BACKOFF_MS`                            | entier                         | `300_000`   | `300000`               | comme production | défaut                           |
| `OUTBOX_RETENTION_DAYS`                            | entier                         | `30`        | `30`                   | comme production | défaut                           |
| `CLAMAV_HOST`                                      | texte                          | `localhost` | `localhost`            | comme production | défaut                           |
| `CLAMAV_PORT`                                      | entier                         | `3310`      | `3310`                 | comme production | défaut                           |
| `CLAMAV_TIMEOUT_MS`                                | entier                         | `60_000`    | `60000`                | comme production | défaut                           |
| `MEDIA_ORPHAN_TTL_HOURS`                           | entier                         | `24`        | `24`                   | comme production | défaut                           |
| `MEDIA_IMPORT_TIMEOUT_MS`                          | entier                         | `10_000`    | `10000`                | comme production | défaut                           |
| `SCHEDULED_TASKS_EVERY_MS`                         | entier                         | —           | —                      | comme production | interdite                        |
| `CONTENT_LINK_PREVIEW_TIMEOUT_MS`                  | entier                         | `5000`      | `5000`                 | comme production | défaut                           |
| `CONTENT_LINK_PREVIEW_MAX_BYTES`                   | entier                         | `1_048_576` | `1048576`              | comme production | défaut                           |
| `PROJECTS_ENDING_SOON_HOURS`                       | entier                         | `72`        | `72`                   | comme production | défaut                           |
| `NOTIFICATIONS_RETENTION_DAYS`                     | entier                         | `90`        | `90`                   | comme production | défaut                           |
| `NOTIFICATIONS_FANOUT_BATCH_SIZE`                  | entier                         | `500`       | `500`                  | comme production | défaut                           |
| `NOTIFICATIONS_UNREAD_MESSAGE_EMAIL_DELAY_MINUTES` | entier                         | `30`        | `30`                   | comme production | défaut                           |
| `NOTIFICATIONS_DIGEST_HOUR`                        | entier                         | `8`         | `8`                    | comme production | défaut                           |
| `NOTIFICATIONS_EVENT_REMINDER_HOURS`               | entier                         | `24`        | `24`                   | comme production | défaut                           |
| `PAYMENTS_RECONCILIATION_LOOKBACK_DAYS`            | entier                         | `3`         | `3`                    | comme production | défaut                           |
| `CDN_PURGE_PROVIDER`                               | énumération : none, cloudflare | `none`      | `none`                 | comme production | `cloudflare`                     |
| `CLOUDFLARE_ZONE_ID`                               | texte                          | —           | —                      | comme production | facultative                      |
| `CLOUDFLARE_API_TOKEN`                             | texte                          | —           | —                      | clé de test      | secret (gestionnaire de secrets) |

## Web (`apps/web`)

Validées par `apps/web/src/lib/env.ts` au chargement de `next.config.ts` : `next build` échoue sur une valeur invalide. Les variables `NEXT_PUBLIC_` sont inscrites dans le JavaScript du navigateur au build : un changement demande un nouveau build. `WEB_PORT` est lue par les scripts `dev:web` et `start`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` et `SENTRY_PROJECT` par le build seulement.

| Variable                         | Type                     | Défaut        | Local (`.env.example`)                    | Staging           | Production                                                                |
| -------------------------------- | ------------------------ | ------------- | ----------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `WEB_PORT`                       | entier                   | `3200`        | `3200`                                    | selon l'hébergeur | selon l'hébergeur                                                         |
| `NEXT_PUBLIC_SITE_URL`           | URL                      | —             | `http://localhost:3200`                   | URL du site       | URL HTTPS du site (question 25)                                           |
| `NEXT_PUBLIC_API_URL`            | URL                      | —             | `http://localhost:3000`                   | URL de l'api      | `API_PUBLIC_URL` de l'api                                                 |
| `API_INTERNAL_URL`               | URL                      | —             | vide (origine publique)                   | réseau privé      | réseau privé de l'hébergeur si possible                                   |
| `WEB_CLIENT_ADDRESS_SECRET`      | texte                    | —             | (valeur de développement)                 | clé de test       | `WEB_CLIENT_ADDRESS_SECRET` de l'api (ADR 0115)                           |
| `WEB_TRUST_PROXY_HOPS`           | entier                   | `0`           | `0`                                       | selon l'hébergeur | proxys devant le web (Vercel : `1`, `deployment.md`)                      |
| `NEXT_PUBLIC_CDN_URL`            | URL                      | —             | `http://localhost:9000/pitchorium-public` | comme production  | `S3_PUBLIC_BASE_URL` de l'api                                             |
| `NEXT_PUBLIC_UPLOAD_URL`         | URL                      | —             | `http://localhost:9000`                   | comme production  | `S3_ENDPOINT` de l'api, joignable du navigateur (envois de fichiers, CSP) |
| `NEXT_PUBLIC_SENTRY_DSN`         | URL                      | —             | vide                                      | projet de test    | DSN du projet web (question 26)                                           |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | texte                    | `development` | `development`                             | `staging`         | `production`                                                              |
| `NEXT_PUBLIC_VERCEL_ANALYTICS`   | booléen (`true`/`false`) | `false`       | `false`                                   | comme production  | `true` sur Vercel seulement (question 96)                                 |
| `NEXT_PUBLIC_LEGAL_TERMS_URL`    | URL                      | —             | —                                         | comme production  | texte publié des CGU (question 31)                                        |
| `NEXT_PUBLIC_LEGAL_PRIVACY_URL`  | URL                      | —             | —                                         | comme production  | texte publié de la politique de confidentialité (question 31)             |
| `SENTRY_AUTH_TOKEN`              | texte                    | —             | vide                                      | secret de la CI   | secret de la CI (cartes de sources)                                       |
| `SENTRY_ORG`, `SENTRY_PROJECT`   | texte                    | —             | vide                                      | comme production  | organisation et projet Sentry                                             |

L'origine du web doit figurer dans `WEB_APP_URL` et `CORS_ORIGINS` (ou `AUTH_TRUSTED_ORIGINS`) de l'api ; le cookie de session est partagé par le domaine parent (`AUTH_COOKIE_DOMAIN`).
