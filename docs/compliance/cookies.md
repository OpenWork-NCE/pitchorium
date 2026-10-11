# Cookies et traceurs

Inventaire de ce que l'application web dépose ou lit sur l'appareil, et décision sur le consentement (ADR 0158). Page publique : `/legal/cookies` (`apps/web/content/legal/<langue>/cookies.md`), à valider par le conseil juridique.

## Premier tiers

- `pitchorium.session_token` (cookie, `__Secure-` en HTTPS) : session d'un membre, posé par l'api (Better Auth). Strictement nécessaire.
- `NEXT_LOCALE` (cookie, un an) : langue choisie. Demandé par la personne.
- `pitchorium.tz` (cookie, un an) : fuseau d'affichage des heures. Nécessaire à l'affichage demandé.
- Thème (`localStorage`, next-themes) : choix clair ou sombre. Demandé par la personne.
- Brouillons de publication et de message, mutations en attente (IndexedDB) : effacés à la publication, à l'envoi, à la déconnexion et après 24 h pour les mutations (ADR 0102, 0147).
- Recherches récentes (`localStorage`) : effacées à la déconnexion (ADR 0150).

## Services tiers

- Vercel Analytics et Speed Insights (`NEXT_PUBLIC_VERCEL_ANALYTICS`) : sans cookie ni identifiant persistant.
- Sentry (`NEXT_PUBLIC_SENTRY_DSN`) : `dataCollection` sans cookies, en-têtes, corps, paramètres d'adresse ni données de l'utilisateur ; pas d'enregistrement de session.
- Cloudflare Turnstile (connexion, inscription) : protection contre les robots, nécessaire à la sécurité.
- Vidéos de projet : iframe au clic seulement, `youtube-nocookie.com` et Vimeo avec `dnt=1` (ADR 0129).

## Décision

Aucun traceur soumis au consentement : aucun bandeau. Un nouveau service qui en dépose un impose un consentement préalable, avec un refus aussi simple que l'acceptation, et la mise à jour de cet inventaire, de la page et de l'ADR 0158 dans le même commit.
