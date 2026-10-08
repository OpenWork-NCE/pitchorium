# Composants du design system

Inventaire de `apps/web/src/components/ui` (ADR 0082) : composants sans connaissance métier, sur Radix UI quand une primitive existe, variantes `cva`, tokens seulement. Ils appliquent `direction.md` (contrat visuel), `motion.md` (mouvement) et `patterns.md` (usages). Les stories se lisent par `pnpm storybook` (http://localhost:6006, thème clair, sombre ou côte à côte dans la barre d'outils) ; elles sont aussi des tests (`pnpm --filter @pitchorium/web test:stories`, plus bas).

Règles communes :

- WCAG 2.2 AA : clavier complet, focus visible au token `focus`, rôles et attributs ARIA de la primitive, cibles de 44 px au moins sur téléphone.
- Moins de mouvement : état final immédiat (règle globale de `globals.css` et primitives de `components/motion`).
- Deux thèmes et textes longs : aucune largeur fixe sur un libellé, retour à la ligne ou troncature explicite.
- Textes : `web.ui.*` (et `web.forms.*`, `web.notices.*`) de `packages/i18n` ; un composant reçoit en propriété les textes métier déjà traduits (raisons, libellés de niveau).

## Typographie et base

| Composant        | Usage                                                                               | À faire, à éviter                                                         | Story                             |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------- |
| `Heading`        | titre : `level` pour le plan, `size` pour le rôle (`display` à `label`)             | un seul `h1` par page ; `display` réservé aux pages éditoriales           | Design system/Typography and base |
| `Text`           | texte courant : taille, ton, graisse, `prose` (68 caractères), `numeric`            | les tons de statut seulement pour leur sens                               | idem                              |
| `Kicker`         | surtitre, une fois par bloc                                                         | jamais à la place d'un titre                                              | idem                              |
| `Link`           | lien : `inline` souligné au repos, `standalone` au survol ; externe avec `external` | un lien externe annonce le nouvel onglet ; jamais `onClick` pour naviguer | idem                              |
| `Icon`           | icône lucide en 16, 20 ou 24 px, trait unique                                       | `label` seulement si l'icône porte seule un sens                          | idem                              |
| `VisuallyHidden` | texte pour les lecteurs d'écran                                                     | jamais pour cacher une information utile à tous                           | idem                              |
| `Kbd`            | touche du clavier                                                                   |                                                                           | idem                              |
| `Separator`      | séparation fonctionnelle de deux groupes (Radix)                                    | jamais décorative : l'espace sépare d'abord                               | idem                              |

## Actions

| Composant                      | Usage                                                                                                                               | À faire, à éviter                                                                                  | Story                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `Button`                       | `primary` (violet, remplissage violet soutenu au survol, H21), `secondary`, `outline`, `ghost`, `danger`, `link` ; `sm`, `md`, `lg` | un seul `primary` par vue ; `loading` garde la largeur ; `disabledReason` plutôt qu'un bouton muet | Design system/Actions/Button          |
| `IconButton`                   | bouton à icône seule : libellé obligatoire, infobulle au survol (400 ms) et au focus, fermée par Échap ; `link` pour un lien        | jamais sans `label`                                                                                | Design system/Actions/Icon button     |
| `ToggleGroup`                  | `single` : contrôle segmenté à indicateur glissant ; `multiple` : bascules de filtres                                               | trois à cinq options ; au-delà, un `Select`                                                        | Design system/Actions/Toggle group    |
| `CopyButton`                   | copie dans le presse-papiers, résultat annoncé                                                                                      |                                                                                                    | Design system/Actions/Copy button     |
| `ThemeToggle`, `ThemeSelector` | bascule clair et sombre (cercle H14), choix explicite avec le système                                                               |                                                                                                    | Design system/Navigation/Theme toggle |

## Formulaires

Système `Field` : libellé, description, contrôle, erreur et compteur liés par leurs ids ; chaque contrôle lit son `Field` (`useFieldControl`). `Form`, `FormField` et `useZodForm` lient react-hook-form aux schémas de `@pitchorium/contracts` ; `useApplyProblem` place les erreurs RFC 9457 de l'api (ADR 0096, `patterns.md`).

| Composant        | Usage                                                                                                                                                   | À faire, à éviter                                            | Story                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `Input`          | texte, email, url, recherche ; ornements de début et de fin                                                                                             | `autoComplete` toujours renseigné                            | Design system/Forms/Text inputs       |
| `Textarea`       | texte long qui grandit avec son contenu ; compteur par le `Field`, affiché à 80 % de la limite ou au focus                                              | nombres dans la langue de la page                            | idem                                  |
| `PasswordInput`  | mot de passe avec bouton d'affichage (`aria-pressed`)                                                                                                   | `current-password` ou `new-password`                         | idem                                  |
| `OtpInput`       | code à 6 chiffres : un seul champ, collage, `one-time-code`                                                                                             |                                                              | idem                                  |
| `Select`         | un choix dans une liste courte (Radix Select)                                                                                                           | une liste à chercher : `Combobox`                            | Design system/Forms/Choices           |
| `Combobox`       | choix à chercher (cmdk) : simple, multiple en puces, recherche sur le serveur                                                                           | pays et secteurs en `multiple` avec `max`                    | Design system/Forms/Combobox          |
| `Checkbox`       | case, état indéterminé                                                                                                                                  | une préférence immédiate : `Switch`                          | Design system/Forms/Choices           |
| `RadioGroup`     | un choix parmi quelques-uns, `list` ou `card` avec description                                                                                          |                                                              | idem                                  |
| `Switch`         | réglage appliqué à l'instant                                                                                                                            | jamais dans un formulaire à soumettre                        | idem                                  |
| `Slider`         | valeur dans un intervalle, valeur dite (`aria-valuetext`)                                                                                               | toujours une valeur formatée                                 | idem                                  |
| `MoneyInput`     | montant en unités mineures, sans flottant, formaté à la sortie du champ                                                                                 | la devise fixe les décimales (XAF sans)                      | Design system/Forms/Amounts and dates |
| `DateTimeField`  | date et heure en segments (`spinbutton`) dans l'ordre et l'horloge de la langue de l'application, calendrier en `Popover`, valeur en instant (ADR 0100) | le fuseau du lieu, dit une fois à côté des dates             | Design system/Forms/Amounts and dates |
| `TimeZoneSelect` | fuseau des dates d'un formulaire, lisible (« Dakar, GMT+0 ») et modifiable par recherche                                                                | une seule fois par formulaire, jamais sous chaque champ      | idem                                  |
| `FileDrop`       | dépôt, sélection, collage ; aperçu, progression, états `pending` à `rejected` avec motif                                                                | limites de l'usage affichées ; l'envoi par `features/media`  | Design system/Forms/File drop         |
| `Form`           | formulaire complet ; après un envoi en échec, résumé focalisé dont chaque erreur est un lien vers son champ                                             | une valeur facultative vide est absente, pas une chaîne vide | Design system/Forms/Form              |
| `FormActions`    | actions d'un formulaire : l'action principale d'abord, empilées en pleine largeur sur un téléphone                                                      | jamais deux actions principales                              | Design system/Forms/Form              |

## Affichage de données

| Composant                                | Usage                                                                                                                                                                                                              | À faire, à éviter                          | Story                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| `Avatar`                                 | photo ou initiales sur couleur dérivée du nom (AA) ; personnes en cercle, organisations en carré                                                                                                                   | `decorative` quand le nom est écrit à côté | Design system/Data display                  |
| `AvatarGroup`                            | quelques personnes en chevauchement, résumé parlé                                                                                                                                                                  | toujours un `label` qui nomme le groupe    | idem                                        |
| `Badge`                                  | état ou catégorie en un mot ; `count` pour un nombre à traiter                                                                                                                                                     | pas de compteur sans action à faire        | idem                                        |
| `CountBadge`                             | nombre à traiter sur une entrée de navigation, `99+` au-delà ; la nouvelle valeur roule                                                                                                                            | décoratif : le lien dit le nombre          | Compositions/Member shell loaded            |
| `Tag`                                    | valeur parmi d'autres, retirable                                                                                                                                                                                   |                                            | idem                                        |
| `Card`                                   | `default`, `sunken`, `interactive` (une carte lien entière)                                                                                                                                                        | pas de carte dans une carte                | idem                                        |
| `Stat`                                   | chiffre clé qui compte une fois à l'écran (H17)                                                                                                                                                                    | la valeur finale est rendue par le serveur | idem                                        |
| `Money`                                  | montant de l'api : à l'affichage sans décimales quand la partie mineure est nulle (12 500 €) ; `precision="financial"` (tableaux, devis, reçus) écrit toutes les décimales de la devise ; équivalent en euros figé | jamais de conversion côté navigateur       | idem                                        |
| `RelativeTime`                           | « il y a 5 minutes », date complète en infobulle                                                                                                                                                                   |                                            | idem                                        |
| `Truncate`                               | texte long coupé, « voir plus » seulement s'il est coupé                                                                                                                                                           |                                            | idem                                        |
| `DescriptionList`, `Timeline`, `Stepper` | paires terme et valeur, événements ordonnés, étapes d'un parcours                                                                                                                                                  |                                            | idem                                        |
| `Table`                                  | tri (`aria-sort`), en-tête collant, pagination par curseur, chargement et vide                                                                                                                                     | dense en administration seulement          | Design system/Data display/Table            |
| `MarkdownContent`                        | Markdown restreint de l'api, sans HTML, liens https en `noopener noreferrer nofollow`                                                                                                                              | `sectionLevel` du plan de la page          | Design system/Data display/Markdown content |

## Composants signatures

| Composant         | Usage                                                                                                                                                                                                                                                                        | À faire, à éviter                                                                                  | Story                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------- |
| `FundingProgress` | collecté, objectif, pourcentage et jours restants en texte ; barre et paliers, chacun précédé de son icône d'état (atteint, à venir) et de son état écrit, jamais coupé ; coche dessinée en couleur de succès (H18) puis montant (H17) ; `compact` sans la liste des paliers | un palier atteint n'est pas une promesse de succès ; jamais de cuivre                              | Design system/Signature |
| `ImpactBadge`     | niveau et score, teinté par défaut (`solid` pour un titre) ; « auto-déclaré » une seule fois à côté, la mention complète et le détail par critère dans un `Popover`                                                                                                          | jamais de vocabulaire de certification (§12) ; la notice complète (`Notice`) sur la page du projet | idem                    |
| `VerifiedBadge`   | vérification accordée par Pitchorium                                                                                                                                                                                                                                         | jamais une auto-déclaration                                                                        | idem                    |
| `Notice`          | mentions obligatoires : auto-déclaré, traduction automatique, pas un reçu fiscal, contenu modéré                                                                                                                                                                             | à côté de ce qu'elle qualifie                                                                      | idem                    |

## Superpositions

| Composant      | Usage                                                                           | À faire, à éviter                                           | Story                  |
| -------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| `Dialog`       | tâche courte au-dessus de la page ; feuille du bas sur téléphone                | le focus va au premier champ, jamais au bouton de fermeture | Design system/Overlays |
| `AlertDialog`  | confirmation d'une action destructrice, saisie d'une phrase pour l'irréversible | le bouton dit le verbe de l'action ; Annuler a le focus     | idem                   |
| `Sheet`        | panneau latéral (filtres, détails, navigation étroite)                          |                                                             | idem                   |
| `Drawer`       | panneau tiré du bas sur téléphone (vaul)                                        | écran étroit seulement                                      | idem                   |
| `Popover`      | panneau ancré non modal                                                         |                                                             | idem                   |
| `HoverCard`    | aperçu au survol (profil, projet)                                               | jamais le seul accès : le lien ouvre la page                | idem                   |
| `Tooltip`      | courte aide au survol et au focus, fermée par Échap                             | jamais une information nécessaire sur écran tactile         | idem                   |
| `DropdownMenu` | actions d'un déclencheur, sous-menus, groupes radio                             | non modal                                                   | idem                   |

`ContextMenu` n'est pas livré : aucun usage ne le justifie à ce stade (une action contextuelle passe par un `DropdownMenu` « Plus d'actions », accessible au clavier et au toucher).

