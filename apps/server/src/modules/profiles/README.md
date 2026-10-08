# Module profiles

Profils personne (cahier des charges §5, §7.2, §10.1) : profil de base, volets entrepreneur et contributeur, intention, identifiant public, force du profil, confidentialité et données de référence (ADR 0016, 0017, 0018).

## Responsabilité

- Profil de base créé à l'inscription (handler de `identity.user.registered.v1`, et à la demande si le worker n'est pas encore passé) avec le nom et la photo du compte : nom affiché, titre (220 caractères), présentation (2 600), pays ISO 3166-1 et ville, langues ISO 639-1, liens https (site, LinkedIn), photo (`avatar_media_id`, et l'URL du fournisseur OAuth en repli), couverture (`cover_media_id`).
- Photo et couverture passent par le module media : le membre téléverse le fichier (usages `avatar`, `profile_cover`), puis l'attache au profil ; l'ancien fichier est détaché, puis supprimé par le nettoyage des orphelins. Photo et couverture sont des fichiers publics seulement quand la page publique est activée, privés sinon (URL présignées) ; activer ou désactiver la page les déplace d'un bucket à l'autre (ADR 0026). Les vues donnent `avatarUrl` et `coverUrl` (plus grande variante WebP) ; un fichier non prêt ou retiré par la modération retombe sur la photo du fournisseur.
- Import de la photo du fournisseur : à la création du profil (`profiles.profile.created.v1`), la photo OAuth est confiée au module media (`requestImport`), téléchargée par le worker depuis une liste fermée d'hôtes et traitée comme un téléversement ; une fois prête (`media.asset.ready.v1`), elle devient la photo du profil, sauf si le membre en a choisi une entre-temps. En cas d'échec, l'URL du fournisseur reste affichée.
- Intention (`carry_project`, `support_projects`, `both_or_exploring`) : facultative, modifiable, effaçable, sans effet sur les droits.
- Volet entrepreneur (minimal : entreprise, secteur, stade, pays de l'entreprise) : le pays de l'entreprise doit être en Afrique (M49 002) ou dans les Caraïbes (M49 029), la personne peut résider ailleurs ; besoins, expertises recherchées (texte libre), financement visé (`Money`).
- Volet contributeur (minimal : au moins une casquette et le type de structure) : organisation de la plateforme dont le membre fait partie (`organizationId`, vérifié auprès du module organizations) ou, à défaut, en texte libre ; pays d'intervention, secteurs, ticket (fourchette en unités mineures, même devise, min ≤ max), instruments, types de mécénat, mentorat, missions d'expertise. Les deux volets peuvent coexister.
- Correspondance besoin vers casquette pour le matching (`NEED_TO_HATS`, provisoire) : financement vers investisseur, don vers mécène ou donateur, mentorat vers mentor, expertise vers expert, partenariat commercial vers partenaire commercial, recrutement vers recruteur.
- Identifiant public (`handle`) : généré depuis le nom (`aissatou-ba`, puis `-2`, etc.), modifiable, liste de mots réservés ; les anciens identifiants restent attribués à leur titulaire et redirigent (301) vers l'actuel.
- Force du profil : calcul déterministe et pondérations provisoires dans `domain/profile-strength.ts` ; niveaux `beginner` (< 40 %), `intermediate` (≥ 40 %), `advanced` (≥ 70 %), `complete` (100 %).
- Confidentialité : page publique désactivée par défaut ; visibilité `public`, `members` ou `private` pour les détails du volet entrepreneur, ceux du volet contributeur et les listes de réseau (stockée ici, appliquée par le module network).
- Données de référence : pays et régions UN M49, secteurs (sections CITI/ISIC rév. 4, provisoires), stades (provisoires), libellés dans le namespace i18n `reference`.
- Prérequis `profile.entrepreneur_facet` et `profile.contributor_facet` fournis au module access.

## Routes

- `GET /v1/me` : utilisateur courant (identité, résumé du profil, rôles, niveaux de confiance, force du profil, locales actives, statut des conditions).
- `GET /v1/me/profile`, `PATCH /v1/me/profile`, `PUT /v1/me/intention`, `PUT /v1/me/profile/handle`, `PATCH /v1/me/profile/visibility`.
- `PUT|DELETE /v1/me/profile/avatar` et `/v1/me/profile/cover` (`{ mediaId }` d'un fichier prêt du membre).
- `POST|PATCH|DELETE /v1/me/profile/entrepreneur-facet` et `/v1/me/profile/contributor-facet` (`Idempotency-Key` sur `POST`).
- `GET /v1/profiles/{handle}` (membre ; 404 de part et d'autre d'un blocage), `GET /v1/public/profiles/{handle}` (sans compte, `Cache-Control: public, max-age=60`, 404 si la page publique est désactivée).
- `GET /v1/reference-data` (public, `Cache-Control: public, max-age=3600`).

## Schéma `profiles`

`profiles` (clé : identifiant de l'utilisateur), `handle_history`, `entrepreneur_facets`, `contributor_facets`, `countries`, `sectors`, `stages`.

## Façade publique (`index.ts`)

- `ProfilesFacade` : `sources` (profil de base et volets avec la visibilité de leurs détails, pour la projection de recherche du module discovery et les casquettes vérifiées par le module missions ; jamais montré tel quel à un autre membre), `userIdsAfter` (reconstruction de l'index), `assertCountries`, `assertSectors`, `countriesOutsideProjectRegions` (données de référence ; pays d'un projet hors Afrique et Caraïbes), `memberCards` (carte d'un membre : identifiant public, nom, titre, photo, page publique activée ou non), `userIdOf` (identifiant actuel ou ancien), `userIdsByHandles` (identifiants actuels, pour les mentions) ; ces trois méthodes acceptent un lecteur facultatif et omettent alors les membres qui lui sont masqués, `countryOf` (pays de résidence déclaré, pour les moyens de paiement proposés par le module payments), `visibilityOf` (réglages de confidentialité, dont la visibilité des listes de réseau appliquée par network), `visibleSectors` (secteurs des volets dont les détails ne sont pas privés, pour la mention anonymisée d'une visite privée), `unlinkOrganization`, `registerOrganizationDirectory`, `registerProfileViewListener`, `registerProfileAccessFilter`.
- Interface `ProfileViewListener`, implémentée et enregistrée par le module network : la lecture d'un profil par un autre membre (`GET /v1/profiles/{handle}`) lui est signalée sans attente ni échec possible de la lecture (ADR 0030).
- Interface `ProfileAccessFilter`, implémentée et enregistrée par le module network : les membres masqués pour un lecteur (blocage dans un sens ou dans l'autre). La vue membre d'un profil masqué répond 404 comme un profil inexistant, par l'identifiant actuel ou un ancien (ADR 0029). Sans filtre enregistré, rien n'est masqué.
- Interface `OrganizationDirectory`, implémentée et enregistrée par le module organizations au démarrage (`isMember`, `summaries`) : profiles valide le lien du volet contributeur et l'affiche (`contributorOrganization` dans les vues) sans dépendre de organizations. Sans annuaire enregistré, aucun lien n'est accepté.
- `ProfilesModule` et les classes d'événements ci-dessous.

## Événements émis

| Type                                             | Payload                                                       |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `profiles.profile.created.v1`                    | `handle`                                                      |
| `profiles.profile.updated.v1`                    | `fields` (noms des champs modifiés, dont `avatar` et `cover`) |
| `profiles.profile.intention-set.v1`              | `intention` (ou `null`)                                       |
| `profiles.profile.entrepreneur-facet-updated.v1` | `change` (`created`, `updated`, `deleted`)                    |
| `profiles.profile.contributor-facet-updated.v1`  | `change` (`created`, `updated`, `deleted`)                    |
| `profiles.profile.handle-changed.v1`             | `previous`, `current`                                         |
| `profiles.profile.visibility-changed.v1`         | les quatre réglages de visibilité                             |

## Événements consommés

- `identity.user.registered.v1` : création idempotente du profil de base (handler `profiles.create-base-profile`).
- `profiles.profile.created.v1` : demande d'import de la photo du fournisseur (handler `profiles.import-provider-photo`).
- `media.asset.ready.v1` (source `import`, usage `avatar`) : la photo importée devient la photo du profil (handler `profiles.use-imported-avatar`).

## Dépendances

identity (nom, photo, locale), access (rôles, niveaux de confiance, enregistrement des prérequis), media (photo, couverture, import).
