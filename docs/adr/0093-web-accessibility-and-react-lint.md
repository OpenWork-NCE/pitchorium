# 0093. Lint d'accessibilité et de React du web

Statut : acceptée (2026-10-08). Remplace le dernier point de l'ADR 0089.

## Contexte

L'ADR 0089 écartait `eslint-plugin-react` et `eslint-plugin-jsx-a11y` parce qu'ils ne déclarent pas ESLint 10 : l'accessibilité n'était vérifiée qu'à l'exécution (axe, addon a11y de Storybook, Lighthouse), donc seulement sur ce qu'un test affiche. Le design system complet (PROMPT FRONT 1) multiplie les composants interactifs : une erreur de rôle, de libellé ou de clavier doit être refusée dès l'écriture, sur chaque branche du code.

## Décision

- `eslint-plugin-jsx-a11y` 6.10.2 (jeu `strict`) et `eslint-plugin-react` 7.37.5 (jeux `recommended` et `jsx-runtime`) dans `@pitchorium/config/eslint-web`, enveloppés par `fixupPluginRules` de `@eslint/compat` 2.1.1 (maintenu par l'équipe d'ESLint, compatible avec ESLint 10) : il rétablit les méthodes de contexte qu'ESLint 10 a retirées et dont ces plugins se servent encore.
- Les règles des hooks (`eslint-plugin-react-hooks` 7.1.1, déjà compatible) restent actives.
- `react/prop-types` et `react/display-name` sont désactivées : TypeScript type les propriétés, le compilateur de React nomme les composants.
- `apps/web/test/architecture/eslint.spec.ts` prouve chaque plugin sur une violation volontaire (`jsx-a11y/alt-text`, `jsx-a11y/click-events-have-key-events`, `jsx-a11y/no-static-element-interactions`, `react/jsx-key`, `react/jsx-no-target-blank`, `react-hooks/rules-of-hooks`).

## Conséquences

- L'accessibilité est vérifiée à deux niveaux : statique (lint) et à l'exécution (axe dans Playwright et Storybook, Lighthouse).
- pnpm signale un pair ESLint non déclaré pour ces deux plugins ; le test d'architecture garantit qu'ils fonctionnent. Quand ils déclareront ESLint 10, `fixupPluginRules` pourra être retiré.
