# Flux de traduction et de relecture

Langues de l'interface (§8) : le français est la source, l'anglais une traduction professionnelle, le swahili, le wolof et le lingala ne sont activés qu'après une relecture humaine native (« une langue mal traduite vaut mieux absente », §4).

## Catalogues

`packages/i18n/src/locales/<locale>/<namespace>.json`, clés imbriquées, paramètres `{{nom}}`. `pnpm i18n:check` vérifie l'alignement des langues commencées sur le français (README de `@pitchorium/i18n`).

## Outil (Crowdin, sans compte à ce jour)

`crowdin.yml` (racine) déclare les sources françaises et l'emplacement des traductions ; le jeton et l'identifiant du projet viennent de `CROWDIN_PERSONAL_TOKEN` et `CROWDIN_PROJECT_ID`. Le choix de l'outil (Crowdin ou Lokalise) reste une question ouverte (22).

1. Un développeur ajoute ou modifie une clé française, avec sa traduction anglaise provisoire, dans le même commit que le code.
2. `crowdin upload sources` envoie les catalogues français ; la mémoire de traduction et le glossaire métier (palier, mécène, love money, contrepartie, porteur de projet, equity) accompagnent le traducteur. La traduction automatique (DeepL, Google) ne sert que de premier jet, jamais de version publiée pour le wolof et le lingala.
3. Un traducteur natif traduit, un second relit et approuve dans l'outil.
4. `crowdin download --export-only-approved` écrit les traductions approuvées dans `packages/i18n/src/locales/<locale>/` ; une pull request les apporte.
5. Le manifeste `packages/i18n/src/locales/manifest.json` passe la langue au statut `reviewed` avec `reviewedBy` (nom du relecteur) et `reviewedAt` (date), dans la même pull request.

## Activation

Un administrateur active une langue par son flag `locale.<code>` (`PATCH /v1/admin/feature-flags/locale.<code>`). Le module localization refuse (`LOCALIZATION_LOCALE_NOT_READY`) tant que le catalogue n'est pas complet à 100 % par rapport au français ou que le manifeste ne porte pas une relecture approuvée avec relecteur et date (ADR 0077). `GET /v1/admin/localization/locales` montre, pour chaque langue, le flag, les clés manquantes et l'état de la relecture.

## Contenus des membres

Ils ne sont pas traduits automatiquement : le bouton « Traduire » appelle `POST /v1/translations`, et la réponse porte toujours `machineTranslated`, le prestataire et la mention à afficher (ADR 0076).
