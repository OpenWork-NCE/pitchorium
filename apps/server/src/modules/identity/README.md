# Module identity

Comptes et authentification (cahier des charges §7) avec Better Auth 1.7, monté sur `/v1/auth` (ADR 0013).

## Responsabilité

- Inscription sans choix de rôle ni champ obligatoire hors identité : Google, LinkedIn (OpenID Connect), Microsoft (Entra ID, tenant `common`), email et mot de passe, lien magique. Un fournisseur OAuth n'est actif que si ses identifiants sont configurés.
- Mot de passe de 12 caractères minimum, refus des mots de passe compromis (Have I Been Pwned, k-anonymat, `AUTH_PWNED_PASSWORD_CHECK`), réinitialisation par lien à usage unique valable 30 minutes ; toutes les sessions sont fermées après une réinitialisation.
- Vérification d'email (lien valable 24 h) ; un email assuré vérifié par Google, ou par LinkedIn via `email_verified`, est vérifié d'office. Microsoft ne l'est jamais.
- Liaison de comptes (ADR 0014) : implicite pour Google et LinkedIn seulement si les deux emails sont vérifiés ; jamais pour Microsoft ; liaison et déliaison manuelles depuis le compte connecté, la dernière méthode ne peut pas être retirée.
- Sessions : cookie `pitchorium.session_token` (`__Secure-` en HTTPS), `HttpOnly`, `SameSite=Lax`, domaine parent `AUTH_COOKIE_DOMAIN` ; 30 jours, prolongées chaque jour d'usage ; liste et révocation unitaire ou globale par Better Auth.
- Double authentification TOTP avec codes de secours (Better Auth `two-factor`) ; exigée pour les rôles `moderator` et `admin` par le module access.
- Acceptation versionnée des CGU et de la politique de confidentialité, et déclaration d'âge (18 ans) ; versions en vigueur fournies par `LEGAL_TERMS_VERSION` et `LEGAL_PRIVACY_VERSION`.
- Locale du compte : déduite de `Accept-Language` à l'inscription parmi les locales actives (flags `locale.*`), modifiable par `PUT /v1/me/preferences`.
- Emails transactionnels (FR et EN, `@pitchorium/emails`) : vérification, lien magique, réinitialisation et nouvelle connexion envoyés par l'api après la réponse ; changement de méthode de connexion envoyé par le worker.
- Façade et événement préparés pour la suppression de compte (`requestAccountDeletion`), sans suppression : elle viendra avec le module privacy.

## Routes

- `/v1/auth/*` : Better Auth (format d'erreur Better Auth `{ code, message }`, hors OpenAPI). Principales : `sign-up/email`, `sign-in/email`, `sign-in/social`, `callback/:provider`, `sign-in/magic-link`, `magic-link/verify`, `verify-email`, `send-verification-email`, `request-password-reset`, `reset-password`, `change-password`, `set-password`, `list-sessions`, `revoke-session`, `revoke-sessions`, `revoke-other-sessions`, `list-accounts`, `link-social`, `unlink-account`, `two-factor/*`, `sign-out`.
- `GET /v1/legal-documents/current` (public), `POST /v1/me/legal-acceptances`, `PUT /v1/me/preferences`.

## Schéma `identity`

`users`, `sessions`, `accounts`, `verifications`, `two_factors` (modèles Better Auth, identifiants UUIDv7 générés par l'application), `legal_acceptances` (historique append-only).

## Façade publique (`index.ts`)

- `IdentityFacade` : `findUser`, `findUserByEmail`, `activeLocales`, `legalStatus`, `revokeAllSessions(userId, reason)`, `requestAccountDeletion(userId)`.
- `SessionAuthenticator` (api) : session portée par les cookies d'une requête HTTP ou d'un handshake Socket.IO.
- Classes d'événements ci-dessous (constante `TYPE`).

## Événements émis

| Type                                  | Payload                                    |
| ------------------------------------- | ------------------------------------------ |
| `identity.user.registered.v1`         | `method`, `locale`, `emailVerified`        |
| `identity.user.email-verified.v1`     | aucun                                      |
| `identity.account.linked.v1`          | `provider`                                 |
| `identity.account.unlinked.v1`        | `provider`                                 |
| `identity.user.password-changed.v1`   | `reason` (`changed`, `reset`)              |
| `identity.user.sessions-revoked.v1`   | `scope` (`one`, `others`, `all`), `reason` |
| `identity.user.deletion-requested.v1` | aucun                                      |

L'agrégat est l'utilisateur (`aggregateId`). Les écritures de Better Auth et ces événements sont validés dans la même transaction (une transaction par requête `/v1/auth`).

## Événements consommés

`identity.account.linked.v1`, `identity.account.unlinked.v1`, `identity.user.password-changed.v1` : email « méthodes de connexion modifiées » (handler `identity.sign-in-method-email`, worker).

## Dépendances

Aucun module métier.
