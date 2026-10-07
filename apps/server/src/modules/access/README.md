# Module access

Autorisations (cahier des charges §7.3, §13) : refus par défaut, registre central d'actions, rôles, niveaux de confiance et prérequis (ADR 0015).

## Responsabilité

- Garde global de l'api (`AuthenticationGuard`) :
  1. une écriture authentifiée par cookie doit venir d'une origine de confiance (`AUTH_TRUSTED_ORIGINS`, à défaut `CORS_ORIGINS`, plus `WEB_APP_URL` et `API_PUBLIC_URL`), sinon `ACCESS_ORIGIN_NOT_ALLOWED` ;
  2. une route non marquée `@Public()` exige une session, sinon `UNAUTHENTICATED` ;
  3. elle doit déclarer son action avec `@RequireAction()`, sinon `FORBIDDEN` ; la politique de l'action est alors évaluée.
- Registre des actions (`domain/action-policies.ts`, noms dans `@pitchorium/contracts`) : rôles admis, propriété de la ressource, prérequis, exigence des conditions acceptées, suspension, audit des refus.
- Rôles : `member` (implicite), `moderator`, `admin`. Un rôle privilégié exige la double authentification. Attribuer un rôle ferme toutes les sessions du compte (rotation à l'élévation de privilège). Le dernier administrateur ne peut pas être retiré. Le premier administrateur est créé par la commande `pnpm admin:create --email <email>` (idempotente), jamais par l'api.
- Niveaux de confiance : `email_verified` (identity), `kyc_verified` (port `KycStatusProvider`, adaptateur « jamais vérifié » jusqu'au module payments), suspension (port `AccountStatusProvider`, adaptateur « jamais suspendu » jusqu'au module trust).
- Prérequis : une action refusée pour des éléments manquants renvoie `ACCESS_PREREQUISITES_MISSING` avec `missing` (`legal_acceptance`, `email_verified`, `kyc_verified`, `two_factor`, `profile.entrepreneur_facet`, `profile.contributor_facet`). Les éléments `profile.*` sont fournis par le module profiles via `PrerequisiteProvider`.
- Journal d'audit : attribution et retrait de rôle, refus d'une action sensible.
- Handshake Socket.IO (`SessionHandshakeGuard`) : session et origine de confiance exigées sur tous les namespaces sauf `/system`.

## Routes

- `GET /v1/me/prerequisites/{action}` : ce que le membre doit compléter avant une action.
- `GET /v1/access/users/{userId}/roles`, `POST /v1/access/users/{userId}/roles`, `DELETE /v1/access/users/{userId}/roles/{role}` : administrateurs avec 2FA.

## Schéma `access`

`role_assignments` (`user_id`, `role`, `granted_at`, `granted_by`), sans clé étrangère vers identity (ADR 0002).

## Façade publique (`index.ts`)

`AccessFacade` (`rolesOf`, `trustLevels`, `registerPrerequisiteProvider`), `CurrentActor`, type `Actor`, interface `PrerequisiteProvider`, `SessionHandshakeGuard`, `AdminBootstrapService` (commande), événements `RoleGranted` et `RoleRevoked`.

## Événements émis

| Type                     | Payload             |
| ------------------------ | ------------------- |
| `access.role.granted.v1` | `role`, `grantedBy` |
| `access.role.revoked.v1` | `role`, `revokedBy` |

## Événements consommés

Aucun.

## Dépendances

identity (session, utilisateur, révocation des sessions).
