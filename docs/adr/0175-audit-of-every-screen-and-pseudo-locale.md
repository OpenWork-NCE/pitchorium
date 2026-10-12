# 0175. Audit de chaque écran et pseudo-localisation

Statut : acceptée (2026-10-12).

## Contexte

Avant la version candidate, chaque écran doit être vérifié dans les deux thèmes et les deux tailles (axe, mise en page, logo, débordements), et les textes en dur, les débordements et les coupures doivent être cherchés avec des textes plus longs que les vrais. Les suites existantes ne couvraient qu'une partie des 102 pages, choisies par fonctionnalité ; la règle ESLint `no-literal-ui-text` ne voit pas un texte composé hors du JSX ni un code de l'api affiché tel quel.

## Décision

- Un registre de chaque écran (`apps/web/e2e/audit/screens.ts`) : une adresse de l'api simulée et un compte par page de `src/app/[locale]` ; un test vérifie qu'aucune page n'y manque.
- `pnpm --filter @pitchorium/web audit:screens` (image Playwright, Chromium) ouvre chaque écran en français, sur ordinateur et sur téléphone, dans les deux thèmes, et en anglais sur téléphone : axe (WCAG 2.2 AA) dans les deux thèmes, garde de mise en page des captures de revue (bords, coupures, un logo par écran, textes superposés, largeur de la page), console sans erreur. `AUDIT_CAPTURES` écrit une capture de chaque écran pour la relecture de la direction artistique.
- Pseudo-localisation : avec `WEB_PSEUDO_LOCALIZATION=true`, le serveur des pages remplace chaque texte des catalogues par sa pseudo-traduction (`pseudoLocalize` de `@pitchorium/i18n` : 40 % plus long, lettres accentuées, encadré de crochets). Ce n'est jamais une langue active : la variable est lue sur le serveur seulement, ignorée et refusée au build pour un site qui n'est pas servi par la machine (`lib/i18n/pseudo-locale.ts`, `lib/env.ts`). Le second passage de l'audit refuse un code de l'api affiché comme texte (hors `code` et chiffres de chasse fixe) et un titre de page que les catalogues n'ont pas écrit ; il écrit dans `AUDIT_REPORT` les autres textes non encadrés (données de l'api, à relire) et ce que les textes allongés cassent (`layout.jsonl`), sans échouer sur ce dernier point tant que les en-têtes ne se replient pas (question 148).
- Le niveau 3 l'exécute (job `audit` de `nightly.yaml`, captures et rapport en artefact) ; il n'entre pas au niveau 2 (10 à 15 minutes).

## Conséquences

- Une page nouvelle échoue au niveau 3 tant qu'elle n'est pas dans le registre.
- Les textes d'un catalogue lus directement par le serveur sans next-intl (`suggestionSentenceText`) ne sont pas pseudo-localisés : ils apparaissent dans le rapport, pas comme une erreur.
- Avec des textes 40 % plus longs que le français, les en-têtes du site public et de la console débordent (navigation non repliée) : mesuré à chaque passage, à corriger avant d'activer une langue plus longue (question 148). Les boutons et les pastilles passent à la ligne au lieu de déborder.
- Premiers défauts trouvés et corrigés : un écart d'hydratation (adresse publique calculée par `window.location`), des écrans avec deux logos, des codes de l'api affichés, un libellé de graphique composé dans le code, les fichiers de l'api simulée incomplets.