## Retour

| Composant             | Usage                                                                                                      | À faire, à éviter                                   | Story                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| `Toaster`, `notify`   | confirmation brève (sonner), annoncée ; `ToasterLoader` et `notify` chargent sonner après le premier rendu | jamais le seul endroit d'une erreur à traiter       | Design system/Feedback |
| `Alert`               | état d'une page ou d'une action, avec ce qu'il faut faire                                                  | `live` seulement s'il apparaît après une action     | idem                   |
| `Callout`             | explication en marge                                                                                       | jamais une erreur                                   | idem                   |
| `Banner`              | message du compte ou du site en haut de l'espace membre                                                    | une ligne, une action                               | idem                   |
| `Skeleton`, `Loading` | squelettes fidèles à la mise en page, région annoncée occupée                                              | même hauteur que le contenu final                   | idem                   |
| `Spinner`, `Progress` | action en cours dans un bouton ; progression connue ou attente                                             |                                                     | idem                   |
| `EmptyState`          | motif de la marque, titre, texte, action                                                                   | jamais d'image générique                            | idem                   |
| `ErrorState`          | échec d'un chargement, reprise et référence                                                                | texte du code d'erreur, jamais le message technique | idem                   |
| `AnnouncerProvider`   | régions `aria-live` partagées (`useAnnounce`)                                                              |                                                     | (coquille)             |

