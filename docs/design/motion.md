# Mouvement de Pitchorium

Application de `ELITE-MOTION.md` (référence, même dossier) à une webapp professionnelle. ADR 0086.

## Doctrine

- **Espace membre** (`(app)`, `(admin)`, `(auth)`, `(public)`) : un document natif plus des micro-interactions. Horloge R1, défilement natif ; ni pin, ni WebGL, ni curseur personnalisé, ni marquee, ni préchargeur, ni détournement de la molette, ni défilement lissé (pas de Lenis).
- **Pages publiques éditoriales** (`(marketing)`) : dialecte primaire D4 (EDITORIAL_REVEAL), aucun dialecte secondaire à ce stade. Moteurs E0 (transitions CSS), E1 (animations liées au défilement, avec repli par IntersectionObserver) et E3 (GSAP ScrollTrigger avec SplitText, chargés quand un titre éditorial approche de l'écran).
- **Matière** : le motif d'élévation des fonds de marque (trois figures superposées, en ton sur ton), posé comme sur du papier mat, sans grain animé ni WebGL au lancement.
- **Sobriété** : seuls `transform`, `opacity`, `filter` et `clip-path` s'animent ; pas d'élastique, pas de rebond. Une révélation apparaît en fondu, monte et se défloute ; le contraste AA se juge au repos : les audits d'accessibilité (axe dans Playwright et Storybook) s'exécutent en mouvement réduit, où chaque élément est dans son état final.

## YAML de brief (§15)

```yaml
brand:
  name: Pitchorium
  domain: réseau professionnel et financement à impact (ONG, impact)
  matter: papier mat au motif d'élévation (overlay des fonds de marque)
  tokens: { bg: '#F7F7F5', ink: '#121212', accent: '#3E285D', pale: '#EAE4F2' }
  type: { display: Bricolage Grotesque 800, body: Poppins }

clock: R1
engines: [E0, E1, E3]
dialect:
  primary: D4
  secondary: null

hero:
  title: web.home.title
  lede: web.home.lede
  ctas: []
  extras: [{ text: web.home.eyebrow, role: copy }]
  partners: []

matter:
  hero: public/brand/overlay-desktop.svg
  macro: ''
  webgl: false
  grain: false

scatter: []
morph: []
stagger: []
horizontal: []
stack: []
scrub: null
flip_grid: []
observer_slides: []
infinite: []
kinetic: null

rest:
  - { id: foundations, items: [fonts, theme, locales, motion] }

footer: { wordmark: '', links: [], social: [] }

cursor: false
page_transition: fade
preloader: false
velocity_skew: false
reduced_motion: honor
```

Les champs vides sont des primitives absentes. Le héros et les sections sont ceux de l'accueil provisoire ; l'accueil éditorial reprendra ce YAML avec ses sections.

## Tokens

Deux courbes seulement : `enter` `cubic-bezier(0.16, 1, 0.3, 1)` (arrivées, micro-interactions, remplissages) et `curtain` `cubic-bezier(0.76, 0, 0.24, 1)` (rideaux, révélation circulaire). Durées : pression 150 ms, micro 200 ms, page 320 ms, révélation 600 ms, remplissage 800 ms, thème 700 ms, compteur 1 400 ms. Source TypeScript `apps/web/src/components/motion/tokens.ts`, variables CSS `--ease-*` et `--duration-*`, courbe GSAP `pitchorium-enter` (CustomEase) : un test vérifie l'égalité.

## Catalogue des micro-interactions

| Geste                         | Primitive                                                         | Recette                                                                                                                           | Mouvement réduit           |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Pression d'un bouton          | utilitaire `press`                                                | `scale(0.96)`, 150 ms, `enter`                                                                                                    | aucune échelle             |
| Survol du bouton principal    | `Button` (H21), classe `circle-fill`                              | disque violet soutenu (`accent-strong`) depuis le bas, `clip-path: circle()`, 800 ms, `enter`                                     | état final immédiat        |
| Échange d'icône               | `IconSwap` (transition CSS)                                       | `scale 0.25 vers 1` et flou de 4 px, courbe `enter`, 320 ms                                                                       | état final immédiat        |
| Nombre animé (H17)            | `AnimatedNumber`                                                  | comptage à l'entrée dans l'écran, pas de la devise, formateur localisé                                                            | valeur finale, sans compte |
| Compte d'un composant serveur | `Count` (`components/ui`)                                         | `AnimatedNumber` formaté dans la langue de la page : connexions, abonnés, visites                                                 | valeur finale, sans compte |
| Échange de libellé            | `LabelSwap` (classe `label-swap`)                                 | libellés dans une même cellule (largeur du plus long, aucun saut), le nouveau monte en fondu, l'ancien sort vers le haut, 320 ms  | libellé final immédiat     |
| Anneau d'envoi                | `ProgressRing`                                                    | le trait glisse vers la part envoyée (`--duration-page`), un quart qui tourne pendant les vérifications                           | anneau immobile            |
| Révélation au défilement (E1) | `Reveal`                                                          | fondu, montée de 24 px et flou de 6 px liés au défilement, repli IO                                                               | contenu en place           |
| Indicateur partagé            | `SharedIndicator` (`layoutId`, Motion chargé à l'inactivité)      | glissement de l'indicateur actif, ressort sans rebond                                                                             | saut immédiat              |
| Compteur qui change           | `CountBadge` (classe `count-roll`)                                | la nouvelle valeur monte du bas en fondu, courbe `enter`, 320 ms                                                                  | aucune                     |
| Transition de page (niveau 1) | `PageTransition` (templates des groupes)                          | View Transitions (repli CSS) : sortie en fondu 200 ms, entrée fondu et montée 320 ms                                              | aucune                     |
| Bascule de thème (H14, n. 3)  | `ThemeToggle`                                                     | nouveau thème en cercle depuis le bouton, 700 ms, `curtain`                                                                       | simple fondu de 150 ms     |
| Titre éditorial (H13)         | `SplitHeading` (GSAP SplitText, à la demande)                     | lignes masquées montant de 110 %, décalage de 80 ms, rejoué en arrière                                                            | titre immobile             |
| Apparition du logo            | `animate-brand-enter`                                             | opacité et montée de 6 px, 220 ms (règle du guide)                                                                                | aucune                     |
| Panneau de langue             | `LanguageSwitcher`                                                | opacité et `scale(0.96)`, 200 ms                                                                                                  | aucune                     |
| Chargement d'une page         | `PageLoading`                                                     | barre indéterminée violette (`accent`)                                                                                            | barre immobile             |
| Palier atteint (H18 puis H17) | `FundingProgress`, classe `drawn-stroke`                          | cercle puis coche dessinés en couleur de succès (800 ms, décalés de 120 ms par palier), puis le montant compte                    | état final                 |
| Panneau de marque (D4 sobre)  | classe `editorial-reveal` (`AuthFrame`)                           | ses trois lignes : fondu, montée de 24 px et défloutage, 600 ms, décalées de 80 ms, une fois                                      | contenu en place           |
| Collage d'un code             | `OtpInput`, attribut `data-pasted`                                | chaque chiffre collé monte et grandit (6 px, 0,9) en fondu, 320 ms, décalé de 40 ms par case                                      | chiffres en place          |
| Confirmation (H18)            | `DrawnCheck`, classe `drawn-stroke`                               | cercle puis coche dessinés en couleur de succès, 800 ms                                                                           | état final                 |
| Force du profil               | `Progress`                                                        | la barre glisse vers la nouvelle valeur de l'api, 320 ms, `enter`                                                                 | saut immédiat              |
| Boutons de relation           | `RelationshipActions`, `FollowButton` (`IconSwap` et `LabelSwap`) | un seul bouton change d'état (Se connecter, En attente, En relation ; Suivre, Suivi) sans changer de largeur                      | état final immédiat        |
| Aperçu d'un membre            | `MemberHoverCard` (`HoverCard`)                                   | ouverture après 500 ms au survol ou au focus, relation lue à la première ouverture                                                | aucune animation           |
| Squelette                     | `Skeleton`                                                        | reflet discret qui traverse (1,6 s, `curtain`)                                                                                    | squelette immobile         |
| Dialogue, panneaux            | `DialogContent`, `SheetContent`, `Drawer`                         | fondu et montée de 16 px, glissement latéral, tirage du bas (vaul)                                                                | aucune                     |
| Voile d'une superposition     | `backdrop`                                                        | fondu 320 ms, sortie 200 ms                                                                                                       | aucune                     |
| Sélecteur de réactions        | `ReactionControl`, classe `reaction-pop`                          | les quatre réactions montent et grandissent (6 px, 0,6) en fondu, 200 ms, décalées de 40 ms ; échange d'icône (`IconSwap`)        | état final immédiat        |
| Compteur de réactions         | `ReactionSummary`, classe `count-roll`                            | le nouveau total monte du bas, 320 ms                                                                                             | aucune                     |
| Pastille des nouveautés       | `NewerPill`, classe `pill-in`                                     | glisse depuis le haut en fondu, 320 ms, `enter`                                                                                   | apparition immédiate       |
| Composeur, visionneuse        | `ComposerDialog`, `ImageViewer`                                   | dialogue du système ; la visionneuse part de la miniature (View Transitions, nom partagé) quand le navigateur le permet           | ouverture sans transition  |
| Survol d'une image            | `PostImages`, `PostLink`                                          | `scale(1.04)` dans un cadre `overflow: hidden`, 320 ms                                                                            | aucune échelle             |
| Publication masquée           | `FeedList`, classe `post-leave`                                   | sortie par translation et fondu (320 ms, `curtain`), les suivantes remontent par une transformation (FLIP), jamais par la hauteur | retrait immédiat           |

Moins de mouvement veut dire `prefers-reduced-motion: reduce`, `prefers-reduced-data: reduce` ou `navigator.connection.saveData` (`useMotionPreference`) : pas de lecture automatique de vidéo, chaque primitive montre son état final. Le rendu serveur montre toujours l'état final : aucune première peinture n'attend une animation.

## Contrôles (QA §14)

- Tests Vitest des primitives en mouvement complet et réduit, de la bascule de thème (cercle, puis fondu).
- Captures de référence en mouvement réduit (1280x800 et 390x844, deux thèmes).
- GSAP absent des bundles de l'espace membre : règle ESLint et `scripts/check-bundles.mjs`.
- Budget §1.4 : un dialecte, aucun pin, aucun WebGL, aucun curseur, aucune marquee.
