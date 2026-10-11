# 0158. Cookies et consentement : aucun bandeau

Statut : acceptée (2026-10-11), à valider par le conseil juridique (question 135).

## Contexte

Un traceur qui n'est ni strictement nécessaire ni demandé par la personne exige un consentement préalable (directive ePrivacy, article 5(3), lignes directrices de la CNIL). Inventaire de ce que dépose le web :

- **Premier tiers** : cookie de session `pitchorium.session_token` (authentification), `NEXT_LOCALE` (langue choisie), `pitchorium.tz` (fuseau d'affichage), thème (`localStorage`, next-themes), brouillons et mutations en attente (IndexedDB, effacés à la déconnexion et après 24 h, ADR 0102), recherches récentes (`localStorage`, effacées à la déconnexion).
- **Vercel Analytics et Speed Insights** (si `NEXT_PUBLIC_VERCEL_ANALYTICS`) : sans cookie ni identifiant persistant sur l'appareil.
- **Sentry** (si un DSN est configuré) : `dataCollection` sans cookies, en-têtes, corps ni données de l'utilisateur, sans enregistrement de session (replay).
- **Cloudflare Turnstile** (connexion, inscription) : protection contre les robots, nécessaire à la sécurité du service.
- **Vidéos de projet** : façade, iframe seulement au clic, YouTube en variante `youtube-nocookie.com`, Vimeo avec `dnt=1` (ADR 0129).

## Décision

- Tous ces traceurs sont strictement nécessaires, demandés par la personne ou exemptés (mesure d'audience sans cookie ni identifiant) : aucun bandeau de consentement n'est affiché.
- La politique de cookies (`/legal/cookies`) documente cet inventaire ; elle est marquée à valider.
- Tout nouveau service tiers qui dépose un traceur soumis au consentement impose, dans le même commit, un consentement préalable avec un refus aussi simple que l'acceptation, et la mise à jour de cet ADR et de la politique.

## Conséquences

- Aucun code de consentement dans le premier chargement.
- `docs/compliance/cookies.md` tient l'inventaire à jour.