## Navigation

| Composant                          | Usage                                                                                     | À faire, à éviter                                         | Story                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| `Tabs`                             | vues d'un même sujet, indicateur partagé glissant                                         | la valeur dans l'URL (nuqs) pour un onglet partageable    | Design system/Navigation |
| `Breadcrumbs`                      | position dans l'administration                                                            |                                                           | idem                     |
| `Pagination`                       | pagination par curseur : « afficher plus », fin annoncée                                  |                                                           | idem                     |
| `LanguageSwitcher`                 | langues actives seulement, divulgation de liens                                           | jamais une langue inactive                                | idem                     |
| `CommandPalette`                   | coquille de la recherche globale (Ctrl K ou Cmd K) : actions rapides, recherches récentes | les résultats arrivent avec la recherche (PROMPT FRONT 7) | idem                     |
| `ShortcutsProvider`, `useShortcut` | registre central des raccourcis, aide sur `?` (ADR 0098)                                  | jamais une touche seule active pendant la saisie          | idem                     |

## Hors du design system

- `features/access` : `Can` et `useAccess`, prérequis et autorisations indicatifs d'une action (`patterns.md`).
- `lib/query/offline.ts` : `useOnline`, `usePausedMutations`, `useIdempotentMutation` (ADR 0097).
- `components/layout` : coquilles (cadre membre `member/`, ADR 0099 ; administration `admin/`), mises en page (`Main`, `ThreeColumnLayout`, `SingleColumnLayout`), états de chargement, d'erreur et d'absence par groupe (`states/`), `RouteFocus`, `StyleNonce` (`docs/architecture/frontend.md`).
- `src/stories/compositions` : compositions de référence (cadre membre, cartes, notifications, conversation, formulaire avec erreurs de l'api, tableau d'administration) sur des données typées par les contrats ; leurs captures sont dans `review/` (`review/README.md`).

## Tests

- Chaque story est un test (`@storybook/addon-vitest`) : sa fonction `play` (clavier, focus, états) et l'addon d'accessibilité, qui échoue sur toute violation WCAG 2.2 AA. Deux projets Vitest, un par thème, en mouvement réduit (le contraste se juge au repos).
- `pnpm --filter @pitchorium/web test:stories` les exécute dans l'image Playwright (comme la CI) ; `test:stories:native` avec le Chromium local.
- Les règles pures (montants, fuseaux, segments de date, Markdown, raccourcis, messages d'erreur) et les composants à clavier riche (`DateTimeField`) ont leurs tests unitaires (`pnpm --filter @pitchorium/web test`).
