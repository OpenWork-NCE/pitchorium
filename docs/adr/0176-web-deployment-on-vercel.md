# 0176. Déploiement du web sur Vercel

Statut : acceptée (2026-10-12), sous réserve de la question 96.

## Contexte

L'application web (Next.js 16) doit pouvoir être mise en ligne dès que les comptes du client existent. Le prompt de livraison vise Vercel ; le client n'a pas tranché l'hébergement du web (question 96). Les pages portent un nonce par requête (ADR 0088), les variables publiques sont inscrites au build, Sentry publie ses versions et ses cartes de sources au build.

## Décision

- Vercel, projet à la racine `apps/web` (`vercel.json`), région `cdg1` provisoire (question 146). Les déploiements automatiques de Vercel sont coupés : `.github/workflows/deploy-web.yaml` déploie la préproduction après chaque CI verte (`vercel build` puis `vercel deploy --prebuilt`, variables de l'environnement Preview, domaine fixe pour `main`) et la production à la main, après vérification de la CI du commit et approbation de l'environnement GitHub `production`. GitHub ne garde que le jeton de Vercel ; les variables de l'application vivent dans Vercel, séparées par environnement.
- Cache : aucune page en cache partagé (nonce) ; les lectures publiques sans lecteur passent par le cache de données de Next.js sans les en-têtes du visiteur (`sharedRead`) ; fichiers de `public/` un jour et revalidés ; `/_next/static` immuable.
- Sentry : version nommée par le commit, cartes de sources produites seulement avec le jeton, envoyées puis supprimées ; `check:bundles` refuse une carte parmi les fichiers publics.
- Vercel Analytics et Speed Insights servis par le site (`/_vercel/*`) : aucune origine dans la CSP, aucun consentement (ADR 0158).
- Procédure, retour arrière et vérifications : `docs/operations/deployment-web.md`.

## Conséquences

- Un conteneur `next start` reste possible : les en-têtes de cache et de sécurité sont dans `next.config.ts`, indépendants de l'hébergeur.
- Le workflow ne fait rien tant que le projet Vercel n'existe pas (variables du dépôt absentes) ; son premier passage réel reste à vérifier avec les comptes du client.
