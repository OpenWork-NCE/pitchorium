# 0094. Régime du bundle du web

Statut : acceptée (2026-10-08). Complète l'ADR 0090.

## Contexte

Le socle (PROMPT FRONT 0) chargeait sur chaque page les fournisseurs de toutes : Motion avec ses fonctions de mise en page, sonner, le menu de Radix du sélecteur de langue, Vercel Analytics, la vue d'erreur et, par la page d'erreur globale, tout le catalogue `web` en français et en anglais. La page éditoriale pesait 236,1 kB de JavaScript initial compressé (Brotli), framework compris. Le design system et la coquille de l'espace membre vont ajouter beaucoup de code : chaque groupe de routes ne doit charger que ce qu'il utilise.

## Décision

- **Fournisseurs par groupe** : le document (`components/layout/providers.tsx`) ne monte que les messages du document, le thème, les langues actives et le fuseau. `InteractiveRuntime` (messages du groupe, fonctions de Motion, toasts) est monté par les coquilles membre, administration, authentification et publique ; `DataProvider` (TanStack Query et client de l'api) par les groupes qui lisent l'api depuis le navigateur ; le temps réel par l'espace membre seulement. Les pages éditoriales et publiques n'ont ni temps réel, ni client d'authentification, ni outils de développement de requêtes ; le client d'authentification ne se charge qu'au clic de déconnexion.
- **Messages** : `CLIENT_MESSAGES` (`lib/i18n/messages.ts`) liste par groupe les sous-arbres que ses composants clients lisent ; `ScopedMessages` les sert au groupe. Les composants serveur lisent tous les namespaces.
- **Motion** : `LazyMotion` en mode strict, composants `m` seulement (`motion/react-m`), fonctions chargées après la première peinture. `MotionProvider` charge les animations (`domAnimation`) ; `LayoutMotion` charge la mise en page (`domMax`) et n'enveloppe que les composants qui animent une mise en page (indicateur partagé). Les micro-interactions qui n'en ont pas besoin passent en CSS (échange d'icône, repli de la transition de page).
- **Radix** : une primitive n'arrive que par l'import nommé d'un composant qui l'utilise ; `check:bundles` liste les primitives de chaque page à partir de leurs noms. Le sélecteur de langue devient une divulgation de liens sans bibliothèque de menu (changer de langue, c'est changer d'URL).
- **Chargement à la demande** : vues des pages d'erreur (le périmètre d'erreur fait partie de chaque page, sa vue non), Vercel Analytics et Speed Insights.
- `sideEffects` déclaré dans `apps/web/package.json` : un module inutilisé (par exemple `toaster.tsx` et sonner) quitte le bundle même s'il est exporté par un index.
- **Budgets** (JavaScript initial compressé, framework compris, environ 112 kB) appliqués par `check:bundles` : page éditoriale 190 kB, coquille de l'espace membre 250 kB, administration 260 kB, pages publiques et authentification 220 kB, autres pages 190 kB. Le script refuse aussi GSAP hors des pages éditoriales, Socket.IO et le client d'authentification hors des groupes qui les utilisent, et les outils de développement de requêtes partout.

## Mesures (build de production du 2026-10-08)

- Page éditoriale (`(marketing)`) : 236,1 kB avant, 173,4 kB après.
- Page inconnue (`[...rest]`) : 233,0 kB avant, 150,5 kB après ; `_not-found` : 205,8 kB avant, 117,2 kB après ; `_global-error` : 126,7 kB avant, 116,7 kB après.
- Lighthouse mobile sur la page éditoriale : performance 100, accessibilité 100, LCP 1,5 s, TBT de 2 à 29 ms, scripts transférés 248 kB.
- Coquille de l'espace membre : mesurée avec sa livraison (ADR 0099).

## Conséquences

- Un nouveau composant client lit ses textes dans un sous-arbre listé par `CLIENT_MESSAGES` pour son groupe ; un test vérifie que chaque chemin existe.
- Une bibliothèque n'entre dans un groupe que par un composant de ce groupe ; `check:bundles` le montre à chaque build.
