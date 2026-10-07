# Module organizations

Pages organisation (cahier des charges §5, §10.7, §13) : fondations, entreprises, ONG, institutions. Une organisation est une entité, pas une donnée personnelle : sa page est publique par défaut ; ses membres gardent la confidentialité de leur profil (ADR 0025).

## Organisation

- Nom, slug unique (dérivé du nom par `slugify` du kernel, `-2`, `-3`... en cas d'homonymie), type de structure (liste du volet contributeur), description (2 600 caractères), pays ISO 3166-1 (un ou plusieurs), secteurs (données de référence de profiles), site web https, année de création, logo et couverture (module media, usages `organization_logo` et `organization_cover`).
- Slug modifiable ; les anciens slugs restent attribués à l'organisation et redirigent (301) vers l'actuel ; liste de mots réservés (`domain/organization.ts`).
- Création réservée aux membres à l'email vérifié ; le créateur devient `owner` ; au plus `ORGANIZATIONS_MAX_CREATED_PER_USER` organisations créées et non supprimées par membre.
- Suppression logique par un `owner` : la page répond 404, le slug reste réservé, les invitations en attente sont révoquées, le logo et la couverture détachés, les volets contributeur des membres déliés.

## Membres et rôles internes

- `owner` : tout ; `admin` : modifier la page, inviter, gérer les `admin` et les `member` (jamais un `owner`, ni nommer un `owner`) ; `member` : lire et partir.
- Une organisation garde toujours au moins un `owner` : retrait, départ ou rétrogradation du dernier `owner` refusés (`ORGANIZATIONS_LAST_OWNER`). Les écritures de rôles d'une organisation sont sérialisées par un verrou transactionnel.
- Transfert de propriété : un `owner` désigne un autre membre, qui devient `owner` ; l'ancien reste `admin`.
- Invitation par email (`admin` ou `member`), pour un membre existant ou une personne sans compte. Le worker crée le jeton (32 octets aléatoires, seul son empreinte SHA-256 est stockée) au moment d'envoyer l'email, qui contient le lien `<WEB_APP_URL>/invitations/<jeton>`. Valable `ORGANIZATIONS_INVITATION_TTL_DAYS` jours, à usage unique ; une nouvelle invitation à la même adresse remplace la précédente. Acceptation ou refus par un compte dont l'email vérifié est l'adresse invitée, après inscription le cas échéant.
- Lien avec le volet contributeur : l'organisation enregistre auprès de profiles un annuaire (`OrganizationDirectory`) ; un membre peut lier son volet contributeur à une organisation dont il est membre. Un membre qui part ou est retiré, ou une organisation supprimée, délie le volet.

## Vérification et badge

- Statuts : `unverified`, `pending`, `verified`, `rejected`, `revoked` ; transitions dans `domain/verification.ts` (demande depuis `unverified`, `rejected` ou `revoked` ; décision sur `pending` ; révocation de `verified`).
- Demande par un `owner` à l'email vérifié : déclaration, certification, 1 à 10 pièces justificatives (usage media `verification_document`, toujours privé), attachées à la demande. Une seule demande en attente par organisation. Les pièces d'une demande décidée lui restent attachées (trace de la décision) : une nouvelle demande joint de nouvelles pièces.
- Signal automatique non décisif : un membre a un email vérifié sur le domaine du site web (`memberEmailOnWebsiteDomain`).
- Revue par un `moderator` ou un `admin` avec double authentification : file, décision motivée (`approved` ou `rejected`) avec les critères cochés parmi `ORGANIZATIONS_VERIFICATION_CRITERIA` (liste vide par défaut, critères non définis par le cahier des charges), révocation motivée.
- Pièces justificatives lisibles (URL présignée du module media) par les `owner` et `admin` de l'organisation et par les modérateurs et administrateurs avec double authentification.
- Journal d'audit : `organizations.verification-requested`, `-approved`, `-rejected`, `-revoked` (acteur, motif, critères).

## Visibilité

- `GET /v1/public/organizations/{slug}` : sans compte, `Cache-Control: public, max-age=60` ; seuls les membres dont la page publique de profil est activée sont listés.
- `GET /v1/organizations/by-slug/{slug}` : membres connectés ; tous les membres, avec le rôle du lecteur (`viewerRole`).
- Projets portés et soutenus : `projects.carried` et `projects.supported`, fournis par les modules projects et payments via `registerProjectsProvider` ; le module projects donne les projets publiés et visibles portés par l'organisation, les projets soutenus restent vides jusqu'au module payments.

## Routes

- `POST /v1/organizations` (`organization.create`, `Idempotency-Key`), `GET /v1/me/organizations`, `GET /v1/organizations/by-slug/{slug}`, `GET /v1/public/organizations/{slug}` (public)
- `PATCH /v1/organizations/{organizationId}`, `PUT /v1/organizations/{organizationId}/slug`, `PUT|DELETE /v1/organizations/{organizationId}/logo` et `/cover` (`organization.update`), `DELETE /v1/organizations/{organizationId}` (`organization.delete`)
- `PATCH|DELETE /v1/organizations/{organizationId}/members/{userId}` (`organization.member.manage`), `POST /v1/organizations/{organizationId}/leave` (`organization.member.leave`), `POST /v1/organizations/{organizationId}/ownership-transfer` (`organization.ownership.transfer`)
- `POST|GET /v1/organizations/{organizationId}/invitations`, `DELETE /v1/organizations/{organizationId}/invitations/{invitationId}` (`organization.member.invite`), `POST /v1/organization-invitations/accept` et `/decline` (`organization.invitation.respond`)
- `POST /v1/organizations/{organizationId}/verification-requests` (`organization.verification.request`, `Idempotency-Key`), `GET /v1/organization-verification-requests?status=`, `GET /v1/organization-verification-requests/{requestId}`, `POST /v1/organization-verification-requests/{requestId}/decision`, `POST /v1/organizations/{organizationId}/verification-revocation` (`organization.verification.review`)

Les routes `{organizationId}` passent par `OrganizationResolver`, qui donne au module access le rôle du membre dans l'organisation (`resourceRoles` des politiques).

## Schéma `organizations`

`organizations`, `slug_history`, `members` (clé : organisation et utilisateur), `invitations` (empreinte du jeton, une seule invitation en attente par adresse), `verification_requests` (une seule en attente par organisation, signaux, décision).

## Façade publique (`index.ts`)

`OrganizationsFacade` : `roleOf`, `summaries`, `cards` (nom, slug, type de structure, logo public, badge), `idsBySlugs` (slugs actuels, pour les mentions), `registerProjectsProvider` ; interface `OrganizationProjectsProvider` ; classes d'événements.

## Événements émis

| Type                                      | Payload                                      |
| ----------------------------------------- | -------------------------------------------- |
| `organizations.organization.created.v1`   | `slug`, `createdBy`                          |
| `organizations.organization.updated.v1`   | `fields` (dont `slug`, `logo`, `cover`)      |
| `organizations.organization.deleted.v1`   | `deletedBy`                                  |
| `organizations.member.invited.v1`         | `invitationId`, `role`, `invitedBy`          |
| `organizations.member.joined.v1`          | `userId`, `role`, `invitationId`             |
| `organizations.member.left.v1`            | `userId`, `reason` (`left`, `removed`), `by` |
| `organizations.member.role-changed.v1`    | `userId`, `previousRole`, `role`, `by`       |
| `organizations.ownership.transferred.v1`  | `fromUserId`, `toUserId`                     |
| `organizations.verification.requested.v1` | `requestId`, `requestedBy`                   |
| `organizations.verification.approved.v1`  | `requestId`, `decidedBy`                     |
| `organizations.verification.rejected.v1`  | `requestId`, `decidedBy`                     |
| `organizations.verification.revoked.v1`   | `revokedBy`, `reason`                        |

## Événements consommés

Les siens, par le worker (handler `organizations.send-emails`) : invitation (avec création du jeton), acceptation (aux `owner` et à l'auteur de l'invitation), changement de rôle (au membre), transfert de propriété (aux deux membres), demande, décision et révocation de vérification (aux `owner`). Emails FR et EN (`@pitchorium/emails`, `organization-notice`).

## Dépendances

identity (emails des membres et des invités), access (rôles de plateforme des relecteurs), profiles (données de référence, cartes des membres, lien du volet contributeur), media (logo, couverture, pièces justificatives), network (enregistrement du type de cible de suivi `organization` au démarrage : une organisation se suit par son identifiant, ADR 0027).
