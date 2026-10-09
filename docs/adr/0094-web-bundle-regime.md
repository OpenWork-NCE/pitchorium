# 0094. Régime du bundle du web

Statut : acceptée (2026-10-08). Complète l'ADR 0090.

## Contexte

Le socle (PROMPT FRONT 0) chargeait sur chaque page les fournisseurs de toutes : Motion avec ses fonctions de mise en page, sonner, le menu de Radix du sélecteur de langue, Vercel Analytics, la vue d'erreur et, par la page d'erreur globale, tout le catalogue `web` en français et en anglais. La page éditoriale pesait 236,1 kB de JavaScript initial compressé (Brotli), framework compris. Le design system et la coquille de l'espace membre vont ajouter beaucoup de code : chaque groupe de routes ne doit charger que ce qu'il utilise.

## Décision

- **Fournisseurs par groupe** : le document (`components/layout/providers.tsx`) ne monte que les messages du document, le thème, les langues actives et le fuseau. `InteractiveRuntime` (messages du groupe, fonctions de Motion, toasts) est monté par les coquilles membre, administration, authentification et publique ; `DataProvider` (TanStack Query et client de l'api) par les groupes qui lisent l'api depuis le navigateur ; le temps réel par l'espace membre seulement. Les pages éditoriales et publiques n'ont ni temps réel, ni client d'authentification, ni outils de développement de requêtes ; le client d'authentification ne se charge qu'au clic de déconnexion.
- **Messages** : `CLIENT_MESSAGES` (`lib/i18n/messages.ts`) liste par groupe les sous-arbres que ses composants clients lisent ; `ScopedMessages` les sert au groupe. Les composants serveur lisent tous les namespaces.
- **Motion** : seul l'indicateur partagé (`SharedIndicator`, `layoutId`) l'utilise ; Motion (`LazyMotion` strict, `domMax`) est chargé quand la page est inactive, l'indicateur saute jusque-là. Aucun fournisseur Motion dans les coquilles. Les autres micro-interactions passent en CSS (échange d'icône, révélation, nombre animé, repli de la transition de page).
- **Radix** : une primitive n'arrive que par l'import nommé d'un composant qui l'utilise ; `check:bundles` liste les primitives de chaque page à partir de leurs noms. Le sélecteur de langue devient une divulgation de liens sans bibliothèque de menu (changer de langue, c'est changer d'URL).
- **Chargement à la demande** : vues des pages d'erreur (le périmètre d'erreur fait partie de chaque page, sa vue non), Vercel Analytics et Speed Insights.
- `sideEffects` déclaré dans `apps/web/package.json` : un module inutilisé (par exemple `toaster.tsx` et sonner) quitte le bundle même s'il est exporté par un index.
- **Budgets** (JavaScript initial compressé, framework compris, environ 112 kB) appliqués par `check:bundles` : page éditoriale 190 kB, coquille de l'espace membre 250 kB, administration 260 kB, pages publiques et authentification 220 kB, autres pages 190 kB. Le script refuse aussi GSAP hors des pages éditoriales, Socket.IO et le client d'authentification hors des groupes qui les utilisent, et les outils de développement de requêtes partout.

## Mesures (build de production du 2026-10-08)

- Page éditoriale (`(marketing)`) : 236,1 kB avant, 173,4 kB après.
- Page inconnue (`[...rest]`) : 233,0 kB avant, 150,5 kB après ; `_not-found` : 205,8 kB avant, 117,2 kB après ; `_global-error` : 126,7 kB avant, 116,7 kB après.
- Lighthouse mobile sur la page éditoriale : performance 100, accessibilité 100, LCP 1,5 s, TBT de 2 à 29 ms, scripts transférés 248 kB.
- Coquille de l'espace membre : mesurée avec sa livraison (ADR 0099).

## Vues des pages de ressources (complément du 2026-10-09, PROMPT FRONT 4)

Une page de ressource (`(public)`, ADR 0101) sert un visiteur et un membre à la même adresse. Le manifeste d'un groupe réunissait les deux cadres : un visiteur téléchargeait le cadre de l'espace membre (temps réel, bandeau, raccourcis) et les actions d'un membre sans jamais les afficher.

- Le cadre client de l'espace membre (`MemberFrame` : données, temps réel, état d'URL, bandeau, bannières) est chargé à la demande par `LazyMemberShell` dans `(public)` ; l'espace membre `(app)` garde `MemberShell`, qui l'importe directement.
- Le cadre public ne monte ni TanStack Query ni nuqs : une partie de page qui lit l'api depuis le navigateur les apporte (`ClientData`, chargé à la demande).
- Les actions d'un membre et les outils du propriétaire sont des îlots chargés à la demande (`LazyRelationshipActions`, `LazyFollowButton`, `LazyMemberLists`, `owner-tools.tsx`) ; les listes du réseau d'un membre, pour un visiteur, sont rendues par le serveur (`VisitorMemberLists` : listes en liens, « Afficher plus » par une requête simple).
- `check:bundles --views` sert le build des tests de bout en bout avec l'api simulée et lit chaque page de ressource comme visiteur et comme membre : le JavaScript que charge son HTML (scripts et préchargements, sans les polyfills `noModule`) est mesuré par vue, 190 kB pour un visiteur (le cadre public seul), 250 kB pour un membre. Un chargement à la demande n'échappe pas à la mesure : préchargé par le HTML d'une vue, il compte dans cette vue.
- Mesures (build des tests de bout en bout) : profil 177,1 kB en visiteur (211,4 kB avant) et 217,7 kB en membre ; réseau d'un membre 178,8 et 228,7 kB ; organisation 184,1 et 215,1 kB ; vitrine et projet 165,1 et 194,9 kB.

## Conséquences

- Un nouveau composant client lit ses textes dans un sous-arbre listé par `CLIENT_MESSAGES` pour son groupe ; un test vérifie que chaque chemin existe.
- Une bibliothèque n'entre dans un groupe que par un composant de ce groupe ; `check:bundles` le montre à chaque build.
