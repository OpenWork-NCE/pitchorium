# 0084. Internationalisation du web

Statut : acceptée (2026-10-08).

## Contexte

« Une langue mal traduite vaut mieux absente » (§4, §8.3) : le français est la source, une langue n'est proposée que si son flag `locale.<code>` est actif (ADR 0077). Les catalogues sont partagés avec le serveur et passent par Crowdin.

## Décision

- `next-intl` 4.14 avec un préfixe de langue toujours présent (`/fr`, `/en`) ; les cinq langues du backend sont routables.
- Le proxy lit les langues actives (`GET /v1/locales`, cache d'une minute, repli sur le français seul si l'api n'a jamais répondu) : une langue inactive redirige vers la même page en français, la détection (préfixe, cookie `NEXT_LOCALE`, puis `Accept-Language`) ne choisit qu'une langue active. Le sélecteur et les alternates hreflang (métadonnées, sitemap) ne listent que les langues actives ; le lien `Link` de next-intl est désactivé.
- Préférence du compte : elle s'écrit dans le cookie `NEXT_LOCALE` à la connexion et au changement de langue (PROMPT FRONT 1).
- Textes du web dans `packages/i18n`, namespace `web` (`web.*`), contrôlé par `pnpm i18n:check` et inclus dans Crowdin ; mêmes paramètres `{{nom}}` que les autres namespaces, convertis en arguments ICU au chargement (`lib/i18n/messages.ts`), clé manquante remplacée par le français. Clés typées à la compilation depuis les catalogues français.
- Seuls `common` et `web` partent au navigateur ; `errors` et `reference` restent côté serveur jusqu'à ce qu'une feature en ait besoin.
- Dates et nombres par `next-intl` dans la langue et le fuseau (cookie `pitchorium.tz` écrit par le navigateur, préférences du membre ensuite) ; montants à l'exposant de leur devise (`CURRENCY_EXPONENTS` de `@pitchorium/contracts`, XAF sans décimale).
- Aucun texte d'interface dans le JSX : règle ESLint `pitchorium/no-literal-ui-text`.
- Chemins d'URL en anglais pour toutes les langues (`/fr/sign-in`) ; leur traduction est une question ouverte.

## Conséquences

- Activer une langue (flag) la rend visible dans la minute, sans déploiement du web.
- Le namespace `web` compte dans la complétude d'une langue avant son activation.
