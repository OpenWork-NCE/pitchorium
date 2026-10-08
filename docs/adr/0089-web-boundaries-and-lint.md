# 0089. Frontières et règles du web

Statut : acceptée (2026-10-08).

## Contexte

Le backend vérifie ses frontières par ESLint (ADR 0010). Le web a besoin des mêmes garanties : un design system sans métier, des features qui ne se lisent que par leur façade, pas de GSAP hors des pages éditoriales, pas de texte en dur.

## Décision

- Configuration partagée `@pitchorium/config/eslint-web` : règles TypeScript communes, Next.js (`@next/eslint-plugin-next`), hooks React, Storybook, frontières (`eslint-plugin-boundaries`, `webBoundaries`) et deux règles maison (`eslint-plugin-pitchorium.js`).
- Frontières : `components/ui`, `components/motion` et `components/brand` n'importent ni feature, ni coquille, ni route ; une feature n'importe une autre feature que par son `index.ts` ; routes et coquilles composent les features par leur façade ; `lib/`, `config/`, `i18n/` et `styles/` n'importent aucun composant ni feature.
- GSAP et le titre éditorial (`split-heading`) sont interdits hors de `(marketing)`, de `features/marketing` et des stories.
- `pitchorium/no-literal-ui-text` : aucun texte (lettres) dans le JSX ni dans les attributs lus par les personnes (`alt`, `title`, `aria-label`, `placeholder`...), hors stories et tests.
- `pitchorium/no-client-route-file` : `"use client"` interdit sur une page, un layout, un template, `loading` ou `not-found` ; une exception se justifie par un commentaire `eslint-disable`.
- `test/architecture/eslint.spec.ts` prouve chaque règle sur une violation volontaire.
- Plugins `eslint-plugin-react` et `eslint-plugin-jsx-a11y` écartés : ils ne déclarent pas ESLint 10 ; l'accessibilité est vérifiée à l'exécution (axe dans Playwright, addon a11y de Storybook, Lighthouse).

## Conséquences

- Un nouveau domaine du web devient un dossier `src/features/<domaine>` avec son `index.ts`, aligné sur le module backend du même nom.
