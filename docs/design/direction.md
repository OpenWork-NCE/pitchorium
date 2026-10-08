# Direction artistique

Contrat visuel de l'application web : chaque composant de `apps/web/src/components/ui` et chaque coquille le respecte, chaque revue de design s'y réfère. Décision : ADR 0095. Valeurs : `tokens.md`, typographie : `typography.md`, mouvement : `motion.md`, marque : `brand-usage.md`, composants : `components.md`, usages : `patterns.md`.

## Principes

- **Réseau d'affaires premium, sobre et chaleureux.** On vient y rencontrer des personnes, des projets et de l'argent réel (§4) : l'interface inspire confiance avant de plaire. Chaleur par la typographie, le cuivre en touches et des textes humains, jamais par l'abondance d'effets.
- **Éditorial plutôt que réseau social photo** (§6.2, §10). Le texte, les chiffres et les personnes portent l'information ; une image illustre, elle ne remplit pas. Pas de stories, pas de filtres, pas de mosaïque de photos en guise de page d'accueil.
- **Web d'abord** (§4). L'écran de référence est un ordinateur ; tablette et téléphone reçoivent la même information, empilée, sans imiter une application native (§6.1) : ni barre d'onglets basse, ni geste propre aux applications, ni écran plein de boutons flottants.
- **Une matière** : le papier mat au motif d'élévation de la marque (trois figures superposées, ton sur ton, ADR 0086 et question 94). Elle vit sur les fonds des pages publiques, d'authentification, d'erreur et des états vides ; l'espace membre reste un papier uni.
- **Une seule couleur d'accent dominante** : le violet de la marque (token `accent`) porte les actions principales, les liens, la sélection et l'état actif de la navigation. Le cuivre (token `highlight`) est une touche, jamais un second accent : remplissage du bouton principal au survol (H21), focus en thème sombre, trait dessiné d'un palier atteint (H18). Jamais un indicateur d'état (onglet actif, case cochée) : 2,73:1 sur fond clair, sous le 3:1 d'un indicateur (WCAG 1.4.11). Les couleurs de statut (succès, alerte, danger, information) ne servent qu'à leur sens.
- **Sans décor gratuit.** Chaque trait, ombre, animation ou illustration sert une fonction : hiérarchiser, situer, confirmer, faire patienter. En cas de doute, on retire.

## Grille et densité

### Grille

- 12 colonnes, gouttière de 24 px à partir de `md` (768 px), 16 px en dessous ; marge latérale de 16 px sur téléphone (24 px à partir de `sm`).
- Unité d'espace : 4 px (`p-1`). Rythme vertical des blocs : 16, 24, 32, 48 px ; 64 à 128 px entre les sections des pages éditoriales.

### Conteneurs

| Nom     | Largeur maximale | Usage                                                                |
| ------- | ---------------- | -------------------------------------------------------------------- |
| `shell` | 1 280 px         | coquilles, en-têtes, mise en page à trois colonnes (`max-w-7xl`)     |
| `page`  | 1 024 px         | pages à une colonne de contenu riche (paramètres, gestion de projet) |
| `prose` | 680 px (68 ch)   | lecture longue : description d'un projet, texte légal, publication   |
| `form`  | 448 px           | formulaires courts : connexion, inscription, confirmation            |

### Disposition à trois colonnes de l'espace membre (§6.1)

| Écran                       | Colonnes                     | Comportement                                                                                        |
| --------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Bureau, 1 280 px et plus    | gauche 3, centre 6, droite 3 | suggestions à gauche, fil ou contenu au centre, projets et personnes à droite ; latérales collantes |
| Petit bureau, 1 024 à 1 279 | centre 8, latérale 4         | la latérale empile la gauche puis la droite ; collante                                              |
| Tablette, 768 à 1 023       | une colonne de 12            | contenu, puis gauche, puis droite, empilés                                                          |
| Téléphone, moins de 768     | une colonne, marges de 16 px | même ordre ; cartes pleine largeur, aucune information retirée                                      |

- Les colonnes latérales sont des `aside` nommés (`aria-label`), collantes sous le bandeau (`top` = hauteur du bandeau + 24 px) quand elles tiennent dans la fenêtre, défilantes sinon.
- Le contenu principal vient d'abord dans l'ordre du document : au clavier et au lecteur d'écran, le fil précède les suggestions à toutes les tailles.

### Densité

- **Confortable par défaut** : cartes à 20 ou 24 px de marge intérieure, lignes de liste de 56 px au moins, 12 à 16 px entre deux éléments d'une liste.
- **Dense** pour l'administration seulement (`data-density="compact"`) : lignes de tableau de 40 px, marges de 12 px. Jamais dans l'espace membre.
- Cibles tactiles de 44 x 44 px au moins sur téléphone, y compris les boutons-icônes et les liens d'un menu.

## Hiérarchie typographique appliquée

| Rôle                       | Police et graisse              | Taille      | Où                                                   |
| -------------------------- | ------------------------------ | ----------- | ---------------------------------------------------- |
| Titre éditorial (`h1`)     | Bricolage Grotesque 800        | `text-5xl`  | pages publiques éditoriales seulement                |
| Titre de page (`h1`)       | Bricolage Grotesque 800        | `text-3xl`  | toute page de l'espace membre et de l'administration |
| Titre de section (`h2`)    | Bricolage Grotesque 800        | `text-2xl`  | sections d'une page                                  |
| Titre de carte (`h3`)      | Poppins 600                    | `text-lg`   | cartes, panneaux, dialogues                          |
| Surtitre (`Kicker`)        | Poppins 500, capitales         | `text-xs`   | au-dessus d'un titre, une fois par bloc              |
| Texte courant              | Poppins 400                    | `text-base` | 16 à 17 px, interligne 1,5, 68 caractères au plus    |
| Texte secondaire           | Poppins 400, `muted`           | `text-sm`   | métadonnées, aides, horodatages                      |
| Libellés, boutons, onglets | Poppins 500                    | `text-sm`   | contrôles                                            |
| Nombres                    | police du rôle, `tabular-nums` | du rôle     | montants, compteurs, statistiques, tableaux          |

