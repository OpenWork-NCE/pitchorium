# Aperçus du produit

Les visuels du site public sont des sections de l'application, capturées sur ses propres écrans et ses données de démonstration (ADR 0162) : aucune image externe, aucune maquette retouchée.

## Commande

```sh
pnpm marketing:captures                         # build, captures, encodage
MARKETING_SKIP_BUILD=1 pnpm marketing:captures  # réutilise .next-e2e
```

1. `scripts/build-e2e.sh` construit `.next-e2e`, servi avec l'api simulée et ses données de démonstration (`e2e/support/serve.mjs`, ports 3201 et 3299, refus si un port est pris).
2. Playwright, dans l'image officielle `mcr.microsoft.com/playwright:v1.64.0-noble` (rendu identique à la CI), exécute `e2e/marketing/previews.capture.ts` (`playwright.marketing.config.ts`) : fenêtre de 1280 x 800, densité 2, langue française, fuseau `Africa/Dakar`, horloge de la page figée à l'ouverture (`clock.setFixedTime`), mouvement réduit (chaque élément dans son état final), polices chargées, réseau au repos, aucun `aria-busy` ni `data-loading`, images chargées. Les captures brutes vont dans `.marketing-raw/` (ignoré par git).
3. `scripts/marketing-encode.mjs` (sharp) écrit `public/marketing/<section>-<thème>-<largeur>.<avif|webp>` aux largeurs 480, 800 et 1200 que la capture contient (jamais d'agrandissement), et leurs tailles en pixels CSS dans `src/features/marketing/lib/previews.generated.ts` (attributs `width` et `height`, aucun décalage). Mêmes captures, mêmes octets (test `test/marketing/previews.spec.ts`).

`MARKETING_REUSE=1` laisse Playwright réutiliser un serveur déjà démarré sur les mêmes ports, pour vérifier une page pendant un changement ; la version commitée vient toujours de l'image Playwright.

## Sections capturées

| Section        | Écran                                          | Où elle sert                                                                |
| -------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| `funding`      | bloc financement d'un projet, paliers compris  | héros de l'accueil (devant la page projet ; seule sur téléphone), Découvrir |
| `project-page` | premier écran de la page d'un projet           | héros de l'accueil, Fonctionnement (porteurs de projet)                     |
| `suggestion`   | personnes suggérées et raison de chacune       | rangée « Se lier »                                                          |
| `conversation` | une conversation et la liste des conversations | rangée « Se lier »                                                          |
| `notification` | notification qui regroupe des réactions        | héros de l'accueil                                                          |
| `dashboard`    | chiffres clés et mois du tableau d'engagement  | rangée « Soutenir », Fonctionnement (contributeurs)                         |

Chaque section existe dans les deux thèmes ; `ProductPreview` (`features/marketing`) met les deux dans la page, l'autre thème masqué : son image, différée, n'est jamais téléchargée. Sur ordinateur, la page projet du héros est l'image prioritaire (`priority`) : celle du thème du système se charge aussitôt, en haute priorité, préchargée pour la taille d'écran (`preloadPreview`) ; un thème choisi contre le système montre la sienne (`preview-system`, `preview-chosen-*` dans `globals.css`) ; sur téléphone, aucune image n'est demandée pour elle (`hiddenOn`, source vide). Sur téléphone, l'aperçu sous le titre est une bande du financement (5:2 : montant, objectif, barre et pourcentage), différée, et le motif de la marque reste derrière le héros comme sur les autres pages éditoriales : une image de 2 ko demandée la première, si bien que la plus grande peinture arrive avec la première (mesure Lighthouse mobile : LCP 1,57 s au ralentissement de la CI, 1,94 s au ralentissement du poste, performance 0,99).. Texte alternatif : l'interface montrée (« Aperçu d'une page projet sur Pitchorium »), `web.marketing.previews`.

## Règle de régénération

Toute modification visible d'un écran capturé (composant, texte, token, données de démonstration de l'api simulée) se termine par `pnpm marketing:captures` et le commit de `public/marketing` et de `previews.generated.ts` avec elle. Les captures montrent des données fictives de démonstration, jamais une personne réelle ; une section ajoutée s'ajoute à `PREVIEW_IDS` (`scripts/marketing-previews.mjs`) et à la capture.
