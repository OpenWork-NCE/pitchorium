# Module localization

Langues (cahier des charges §8) : traduction à la demande des contenus des membres et garde-fous de l'activation des langues d'interface (ADR 0076 et 0077). La locale du compte (détection, préférence) relève de identity ; les catalogues de `@pitchorium/i18n`. Flux de traduction et de relecture : `docs/architecture/i18n-workflow.md`.

## Traduction à la demande

- `POST /v1/translations` `{ sourceType, sourceId, targetLocale }` : publication, commentaire, profil (par son identifiant public : titre et présentation), projet (titre, résumé, description), actualité de projet, événement, mission, message (participant seulement, jamais mis en cache). Uniquement sur action du membre ; le contenu n'est envoyé au prestataire qu'à ce moment.
- Jamais silencieuse : la réponse porte `machineTranslated: true`, `sourceLanguage`, `provider` et `notice` (`common.machineTranslation`, « Traduction automatique »), à afficher avec le texte.
- Locales cibles : celles dont le flag `locale.<code>` est actif (FR et EN au lancement), sinon `LOCALIZATION_LOCALE_NOT_ACTIVE` ; un contenu déjà dans la langue répond `LOCALIZATION_ALREADY_IN_LANGUAGE`.
- Sources traduisibles : chaque module propriétaire enregistre la lecture de ses contenus pour un lecteur (`LocalizationFacade.registerTranslatableSource`), avec ses règles de visibilité ; un contenu que le lecteur ne voit pas répond `LOCALIZATION_SOURCE_NOT_FOUND`.
- Prestataires (`LOCALIZATION_PROVIDERS`, dans l'ordre de préférence) : `deepl` (API v2, `DEEPL_API_KEY`, `DEEPL_API_BASE_URL`), `google` (Cloud Translation Basic v2, `GOOGLE_TRANSLATE_API_KEY`), `simulated` (développement et tests, refusé en production ; sans valeur : `simulated` hors production, aucun en production). Le suivant prend le relais si l'un échoue ou ne couvre pas la paire ; aucun : `LOCALIZATION_UNAVAILABLE`. Langues couvertes, sources et date de vérification : `domain/provider-languages.ts` (Google ne propose pas le wolof).
- Glossaire métier FR et EN stocké comme donnée (`glossary_terms`), termes par défaut (palier, mécène, mécénat de compétences, love money, contrepartie, porteur de projet, equity, financement participatif, diaspora) insérés au démarrage du worker, traductions provisoires ; transmis à DeepL (glossaire créé une fois par contenu du glossaire et par paire `fr-en` ou `en-fr`, quand la langue source est connue).
- Cache par contenu et locale cible, valable tant que l'empreinte SHA-256 de l'original ne change pas (une modification l'invalide) et pendant `LOCALIZATION_CACHE_TTL_DAYS` (30) ; purge quotidienne (04:50 UTC).
- Coûts : `LOCALIZATION_MEMBER_DAILY_CHARACTERS` (20 000) par membre et par jour (`LOCALIZATION_MEMBER_LIMIT_REACHED`), `LOCALIZATION_MONTHLY_CHARACTERS_CAP` (500 000) pour la plateforme (`LOCALIZATION_MONTHLY_CAP_REACHED`) ; une traduction servie depuis le cache ne compte pas. Métriques : `pitchorium.localization.characters` (quantité), `pitchorium.localization.translated`, `pitchorium.localization.refused`, `pitchorium.localization.provider.failed`, `pitchorium.localization.cap.warning` (une fois par mois, à 80 % du plafond, avec un journal `warn`).

## Langues d'interface

`LocalizationFacade.setLocaleEnabled` (appelée par l'administration des flags) refuse d'activer une locale dont le catalogue n'est pas complet à 100 % ou dont le manifeste ne porte pas une relecture approuvée avec relecteur et date (`LOCALIZATION_LOCALE_NOT_READY`) ; audit et événements à chaque changement.

## Routes

- `POST /v1/translations` (`localization.translate`).
- `GET|POST /v1/admin/localization/glossary`, `PUT|DELETE /v1/admin/localization/glossary/{termId}`, `GET /v1/admin/localization/usage`, `GET /v1/admin/localization/locales` (`localization.manage`, administrateurs).

## Schéma `localization`

`translations` (clé : type, clé du contenu, locale ; empreinte, champs traduits, expiration), `usage` (membre, jour, caractères), `monthly_usage` (mois, caractères, alerte), `glossary_terms`.

## Façade publique (`index.ts`)

`LocalizationFacade` (`registerTranslatableSource`, `setLocaleEnabled`, `localeStatuses`), types `TranslatableSource` et `TranslatableContent`, classes d'événements.

## Événements émis

| Type                                    | Payload                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| `localization.translation.requested.v1` | `sourceType`, `targetLocale`, `provider`, `characters`, `cached` |
| `localization.locale.enabled.v1`        | `locale`, `by`                                                   |
| `localization.locale.disabled.v1`       | `locale`, `by`                                                   |

## Événements consommés

Aucun. File `localization.maintenance` : `purge-translations` (04:50 UTC).

## Données personnelles (RGPD)

Export : caractères traduits par jour. Suppression : compteurs du membre et traduction en cache de son profil supprimés ; les autres traductions ne portent aucun identifiant et expirent après 30 jours. Contrats enregistrés auprès du module privacy (`infrastructure/localization-personal-data.ts`, ADR 0074).

## Dépendances

Aucun module métier (les modules propriétaires des contenus s'enregistrent) ; plateforme : feature flags, audit, métriques.
