# Déploiement de l'application web

L'application web (`apps/web`) est déployée sur Vercel (question 96 : hypothèse retenue tant que le client n'a pas décidé autrement ; l'autre voie, un conteneur `next start` derrière le proxy de l'api, reste documentée dans `docs/operations/deployment.md`). Décision : ADR 0176. L'api, le worker et leurs données sont déployés à part (`docs/operations/deployment.md`).

## Projet Vercel

- Un projet, dossier racine `apps/web`, configuration dans `apps/web/vercel.json` : installation `pnpm install --frozen-lockfile` (pnpm du `packageManager`), build `pnpm turbo run build --filter=@pitchorium/web` (paquets puis web) suivi de `check:bundles` (budgets, aucune carte de sources publique), région `cdg1` (Paris, provisoire : à aligner sur la région de l'api, questions 24 et 146).
- Déploiements automatiques de Vercel par Git désactivés (`git.deploymentEnabled: false`) : chaque déploiement passe par le workflow `.github/workflows/deploy-web.yaml`, donc par une CI verte.
- Environnements de Vercel : **Preview** (préproduction) et **Production**, chacun avec ses propres variables ; aucune valeur de production dans Preview.

## Variables

Validées par `apps/web/src/lib/env.ts` au build : un build échoue sur une valeur invalide. Liste, types et valeurs par environnement : `docs/operations/environments.md`, section « Web ». À saisir dans Vercel :

- Preview et Production (valeurs distinctes) : `NEXT_PUBLIC_SITE_URL` (HTTPS), `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL` (vide sur Vercel, l'api est jointe par son adresse publique), `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_UPLOAD_URL`, `WEB_CLIENT_ADDRESS_SECRET` (le même que l'api du même environnement), `WEB_TRUST_PROXY_HOPS=1`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (`staging` ou `production`), `NEXT_PUBLIC_VERCEL_ANALYTICS=true`, `CONTACT_EMAIL`, `NEXT_PUBLIC_LEGAL_TERMS_URL` et `NEXT_PUBLIC_LEGAL_PRIVACY_URL` (facultatives).
- Build seulement (secrets de Vercel) : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- Jamais : `WEB_PSEUDO_LOCALIZATION` (tests seulement, refusée hors d'un site local).

L'api de chaque environnement liste l'origine du web dans `WEB_APP_URL`, `CORS_ORIGINS` et `AUTH_TRUSTED_ORIGINS`, et partage le domaine parent des cookies (`AUTH_COOKIE_DOMAIN`). Une adresse de préproduction propre à un déploiement (`*.vercel.app`) n'est pas une origine de confiance de l'api : la préproduction s'utilise par son domaine fixe (alias Vercel du projet, par exemple `staging.pitchorium.example`).

## Domaines

- Production : le domaine du site (question 25) ajouté au projet Vercel, enregistrement DNS donné par Vercel (A ou CNAME), certificat géré par Vercel ; HSTS et `upgrade-insecure-requests` suivent `NEXT_PUBLIC_SITE_URL` en HTTPS.
- Préproduction : un sous-domaine fixe (par exemple `staging.`), alias du dernier déploiement Preview de `main`.
- L'api, le CDN des fichiers et le stockage gardent leurs domaines (`docs/production-readiness.md`) ; leurs origines entrent dans la CSP par les variables ci-dessus (`apps/web/src/lib/security/csp.ts`).

## Cache

- Pages : jamais en cache partagé. Chaque réponse porte un nonce propre à la requête (CSP, ADR 0088) ; une page lit l'api à chaque requête.
- Lectures publiques de l'api sans lecteur (projets mis en avant de l'accueil 5 min, couverture des paiements 1 h, versions des conditions 5 min, données de référence 1 h, configuration de l'authentification 1 min, listes du plan du site 1 h) : gardées par le cache de données de Next.js (`sharedRead`, `apps/web/src/lib/api/server.ts`), envoyées sans cookie, sans langue ni adresse du visiteur, sinon chaque requête aurait sa propre clé de cache.
- `/_next/static` : immuable (noms à empreinte, Next.js). Fichiers de `public/` (`/brand`, `/fonts`, `/marketing`, `/providers`), dont les noms ne changent pas d'une version à l'autre : un jour, puis revalidés en arrière-plan une semaine (`next.config.ts`).
- Images optimisées (`/_next/image`) : cache de Next.js et de Vercel, sources limitées au CDN des fichiers (`images.remotePatterns`).
- Images de partage : adresses à empreinte, rendues à la demande.

## Sentry

- Avec `SENTRY_AUTH_TOKEN`, le build crée une version nommée par le commit (`SENTRY_RELEASE`, posé par le workflow, ou `VERCEL_GIT_COMMIT_SHA`), y envoie les cartes de sources du navigateur et du serveur, marque le déploiement (`NEXT_PUBLIC_SENTRY_ENVIRONMENT`, adresse du site), puis supprime les cartes du build : elles ne sont jamais servies (`next.config.ts` ; `check:bundles` échoue sur une carte parmi les fichiers publics).
- Sans jeton (CI, build local), aucune carte de sources du navigateur n'est produite.
- Le SDK n'envoie rien d'un membre (ADR 0091) et seulement avec un DSN.

## Vercel Analytics et Speed Insights

`NEXT_PUBLIC_VERCEL_ANALYTICS=true` en Preview et en Production. Leurs scripts et leurs envois passent par le site lui-même (`/_vercel/insights`, `/_vercel/speed-insights`) : aucune origine ajoutée à la CSP, aucun cookie ni identifiant persistant, donc aucun consentement (`docs/compliance/cookies.md`, ADR 0158). Les activer aussi dans le tableau de bord du projet Vercel.

## Déployer

1. **Préproduction** : automatique. Quand la CI d'un commit de `main` ou d'une pull request est verte, le job `preview` construit ce commit avec les variables Preview (`vercel pull`, `vercel build`) et le déploie (`vercel deploy --prebuilt`) ; l'adresse figure dans le résumé du run. Un déploiement de `main` reçoit ensuite le domaine fixe de la préproduction (`vercel alias set`, variable `VERCEL_STAGING_DOMAIN`).
2. **Production** : `gh workflow run deploy-web.yaml -f ref=<commit ou étiquette>` ; le job vérifie que la CI de ce commit est verte, attend l'approbation de l'environnement `production` de GitHub, construit avec les variables Production et déploie (`--prod`).
3. Après chaque mise en production : en-têtes de sécurité et CSP sans violation (console, rapports Sentry), `robots.txt` et `sitemap.xml` sur le domaine définitif, une image de partage, la connexion (Turnstile, OAuth), les langues actives, un événement de test dans Sentry avec sa pile lisible.

Ordre avec l'api : une version de l'api compatible avec le web déployé d'abord (migrations « expand », `docs/operations/deployment.md`), puis le web.

## Revenir en arrière

- Immédiat : `vercel rollback <adresse du déploiement précédent> --token=<jeton>` (ou « Instant Rollback » dans le tableau de bord) remet le déploiement de production précédent sur le domaine, sans rebuild.
- Durable : redéployer le commit voulu par le workflow (`-f ref=<commit>`), après avoir annulé la cause sur `main`.
- Un retour arrière du web ne touche pas l'api ; si l'api a changé de contrat, revenir aussi sur l'api (version précédente de l'image), les migrations « expand » restant compatibles.

## GitHub

- Variables du dépôt : `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (sans elles, le workflow ne fait rien), `VERCEL_STAGING_DOMAIN` (domaine fixe de la préproduction).
- Environnements : `preview` (secret `VERCEL_TOKEN`, jeton limité à l'équipe du projet) et `production` (même secret, relecteurs obligatoires). Aucun secret de l'application dans GitHub : les variables vivent dans Vercel.
