# @pitchorium/i18n

Catalogues de traduction partagés par le serveur (emails) et le futur frontend.

- `src/locales/<locale>/<namespace>.json` : un fichier par namespace (`common`, `errors`, `emails`, `reference`). Les clés imbriquées se lisent avec des points (`technicalTest.subject`), les paramètres s'écrivent `{{nom}}`.
- Le français est la source de vérité ; l'anglais est aligné clé pour clé. Le swahili, le wolof et le lingala sont présents mais vides.
- `src/locales/manifest.json` donne le statut de relecture de chaque langue : `source`, `reviewed`, `pending-review` ou `empty`, avec le relecteur et la date. Une langue n'est activée côté produit (feature flag `locale.<code>`) qu'au statut `reviewed`.
- Le namespace `errors` contient une entrée par code du registre `@pitchorium/contracts` : l'API renvoie des codes, les clients les traduisent.
- Le namespace `reference` porte les libellés des données de référence renvoyées par `GET /v1/reference-data` (`labelKey`) : pays (noms CLDR, obtenus par `Intl.DisplayNames`), secteurs, stades et listes des profils.
- `translate(locale, namespace, key, params)` retombe sur le français si une clé manque.

`pnpm i18n:check` (racine) échoue si le français ne couvre pas tous les codes d'erreur ou si une langue au statut autre que `empty` a des clés manquantes ou en trop par rapport au français.
