# Préparation de la mise en production

Liste ordonnée : chaque étape suppose les précédentes faites. Responsables : **client** (comptes, contrats, contenus, décisions), **développeur** (configuration, déploiement, vérifications), **juridique** (validations). Les numéros renvoient à `docs/open-questions.md`.

## 1. Décisions préalables

1. **Juridique** : valider le schéma des paiements, l'absence de détention de fonds, les seuils anti-blanchiment, les dons anonymes, la portée des contributions hors plateforme (questions 51 à 58, 60 ; `docs/architecture/payments-compliance.md`).
2. **Client et juridique** : pays d'établissement de Pitchorium et TVA sur la commission (question 59).
3. **Client** : prestataire pour l'Afrique francophone et le Kenya, confirmation des capacités Stripe et Flutterwave (questions 9, 10, 61, 62).
4. **Client** : critères, pondérations et paliers du score d'impact, publiés ensuite comme méthodologie par un administrateur (questions 1 à 3).
5. **Client et juridique** : textes des CGU et de la politique de confidentialité, et leurs versions ; durées de conservation ; obligations DSA (questions 20, 31, 81, 84 à 86 ; `docs/compliance/records-of-processing.md` à finaliser).
6. **Client** : hébergeur, région, outil de traces et projet Sentry (questions 24, 26).

## 2. Domaines et DNS (client, puis développeur)

1. Domaines du site, de l'api et des fichiers publics (question 25), par exemple `pitchorium.example`, `api.pitchorium.example`, `cdn.pitchorium.example`.
2. Api : enregistrement A ou AAAA vers le proxy (Caddy obtient le certificat TLS seul, `docs/operations/vm-guide.md`).
3. Email d'expédition (domaine de `MAIL_FROM`, vérifié dans Resend) :
   - **SPF** : l'enregistrement TXT (et MX de retour) donné par Resend pour le sous-domaine d'envoi ;
   - **DKIM** : l'enregistrement TXT `resend._domainkey` donné par Resend ;
   - **DMARC** : TXT `_dmarc` avec `p=none` et une adresse de rapports au lancement, puis `p=quarantine` après deux semaines de rapports propres.
4. Cookies : `AUTH_COOKIE_DOMAIN` = domaine parent commun au site et à l'api.

## 3. Comptes de production (client ouvre, développeur configure)

Tous au nom du client (question 90), accès partagés par le gestionnaire de secrets, jamais par email.

1. **OAuth** (question 27) : applications Google, LinkedIn (« Sign In with LinkedIn using OpenID Connect ») et Microsoft (Entra ID multi-tenant). URI de redirection exactes : `<API_PUBLIC_URL>/v1/auth/callback/google`, `.../linkedin`, `.../microsoft`. Variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINKEDIN_*`, `MICROSOFT_*`.
2. **Stripe** (compte de plateforme Connect, mode live) : endpoint de webhook **Connect** (événements des comptes connectés) sur `<API_PUBLIC_URL>/v1/payments/webhooks/stripe`, avec exactement :
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` ;
   - `charge.updated` (porte les frais Stripe, rattachés après le paiement, ADR 0044), `charge.refunded` ;
   - `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` ;
   - `account.updated` (état du compte de versement).
     Secret de signature : `STRIPE_WEBHOOK_SECRET` ; clé : `STRIPE_SECRET_KEY` ; `PAYMENTS_MODE=live`.
3. **Flutterwave** (compte marchand live) : URL de webhook `<API_PUBLIC_URL>/v1/payments/webhooks/flutterwave`, hash secret `FLUTTERWAVE_WEBHOOK_SECRET_HASH`, clé `FLUTTERWAVE_SECRET_KEY` ; demander l'activation des webhooks de rétrofacturation (`chargeback.*`).
4. **Resend** : domaine vérifié (étape 2.3), clé `RESEND_API_KEY`, `MAIL_TRANSPORT=resend` ; webhook `<API_PUBLIC_URL>/v1/notifications/webhooks/resend` avec `email.bounced` et `email.complained`, secret `RESEND_WEBHOOK_SECRET`.
5. **Cloudflare R2 et CDN** : buckets public et privé (`S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`), clés d'accès limitées à ces buckets, CORS du bucket privé autorisant `PUT` depuis `WEB_APP_URL`, domaine public `S3_PUBLIC_BASE_URL`, jeton d'API limité à la purge du cache de la zone (`CDN_PURGE_PROVIDER=cloudflare`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`), règles de cycle de vie et copie de sauvegarde (`docs/operations/backup-and-restore.md`).
6. **Traduction** : clé DeepL ou Google (`LOCALIZATION_PROVIDERS`, `DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`), plafonds (question 88).
7. **Sentry et traces** : `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `OTEL_EXPORTER_OTLP_ENDPOINT`.

## 4. Secrets et configuration (développeur)

1. Générer `AUTH_SECRET` (32 octets aléatoires au moins) ; ne jamais réutiliser celui d'un autre environnement.
2. Renseigner chaque variable de `docs/operations/environments.md` (colonne production) dans le gestionnaire de secrets ; `NODE_ENV=production` refuse au démarrage le mode de paiement simulé et le traducteur simulé.
3. Versions légales en vigueur : `LEGAL_TERMS_VERSION`, `LEGAL_PRIVACY_VERSION` (étape 1.5).
4. `TRUST_PROXY_HOPS` = nombre exact de proxys devant l'api ; `CORS_ORIGINS` et `AUTH_TRUSTED_ORIGINS` = origine du site seulement.
5. Rotation : `docs/operations/runbooks/secrets-rotation.md`.

## 5. Première mise en service (développeur)

1. Construire l'image de la version (`v0.1.0` une fois la pull request de release-please fusionnée) et la pousser.
2. Tâche de release : `dist/main.migrate.js`, puis `dist/main.seed.js` (flags et données de référence, idempotent).
3. État initial des feature flags (seed) : `locale.fr` et `locale.en` actifs ; `locale.sw`, `locale.wo`, `locale.ln` inactifs (activation refusée sans catalogue complet et relecture humaine native approuvée, ADR 0077) ; `funding.equity` et `funding.loans` inactifs (activation refusée sans référence de validation juridique, et le paiement reste refusé, ADR 0051). Ne rien changer au lancement.
4. Premier administrateur : `node dist/main.create-admin.js --email <email>` (dans l'image), qui active ensuite sa double authentification ; modérateurs nommés par lui (`POST /v1/admin/members/{userId}/roles`), double authentification exigée.
5. Méthodologie d'impact (étape 1.4) créée et publiée par l'administrateur.
6. Démarrer worker puis api ; vérifier `/v1/health/ready`, une inscription complète (email reçu, lien), une contribution réelle de faible montant puis son remboursement, la réception d'un rebond Resend de test.
7. Alertes branchées (`docs/operations/slo-and-alerts.md`), sauvegardes actives et un exercice de restauration sur la copie de production (`docs/operations/backup-and-restore.md`).

## 6. Validations en attente (juridique)

- Paiements, KYC, anti-blanchiment : questions 13, 14, 51 à 58, 60.
- Equity et prêts : licence ECSP ou partenaire habilité (question 14) ; les flags restent inactifs jusque-là.
- Textes légaux, conservation, DSA : questions 20, 31, 81, 84 à 86.
- Langues swahili, wolof, lingala : relecture humaine native (question 21), indépendante du lancement en français et en anglais.