- **Edu AU VIC WA NT Hand** (`font-hand`) : rares accents éditoriaux des pages publiques (une annotation, un mot souligné à la main), au plus une fois par écran, jamais pour un logo, un formulaire, un texte long, une information nécessaire, ni dans l'espace membre, l'administration ou l'authentification. Un test d'architecture refuse `font-hand` hors de `features/marketing` et des pages `(marketing)`.
- Une seule police de titre et une seule de texte : jamais une troisième famille, jamais de faux gras.

## Iconographie

- `lucide-react` exclusivement, par le composant `Icon` ou une icône posée dans un composant du design system.
- Épaisseur de trait unique : 1,75 (proportionnée à Poppins), sans compensation de taille.
- Tailles normalisées : 16 px (`sm` : dans un texte de 14 px, boutons `sm` et `md`, menus, métadonnées), 20 px (`md` : boutons `lg` et boutons-icônes, navigation, ornements des champs), 24 px (`lg` : états vides, en-têtes de section). Aucune autre.
- Une icône seule a toujours un nom accessible (bouton-icône avec libellé et infobulle) ; une icône à côté d'un texte est décorative (`aria-hidden`).
- Ni icône pleine, ni émoji en guise d'icône, ni pictogramme dessiné à la main.

## Imagerie

- **Ratios autorisés**, alignés sur les variantes produites par le module media : 1:1 (photo de profil, logo d'organisation), 4:1 (couverture de profil et d'organisation, 3:1 recadré sur téléphone), 16:9 (événement, aperçu de lien), 4:3 (galerie de projet, vignette). Une image de publication garde son ratio, bornée entre 4:5 et 16:9 par recadrage centré.
- **Cadrage** : sujet centré, recadrage par `object-fit: cover` et `object-position: center` ; jamais de déformation, jamais d'image agrandie au-delà de sa variante.
- **Avatars** : cercle, fond `surface-sunken` derrière l'image, initiales sur une couleur dérivée du nom et contrastée (4,5:1 au moins) quand il n'y a pas de photo ; un anneau de 2 px de la couleur du fond quand les avatars se chevauchent. Les logos d'organisation sont carrés à coins arrondis (`rounded-md`), jamais en cercle.
- **Couvertures** : bandeau 4:1 à coins arrondis en haut de la carte ; sans couverture, le motif d'élévation ton sur ton, jamais une image générique.
- **Cartouches photo de la marque** (`photo-cartouche-clair` et `-sombre`) : seule façon de poser le logo sur une photographie (partage, couverture éditoriale), conformément au guide.
- **Interdits** : banques d'images génériques, illustrations ou photos produites par une IA, mains qui se serrent, globes et ampoules, personnes inventées pour illustrer un profil. Une image de Pitchorium vient d'un membre, d'un projet ou du kit de marque.

## États

- **Vide** (`EmptyState`) : motif d'élévation de la marque en ton sur ton, un titre qui dit ce qui manque, une phrase qui dit pourquoi, et l'action qui le remplit quand elle existe. Jamais d'image générique, jamais de « Oups ».
- **Chargement** (`Skeleton`) : squelettes fidèles à la mise en page finale (mêmes hauteurs, mêmes colonnes) pour éviter tout décalage ; un scintillement discret, immobile avec moins de mouvement. Indicateur tournant (`Spinner`) réservé à une action en cours dans un bouton ou une zone de moins de 48 px.
- **Erreur** (`ErrorState`) : ce qui n'a pas pu se faire, ce que la personne peut faire, une action de reprise (Réessayer) et la référence technique (`X-Request-Id`) à citer au support. Le texte vient du code d'erreur (`errors.<code>`), jamais du message technique de l'api.
- **Hors ligne** : une bannière de site discrète (`Banner`), les données déjà chargées restent lisibles, les écritures sont mises en attente puis rejouées à la reconnexion (`patterns.md`) ; jamais d'écran bloquant.

## Surfaces et élévation

- Trois surfaces : la page (`background`), la carte (`surface`, bordure `border`), le creux (`surface-sunken`, champs et zones secondaires).
- Deux niveaux d'élévation visibles en même temps au plus : le contenu (ombre `xs` ou aucune) et une superposition (`surface-elevated`, ombre `md`) ; l'ombre `lg` est réservée aux dialogues. Une bordure de 1 px sépare avant qu'une ombre ne le fasse.
- Rayons : `md` (10 px) pour les champs, `lg` (14 px) pour les menus, `xl` (20 px) pour les cartes et dialogues, pilule pour les boutons et les puces.

## Interdits

- Verre dépoli permanent (`backdrop-filter` sur une surface au repos) ; un flou d'arrière-plan n'est admis que sous un dialogue.
- Dégradés violets génériques, halos, « blobs », lueurs ; la marque est en aplats.
- Ombres lourdes ou colorées, plus de deux niveaux d'élévation visibles en même temps.
- Animations décoratives sans fonction : rien ne bouge en boucle, rien ne bouge sans réponse à un geste, à un défilement ou à un changement d'état (`motion.md`).
- Texte en cuivre sur fond clair, texte sur une photographie sans cartouche, plus d'une couleur d'accent sur un écran.
- Carrousels décoratifs, barre d'onglets basse, boutons flottants permanents, badges rouges partout : un compteur ne s'affiche que là où il y a quelque chose à faire.
