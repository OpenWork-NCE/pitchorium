# 0091. Observabilité du web

Statut : acceptée (2026-10-08).

## Contexte

Les erreurs du navigateur et du rendu serveur doivent remonter, sans exposer de donnée de membre et sans alourdir la première visite. L'hébergeur du web n'est pas choisi (question 24).

## Décision

- Sentry (`@sentry/nextjs` 11.5) actif seulement si `NEXT_PUBLIC_SENTRY_DSN` est défini : côté serveur par `instrumentation.ts` (`onRequestError`), côté navigateur par `instrumentation-client.ts`, chargé après la page. Aucune donnée identifiante : ni utilisateur, ni cookie, ni en-tête, ni corps, ni paramètre de requête (`lib/observability/sentry.ts`). Cartes de sources envoyées seulement si le build a un jeton (`SENTRY_AUTH_TOKEN`).
- Vercel Analytics et Speed Insights montés seulement si `NEXT_PUBLIC_VERCEL_ANALYTICS=true` (déploiement sur Vercel).
- Les violations de CSP partent vers l'adresse de rapport de Sentry quand un DSN existe.

## Conséquences

- Sans DSN, aucune ligne du SDK n'est téléchargée par le navigateur.
- Une erreur survenue avant le chargement différé du SDK n'est pas rapportée par le navigateur (le rendu serveur reste couvert).
