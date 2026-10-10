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

## Marge de 10 % (complément du 2026-10-10, PROMPT FRONT 5A)

Le fil (245,9 kB sur 250 au niveau 3) et la vue visiteur d'un profil (189 kB sur 190) n'avaient plus de marge avant les pages des projets. Objectif : 10 % au moins sous chaque budget pour ces pages et pour toute page nouvelle.

- Zod : `lib/zod.ts` désactivait la sonde d'`eval` par `config` de `zod/v4/core`, dont le cœur (4,3 kB) partait sur chaque page ; l'objet de configuration que Zod 4 partage sur `globalThis` est désormais écrit sans importer Zod (test des deux ordres de chargement).
- Messages : compilés une fois par langue sur le serveur (`icu-minify`), lus par le formateur de messages compilés de use-intl ; l'analyseur ICU (environ 8 kB) quitte toutes les pages (ADR 0084).
- Vue visiteur : le document d'une publication charge le client de l'api au clic, la ligne de relation de l'aperçu d'un membre à la première ouverture ; TanStack Query et le client généré (12 kB) n'arrivaient que par eux.
- Fil : TanStack Virtual (6,6 kB) se charge après l'hydratation (`useDeferredWindowVirtualizer`, mêmes options et mêmes règles que `useWindowVirtualizer`), les premières entrées rendues par le serveur restant en place (ADR 0121) ; la complétion du profil devient un composant serveur et `Progress` n'emploie plus Radix.
- nuqs n'est plus monté par la coquille membre ni par `ClientData` : chaque composant à onglets ou à filtres dans l'adresse le monte (`UrlStateProvider`).
- Mesures (`check:bundles .next-e2e --views`) : fil 247,5 puis 223,2 kB ; profil 189,0 puis 168,3 kB en vue visiteur, 240,4 puis 229,8 kB en vue membre ; organisation 188,3 puis 167,2 kB en visiteur, 234,8 puis 223,6 kB en membre ; publication 180,7 puis 160,0 kB en visiteur ; page éditoriale 171,4 puis 159,0 kB ; connexion 197,6 puis 185,2 kB ; sécurité des paramètres 242,1 puis 226,0 kB.
- Limite connue : dans la vue membre d'une page de ressource, la coquille et les îlots chargés à la demande sont des groupes de morceaux frères, et Turbopack copie dans chacun les modules qu'ils partagent (TanStack Query, `config/routes.ts`) ; `turbopackChunking.requestCost` n'y change rien. Le profil en vue membre reste à 229,8 kB (8 % de marge).
- Pages des projets : les images d'une page rendue par le serveur (visuel principal, cartes de projet) passent par `getImageProps` dans un `<img>`, sans le composant client de `next/image` (5 kB) ; la suite de la vitrine charge le client de l'api et les cartes au premier « Voir plus » ; chaque étape de l'assistant et chaque onglet de la gestion (sauf la vue d'ensemble) sont chargés à la demande, et l'aperçu a sa propre route, pour que les composants de la page publique ne partent pas avec les autres étapes. `check:bundles --views` mesure aussi les pages de l'équipe d'un projet (étape « Essentiel », aperçu, gestion) avec un compte de l'équipe.
- Mesures : vitrine 185,2 puis 167,4 kB en vue visiteur, 208,4 kB en vue membre ; page projet 175,5 puis 170,2 kB en visiteur, 207,5 kB en membre (GSAP hors de la vue membre) ; assistant 255,0 kB par route puis, par vue, de 199,4 à 211,3 kB selon l'étape ; aperçu 206,2 kB ; gestion 223,9 puis 207,4 kB. Le profil en vue membre passe à 233,5 kB avec sa section « Projets » (cartes et `FundingProgress` animé), sous le budget de 250 kB, limite connue ci-dessus.

## Conséquences

- Un nouveau composant client lit ses textes dans un sous-arbre listé par `CLIENT_MESSAGES` pour son groupe ; un test vérifie que chaque chemin existe.
- Une bibliothèque n'entre dans un groupe que par un composant de ce groupe ; `check:bundles` le montre à chaque build.
