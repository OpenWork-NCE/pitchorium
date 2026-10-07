# 0021. En-tête Origin et clients non navigateur

Statut : acceptée (2026-10-07)

## Contexte

La session est un cookie `HttpOnly` envoyé automatiquement par le navigateur. Sans contrôle, un site tiers peut faire envoyer une écriture authentifiée (CSRF) ou connecter la victime à un compte de l'attaquant (login CSRF). Better Auth ne vérifie pas l'origine sur tous ses endpoints (`sign-out` par exemple).

## Décision

- Toute écriture sur `/v1/auth` (méthode autre que `GET`, `HEAD`, `OPTIONS`) exige un en-tête `Origin`, à défaut `Referer`, appartenant aux origines de confiance (`AUTH_TRUSTED_ORIGINS`, à défaut `CORS_ORIGINS`, plus `WEB_APP_URL` et `API_PUBLIC_URL`), même sans cookie : la connexion et l'inscription sont aussi protégées. Sinon `403 ACCESS_ORIGIN_NOT_ALLOWED`.
- Sur les autres routes, le contrôle s'applique aux écritures qui portent un cookie de session (garde du module access).
- Le handshake Socket.IO d'un membre exige la même origine de confiance.

## Conséquences

- Seul un navigateur sur une origine de confiance peut s'authentifier. Un client non navigateur (script, intégration partenaire, outil en ligne de commande) n'envoie pas d'`Origin` et ne peut ni se connecter ni écrire avec un cookie. Les applications natives sont exclues du périmètre ; les tâches d'exploitation passent par des commandes (`pnpm admin:create`), pas par l'api.
- Stratégie prévue le jour où un client non navigateur sera nécessaire : client enregistré (identifiant et secret, ou flux d'autorisation d'appareil) qui obtient un jeton porteur de courte durée, envoyé dans `Authorization: Bearer` sans cookie. Une requête sans cookie n'étant pas exposée au CSRF, elle sera dispensée du contrôle d'origine ; le garde du module access acceptera alors un second mode d'authentification, avec ses propres portées et limites de débit. Ce mode fera l'objet d'un ADR dédié et n'est pas implémenté.
- Les tests d'intégration simulent le navigateur en envoyant l'`Origin` de l'application web.
