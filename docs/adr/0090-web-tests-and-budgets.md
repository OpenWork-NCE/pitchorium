# 0090. Tests et budgets du web

Statut : acceptée (2026-10-08).

## Contexte

Le web doit rester rapide en 4G africaine et accessible, et sa régression visuelle doit se voir avant la fusion. Le rendu des polices diffère d'une distribution Linux à l'autre.

## Décision

- Vitest 5 et Testing Library (jsdom) pour les composants et la logique : primitives de mouvement (y compris mouvement réduit), instance fetch, langues actives et proxy, contraste des tokens, CSP, formats, règles d'architecture.
- Playwright 1.64 pour le bout en bout, sur un build de production dédié (`.next-e2e`) devant une api simulée (`e2e/support/stub-api.mjs`) : accueil en français et en anglais, thème sans flash, langue inactive, 404, CSP sans violation, axe sans violation (WCAG 2.2 AA, deux thèmes), INP des gestes principaux sous 200 ms avec un processeur ralenti quatre fois, captures de référence 1280x800 et 390x844 dans les deux thèmes. `pnpm test:e2e` tourne dans l'image officielle `mcr.microsoft.com/playwright:v1.64.0-noble`, comme la CI, pour des captures identiques ; `test:e2e:native` saute les captures. Depuis la revue de design (PROMPT FRONT 2A), les parcours tournent aussi dans Firefox, WebKit et WebKit en iPhone (parcours `@phone`) ; captures et INP restent sous Chromium.
- Storybook 10 (framework Next.js avec Vite, addons accessibilité et documentation) pour les primitives et les tokens, construit en CI.
- Lighthouse CI (profil mobile, réseau 4G lente et processeur ralenti quatre fois appliqués au navigateur) : performance 90 ou plus, accessibilité, bonnes pratiques et SEO 100, LCP 2,5 s au plus, CLS 0,1 au plus, TBT 300 ms au plus (démarrage de React et de Next.js), scripts transférés 360 kB et polices 80 kB au plus sur la page éditoriale.
- JavaScript initial par groupe de routes, compressé en Brotli, framework compris, contrôlé par `scripts/check-bundles.mjs` sur le build, qui vérifie aussi l'absence de GSAP hors des pages éditoriales ; budgets resserrés par l'ADR 0094.
- Analyse des bundles par `next analyze` (Turbopack) plutôt que `@next/bundle-analyzer`, qui ne voit que les builds webpack.

## Conséquences

- Le profil de Lighthouse n'est pas simulé : sur un serveur local, la simulation lie le LCP d'un titre rendu par le serveur à tous les scripts exécutés avant la première peinture (3,0 à 3,8 s estimés pour 0,7 à 1,6 s mesurés).
- L'INP, objet du budget, se mesure sur de vraies interactions (`e2e/responsiveness.spec.ts`) : 40 ms au plus avec le processeur ralenti quatre fois, 112 ms dix fois. Le TBT de Lighthouse ne mesure que le chargement : 217 à 229 ms sur un runner GitHub (processeur ralenti quatre fois), d'où son budget de 300 ms.
- Les budgets sont proposés à partir des mesures de ce socle et restent à valider (question 93).
