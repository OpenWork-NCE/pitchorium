# 0103. Cloudflare Turnstile contre les inscriptions et signalements automatisés

Statut : acceptée (2026-10-09).

## Contexte

La demande d'origine exige une protection anti-spam. Les routes qui créent un compte, essaient un mot de passe ou envoient un email à une adresse saisie par n'importe qui (inscription, connexion par email, lien magique, réinitialisation) et le signalement sans compte (`POST /v1/public/reports`) sont ouvertes à tous. La limite de fréquence par adresse IP (`AUTH_RATE_LIMIT_*`, 5 signalements par heure) ne suffit pas contre un robot qui change d'adresse.

## Décision

- Cloudflare Turnstile, sans traceur publicitaire ni puzzle par défaut, avec des clés de test officielles qui interrogent le vrai `siteverify`.
- Activé par ses deux clés (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) : les deux ou aucune. Sans clé (local, tests), aucune vérification. En production, l'api refuse de démarrer sans elles.
- `/v1/auth` : plugin `captcha` de Better Auth, sur `/sign-up/email`, `/sign-in/email`, `/sign-in/magic-link` et `/request-password-reset` (`CAPTCHA_PATHS`). Jeton dans l'en-tête `X-Captcha-Response` ; codes `MISSING_RESPONSE` (400), `VERIFICATION_FAILED` (403), `UNKNOWN_ERROR` (500, Cloudflare injoignable) au format de Better Auth, traduits sous `errors.auth`.
- La vérification échoue fermée après 10 secondes.
- OAuth n'est pas vérifié : le fournisseur porte déjà sa protection, et le bouton doit rester immédiat (§7.2).
- `GET /v1/auth-configuration` (public, cache 60 s) donne au web ce qu'il affiche avant toute session, sans secret : fournisseurs OAuth activés dans l'ordre des boutons, clé publique et apparence de Turnstile (`TURNSTILE_APPEARANCE` : `interaction-only`, discret, visible seulement quand Cloudflare demande une interaction ; `always`, managé), versions des conditions en vigueur, longueur minimale du mot de passe.

## Conséquences

- Le web charge le script de Cloudflare sur les écrans concernés seulement, et l'ajoute à sa CSP (`challenges.cloudflare.com`).
- Les tests d'intégration (`turnstile.spec.ts`) dépendent du réseau vers `challenges.cloudflare.com`, comme les tests des prestataires.
- Un client sans navigateur (script, application tierce) ne peut plus s'inscrire par email en production : voulu.
