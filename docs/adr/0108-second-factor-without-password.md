# 0108. Double authentification d'un compte sans mot de passe

Statut : acceptée (2026-10-09). Ferme la question ouverte 107. Complète les ADR 0015 et 0104.

## Contexte

Un compte ouvert par Google, LinkedIn ou Microsoft n'a pas de mot de passe. Better Auth confirmait l'activation de la double authentification par le mot de passe : un tel membre ne pouvait pas l'activer, et un `moderator` ou un `admin` inscrit ainsi restait bloqué hors de l'administration (ADR 0015). Deux voies étaient possibles avec Better Auth :

1. définir d'abord un mot de passe, après une réauthentification récente et une confirmation par email, puis activer la double authentification avec lui ;
2. activer la double authentification sur une session fraîche, sans mot de passe (option `allowPasswordless` du plugin `two-factor`).

L'examen a révélé un défaut plus grave : le plugin ne demande le code qu'après `/sign-in/email`. Une connexion par un fournisseur, par un lien de connexion ou après la vérification d'une adresse ouvrait une session complète sans code, et le module access ne regarde que `twoFactorEnabled`. La double authentification d'un compte se contournait donc par un autre moyen de connexion, quelle que soit la voie choisie pour l'activer.

## Décision

- Voie 2 : un compte sans mot de passe active, désactive ou régénère ses codes de secours depuis une session ouverte depuis moins de `ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES` (15 minutes), le délai des actions sensibles ; au-delà, `SESSION_NOT_FRESH`, et le web propose de se reconnecter puis de revenir. Un compte qui a un mot de passe le donne toujours.
- La voie 1 est écartée : elle ajoute un secret réutilisable, hameçonnable et à protéger (compromission, réinitialisation par email), à un compte qui n'en avait pas, pour confirmer une seule opération que la fraîcheur de la session, obtenue par le fournisseur lui-même, confirme aussi bien.
- Le code est demandé après chaque moyen de connexion : le plugin `pitchorium-second-factor` (`infrastructure/better-auth/second-factor.ts`) reprend le défi du plugin après `/callback/:id`, `/magic-link/verify`, `/verify-email` et `/sign-in/social` : la session ouverte est supprimée, un cookie de défi signé (10 minutes, compteur de tentatives) est posé, et le navigateur va à `/{locale}/sign-in/two-factor?redirectTo=...` du web (une connexion directe par jeton reçoit `twoFactorRedirect`, comme pour le mot de passe). Aucun « appareil de confiance » n'est proposé.

## Conséquences

- Un membre inscrit par un fournisseur active la double authentification dans la section Sécurité des paramètres ; un rôle privilégié inscrit ainsi accède à l'administration.
- Activer la double authentification protège désormais toutes les connexions, quel que soit le moyen.
- Tests : `test/integration/identity.spec.ts` (session récente exigée, mot de passe toujours demandé quand il existe, défi après un fournisseur et après un lien) et `second-factor.spec.ts` (adresse de la page du code, même origine seulement) ; parcours réel dans `e2e-live`.
