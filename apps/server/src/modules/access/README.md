# Module access

Autorisations (cahier des charges §7.3, §13) : refus par défaut, registre central d'actions, rôles, niveaux de confiance et prérequis (ADR 0015).

## Responsabilité

- Garde global de l'api (`AuthenticationGuard`) :
  1. une écriture authentifiée par cookie doit venir d'une origine de confiance (`AUTH_TRUSTED_ORIGINS`, à défaut `CORS_ORIGINS`, plus `WEB_APP_URL` et `API_PUBLIC_URL`), sinon `ACCESS_ORIGIN_NOT_ALLOWED` ;
  2. une route non marquée `@Public()` exige une session, sinon `UNAUTHENTICATED` ;
  3. elle doit déclarer son action avec `@RequireAction()`, sinon `FORBIDDEN` ; la politique de l'action est alors évaluée.
- Registre des actions (`domain/action-policies.ts`, noms dans `@pitchorium/contracts`) : rôles admis, propriété de la ressource, prérequis, exigence des conditions acceptées, suspension, audit des refus.
- Rôles : `member` (implicite), `moderator`, `admin`. Un rôle privilégié exige la double authentification. Attribuer un rôle ferme toutes les sessions du compte (rotation à l'élévation de privilège). Le dernier administrateur ne peut pas être retiré. Le premier administrateur est créé par la commande `pnpm admin:create --email <email>` (idempotente), jamais par l'api.
- Niveaux de confiance : `email_verified` (identity), `kyc_verified` (port `KycStatusProvider` : le module payments enregistre sa source au démarrage par `AccessFacade.registerKycStatusProvider` ; sans source, personne n'est vérifié), suspension (port `AccountStatusProvider` : le module trust enregistre sa source au démarrage par `AccessFacade.registerAccountStatusSource` ; un membre suspendu n'a plus accès qu'aux actions marquées `allowWhenSuspended` : compte, conditions, préférences, notifications (l'avis de suspension y arrive), sa situation de modération, l'appel, l'export et la suppression de ses données).
- Prérequis : une action refusée pour des éléments manquants renvoie `ACCESS_PREREQUISITES_MISSING` avec `missing` (`legal_acceptance`, `email_verified`, `kyc_verified`, `two_factor`, `profile.entrepreneur_facet`, `profile.contributor_facet`, `payout_account`). Les éléments `profile.*` sont fournis par le module profiles, `payout_account` (compte de versement actif) par le module payments, via `PrerequisiteProvider`. L'action `payment.collection.open` n'est portée par aucune route : `GET /v1/me/prerequisites/payment.collection.open` dit au porteur ce qui manque avant l'ouverture des contributions encaissées (email vérifié, volet entrepreneur, KYC, compte de versement).
- Session récente : une action marquée `recentAuthentication` (rôles, remboursements, flags, suppression de compte, remboursements d'un projet gelé) exige une session ouverte depuis moins de `ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES` (15 minutes par défaut) ; sinon `403 ACCESS_REAUTHENTICATION_REQUIRED`, et le client fait se reconnecter le membre (`/v1/auth/sign-in/*`), ce qui ouvre une nouvelle session.
- Journal d'audit : attribution et retrait de rôle, refus d'une action sensible.
- Handshake Socket.IO (`SessionHandshakeGuard`) : session et origine de confiance exigées sur tous les namespaces sauf `/system`.

## Routes

- `GET /v1/me/prerequisites/{action}` : ce que le membre doit compléter avant une action. Pour une action réservée à un rôle porté sur une ressource (`project.publish` pour le propriétaire d'un projet, par exemple), la réponse vaut pour un membre qui détient ce rôle : le rôle n'est pas un élément à compléter.
- `GET /v1/admin/members/{userId}/roles`, `POST /v1/admin/members/{userId}/roles`, `DELETE /v1/admin/members/{userId}/roles/{role}` : administrateurs avec 2FA.

## Schéma `access`

`role_assignments` (`user_id`, `role`, `granted_at`, `granted_by`), sans clé étrangère vers identity (ADR 0002).

## Façade publique (`index.ts`)

`AccessFacade` (`rolesOf`, `trustLevels`, `registerPrerequisiteProvider`, `registerKycStatusProvider`, `registerAccountStatusSource`), `CurrentActor`, type `Actor`, interfaces `PrerequisiteProvider`, `KycStatusSource` et `AccountStatusSource`, `SessionHandshakeGuard`, `AdminBootstrapService` (commande), événements `RoleGranted` et `RoleRevoked`.

## Événements émis

| Type                     | Payload             |
| ------------------------ | ------------------- |
| `access.role.granted.v1` | `role`, `grantedBy` |
| `access.role.revoked.v1` | `role`, `revokedBy` |

## Événements consommés

Aucun.

## Dépendances

identity (session, utilisateur, révocation des sessions).

## Données personnelles (RGPD)

Export : rôles de plateforme. Suppression : rôles retirés, `granted_by` pseudonymisé. Contrats enregistrés auprès du module privacy (`infrastructure/access-personal-data.ts`, ADR 0074).
