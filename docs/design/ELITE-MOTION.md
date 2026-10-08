# ELITE MOTION — bible de mouvement

> Référence externe fournie avec le projet, reprise telle quelle hors séparations décoratives. Les fichiers qu'elle cite (`CINEMATIC-SCROLL.md`, `.grok/skills/...`) ne font pas partie du dépôt. Son application à Pitchorium est décrite dans `docs/design/motion.md`.

**WebGL · GSAP 3 · scroll cinématique · micro-interactions · transitions de page**

Document **autonome**. Une IA qui le lit doit pouvoir concevoir le **mouvement**
d’un site **quelconque** — autre domaine, autres sections, autre N — au
standard Awwwards / studio. Pas un clone d’[ordalie.com](https://ordalie.com/en/).

Ordalie est un **spécimen** (dialecte D1). Ce fichier est la **langue** et
la **palette**. Les sections de l’utilisateur dictent la partition.

Si l’utilisateur veut _strictement_ « les mêmes effets qu’Ordalie » → suivre
aussi `CINEMATIC-SCROLL.md` (horloge D1 figée). Si le domaine ou les
sections divergent, **ce document gagne**.

## 0. Comment coller ce fichier

En tête de prompt :

> Lis `ELITE-MOTION.md` en entier. Exécute l’algorithme §4. Choisis UN
> dialecte primaire + au plus UN secondaire (§5). Remplis le YAML §15.
> Implémente. QA §14. N’invente pas un 3ᵉ dialecte. Respecte le budget §1.4.
> Les champs YAML vides = primitives absentes (ne pas les « remplir » avec
> le spécimen Ordalie).

Puis coller : marque, domaine, **liste complète des sections**, références
visuelles, contraintes (mobile, perf, reduced-motion).

**Conflits**

| Gagne                                           | Perd                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Contenu / domaine / N sections de l’utilisateur | Le spécimen Ordalie (3+3)                                                     |
| Ce fichier sur le **mouvement**                 | « mets un carousel », « Lenis partout », « WebGL sur chaque section »         |
| `CINEMATIC-SCROLL.md`                           | Ce fichier, **uniquement** si l’utilisateur exige le dialecte D1 mot pour mot |

## 1. Doctrine

### 1.1 Ce que « elite » veut dire

Elite ≠ plus d’animations. Elite =

1. **Une horloge unique** (scroll, ou observer, jamais les deux en même temps).
2. **Des calques** (fond / matière / UI / chrome) qui ne s’appartiennent pas.
3. **Des fenêtres qui se chevauchent** (handoff), pas un diaporama.
4. **Tout est rewindable** : reculer la molette = rembobiner.
5. **Un matériau** (soie, grain, fluide, métal, papier, tissu, nappe, béton)
   qui vit **plus longtemps** que le copy.
6. **Le reste du site redevient un document** — on ne pinne pas la FAQ.

Si ça bounce, si ça carousel, si tout arrive d’en bas à 0.6 s d’ease, ce
n’est pas ce standard.

### 1.2 Propriétés animables (loi)

Animer **uniquement** `transform`, `opacity`, `filter`, `clip-path`,
et les **uniforms WebGL**. Jamais `top`, `left`, `height`, `margin`,
`width` (sauf Flip, qui s’en charge via une mesure unique).

### 1.3 Interruptibilité

- Hover / press / toggle → **CSS transition** (retargetable).
- Timeline scrubbée au scroll → **GSAP `scrub`** ou `p` CSS, pas
  `animation-fill-mode: forwards`.
- WebGL → uniforms dérivés de `p` ou de la souris, **pas** un
  `requestAnimationFrame` qui ignore le scroll.

### 1.4 Budget (si tu le dépasses, ce n’est plus elite, c’est une démo)

| Slot                                    | Maximum                                     |
| --------------------------------------- | ------------------------------------------- |
| Dialecte primaire                       | **1**                                       |
| Dialecte secondaire                     | **0 ou 1**                                  |
| Surfaces WebGL                          | **1**, exceptionnellement 2 (hero + footer) |
| Chapitres pinnés / sticky               | **3**                                       |
| Hijack de molette (Observer / fullpage) | **0**, ou **1** zone courte                 |
| Custom cursor                           | **1** (desktop only)                        |
| Marquee infinie                         | **1**                                       |
| REST (document flow)                    | **illimité**                                |

Mobile : descendre d’un cran (pas de WebGL lourd, pas de hijack, scatter
en colonne, morph en slot unique conservé, rail horizontal cassé en pile).

`prefers-reduced-motion: reduce` → sauter à l’état « on » de chaque
section, couper marquees, WebGL freeze sur le 1er frame, pas de cursor
custom, pas de preloader film.

## 2. Palette — ce que tu as le droit de jouer

Tu **choisis** dans cette liste. Tu n’inventes pas un 43ᵉ effet. Chaque
entrée pointe vers un dialecte (D) ou une primitive (H). Les nombres
sont au §5 / §6.

### 2.1 Structure (un, plus un secondaire max)

| Code                    | Effet en une phrase                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **D1** PINNED_MATTER    | Texture collée, preuves en nuage, zoom fibre, cartes qui se **morphent** dans un slot, puis document pale |
| **D2** HORIZONTAL_OPERA | Le scroll vertical pousse une frise pinnée                                                                |
| **D3** STICKY_STACK     | Les cartes s’empilent, celle du dessous recule                                                            |
| **D4** EDITORIAL_REVEAL | Pas de pin long : type masqué + images en clip                                                            |
| **D5** WEBGL_STAGE      | Un canvas, le scroll écrit des uniforms, le DOM est du chrome                                             |
| **D6** SLIDE_OBSERVER   | 4–8 slides plein écran, puis skip vers REST                                                               |
| **D7** PRODUCT_SCRUB    | Vidéo ou séquence d’images liée au scroll                                                                 |
| **D8** STUDIO_FLIP      | Grille → plein écran, **même nœud DOM**                                                                   |
| **D9** INFINITE_STRIP   | Boucle sans couture de cadres plein écran                                                                 |
| **D10** KINETIC_TYPE    | Le type **est** la matière (variable font, vidéo dans les glyphes)                                        |

### 2.2 Beats (s’utilisent **dans** un dialecte)

| Code                      | Effet                                                         |
| ------------------------- | ------------------------------------------------------------- |
| **H1** Hero               | Plein écran, copy / CTA / chrome ont des fenêtres différentes |
| **H2** Scatter            | 2–8 preuves en nuage (pas une grille)                         |
| **H3** Zoom / material    | La matière se resserre puis plonge dans sa fibre              |
| **H4** Slot morph         | 2–6 cartes, **un** slot, handoff 0.1 s                        |
| **H5** Stagger stack      | Serré, souvent colonne, sortie en éventail                    |
| **H6** REST               | Plus de pin, reveal local, N illimité                         |
| **H7** Horizontal pin     | Recette de D2, utilisable en secondaire                       |
| **H8** Sticky stack       | Recette de D3                                                 |
| **H9** Scrub              | `currentTime = p * duration` ou frame                         |
| **H10** Flip              | Grille → full, pas de clone                                   |
| **H11** Clip / curtain    | `clip-path: inset()` ou rideau couleur marque                 |
| **H12** Parallax          | ≤ 10 % de l’élément, jamais sur du texte lisible              |
| **H13** Split text        | Lines / words ; char seulement pour un mot-marque             |
| **H14** Page transition   | Fade, curtain, ou circle-expand depuis le CTA                 |
| **H15** Cursor / magnetic | Desktop `pointer: fine`, lerp, ≤ 8–12 px                      |
| **H16** Marquee           | Track dupliqué, mask 12–88 %, tuée au 1er scroll en D1        |
| **H17** Counter           | Snap entier, formatter dans `onUpdate`                        |
| **H18** Draw / MorphSVG   | Un trait, un picto, un plan — pas le logo entier              |
| **H19** WebGL matter      | Soie, displacement, fluide, vidéo-texture                     |
| **H20** Field             | < 8 k points, attracteur souris                               |
| **H21** Circle-fill       | Disque depuis le **bas** du bouton, 0.8 s                     |
| **H22** Color wash        | Tween du **token** de page (cream → pale), rewind             |
| **H23** Pinned side       | Copy sticky, media qui défile, 3–5 crossfades                 |
| **H24** Scale-crop        | On **entre** dans l’image (`scale 1.2→1` ou inset)            |
| **H25** Preloader         | Boot film 1.2–2.4 s, matière in **avant** le type             |
| **H26** Velocity skew     | ±6°, images d’une frise, jamais le body text                  |
| **H27** Variable font     | `wght` / `opsz` / `ital` liés à `p`                           |
| **H28** Video-in-type     | Vidéo clippée dans les glyphes d’un mot                       |
| **H29** Footer reveal     | Le footer est **sous** la page, on le découvre                |
| **H30** Hotspot           | 3–8 puces numérotées sur un visuel, copy à côté               |
| **H31** Grid warp         | Hover = bosse gaussienne sur un atlas d’images                |
| **H32** Camera dolly      | Caméra Three sur une courbe, `p` = t                          |

### 2.3 Micro (tiens le site quand le scroll s’arrête)

Press `scale(0.96)` · H21 circle-fill **ou** underline scaleX · icon swap
`scale 0.25↔1 + blur 4, bounce 0` · image hover `scale(1.04)` dans un
overflow hidden · input focus = ring token, pas de glow.

Hors palette (donc hors brief, sauf justification de domaine) : elastic
scroll, fireworks, bloom par défaut, Lottie partout, carousel dots,
hijack de tout le site, 3D text sur chaque titre.

## 3. Horloge + moteur (décider AVANT le design)

### 3.1 Trois régimes — en choisir **un**

| Régime          | Quand                                                                                               | Interdits                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **R1 Native**   | D1, couches `position: fixed` contre le viewport                                                    | Lenis, Locomotive, ScrollSmoother, `transform` sur `html`/`body`      |
| **R2 Lissé**    | Portfolio / agence / e-com où **tout** le pin passe par `ScrollTrigger.pin` (pas de `fixed` maison) | Mélanger des `position:fixed` « viewport » avec un wrapper transformé |
| **R3 Observer** | 4–8 slides plein écran, une histoire stricte (lookbook, pitch)                                      | Plus de 8 slides ; combiner avec un long document scroll              |

**R1 — native (spécimen Ordalie).** `progress` dérive de `scrollY`.
Les calques `fixed` restent collés à la fenêtre. Le plus fidèle, le plus
fragile.

**R2 — lissé (Lenis **ou** ScrollSmoother).** Autorisé **seulement** si
tous les pins sont des `ScrollTrigger.pin` (`pinType: "transform"` dès
qu’un ancêtre est transformé). Wiring Lenis 2026 :

```js
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({ autoRaf: false });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

Un seul rAF. Pas Lenis.raf **et** gsap.ticker. Modale : `lenis.stop()` /
`lenis.start()`, pas `overflow:hidden` seul.

ScrollSmoother (alternative R2, GSAP-native) :

```js
ScrollSmoother.create({
  wrapper: '#smooth-wrapper',
  content: '#smooth-content',
  smooth: 1.1,
  effects: true,
  normalizeScroll: true,
});
```

**Interdit** sur D1 à calques `fixed`.

**R3 — Observer (hijack).** La molette avance un **index**, pas un
`progress` continu. Rewind = index--. Recette §7.8. Un bouton skip
**tue** l’Observer et restitue le scroll natif pour les REST.

### 3.2 Moteurs — en empiler au plus 3

| Code   | Moteur                                                              | Sert à                                                 |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------ |
| **E0** | CSS `transition`                                                    | Hover, press, toggle, focus                            |
| **E1** | CSS keyframes + `animation-timeline: view()\|scroll()`              | Reveals REST, parallax léger. **Fallback obligatoire** |
| **E2** | GSAP core (tween / timeline)                                        | Load, curtain, wells intérieurs                        |
| **E3** | GSAP ScrollTrigger                                                  | Pin, scrub, batch, horizontal, snap                    |
| **E4** | Flip, SplitText, MorphSVG, DrawSVG, Observer, Draggable, MotionPath | Layout morph, type, SVG, hijack, slider                |
| **E5** | Canvas 2D                                                           | Grain, trail souris léger, < 400 particules            |
| **E6** | WebGL (Three / R3F / OGL / fragment)                                | Matière, displacement, fluide, field, GLTF             |
| **E7** | Rive / Lottie                                                       | **Un** micro (icône, loader), jamais l’horloge         |

GSAP est **100 % gratuit** depuis avril 2025 (Webflow), plugins Club
inclus. `npm i gsap @gsap/react`.

```js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Observer } from 'gsap/Observer';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { TextPlugin } from 'gsap/TextPlugin';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(
  ScrollTrigger,
  Flip,
  SplitText,
  MorphSVGPlugin,
  DrawSVGPlugin,
  Observer,
  Draggable,
  InertiaPlugin,
  MotionPathPlugin,
  ScrambleTextPlugin,
  TextPlugin,
  ScrollToPlugin,
  ScrollSmoother,
  CustomEase,
);
```

N’enregistrer **que** ce qui est utilisé. React : tout GSAP vit dans
`useGSAP({ scope })` (ou `gsap.context` + `revert()`).
`ScrollTrigger.refresh()` après `document.fonts.ready` et les images hero.

### 3.3 Arbre de décision (10 secondes)

```
Le fond est une MATIÈRE qui reste pendant 3+ chapitres ?
  oui → D1 ou D5. Horloge R1 (si fixed) ou R2 (si ST.pin)
Le scroll doit raconter des CASES horizontales ?
  oui → D2 HORIZONTAL_OPERA
Les cartes s'EMPILENT (stack) ?
  oui → D3 STICKY_STACK (CSS sticky d'abord)
C'est un éditorial / magazine / resto (type + images, peu de pin) ?
  oui → D4 EDITORIAL_REVEAL
Un canvas unique, le DOM est du chrome ?
  oui → D5 WEBGL_STAGE
Lookbook / pitch 5–8 slides, ordre strict ?
  oui → D6 SLIDE_OBSERVER
Produit physique / 36-views / before-after / walkthrough ?
  oui → D7 PRODUCT_SCRUB
Grille de projets → page projet ?
  oui → D8 STUDIO_FLIP
Galerie plein écran qui boucle ?
  oui → D9 INFINITE_STRIP
Le type EST le visuel (revue, festival, studio type-first) ?
  oui → D10 KINETIC_TYPE
Sinon → D4 + REST. Ne force PAS D1.
```

## 4. Algorithme — n’importe quel site, n’importe quelles sections

Exécuter **dans l’ordre**. Écrire le YAML §15 **avant** le code. C’est
la raison d’être de ce fichier : l’utilisateur arrivera avec 4, 8 ou 14
sections qui ne ressemblent **pas** à Ordalie.

### 4.1 Inventaire

Lister chaque bloc que l’utilisateur a nommé, **sans en inventer** :

```
id, job-to-be-done, media (photo/video/webgl/ui/type), N items
```

Si l’utilisateur dit « et le reste on verra » : tu n’ajoutes que
`REST: { id: contact }` et le footer. Pas un scatter fantôme.

### 4.2 Choisir le dialecte primaire

Un seul. Le domaine **ne dicte pas** le dialecte ; la **matière** et le
**récit** le dictent. §3.3 et mappings §11. Si ça ne colle pas : **D4 + REST**.

### 4.3 Classer chaque bloc dans **une** primitive

| Le bloc est…                                                        | Primitive                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| Titre + lede + 1–3 CTA + logos                                      | **H1 Hero**                                           |
| 2–8 preuves / KPI / piliers qui doivent **coexister** dans l’espace | **H2 Scatter** (si D1/D5) sinon **H5** ou REST grille |
| Gros plan matière / plongée, presque sans UI                        | **H3 Zoom**                                           |
| 2–6 features à raconter **une par une, même cadre**                 | **H4 Slot morph**                                     |
| Citations, chips, extraits serrés                                   | **H5 Stagger**                                        |
| Gallery / cases en frise                                            | **H7 / D2**                                           |
| Cartes qui s’empilent                                               | **H8 / D3**                                           |
| Vidéo, séquence, 360, explode, walkthrough                          | **H9 / D7**                                           |
| Grille de travail qui s’ouvre                                       | **H10 / D8**                                          |
| Lookbook 4–8 looks, ordre strict                                    | **D6**                                                |
| Long-form + images                                                  | **D4** + H13 + H11                                    |
| Chiffre isolé                                                       | **H17** (dans H2 ou REST)                             |
| Mot-marque cinétique, vidéo dans le glyphe                          | **H27 / H28 / D10**                                   |
| Objet annoté                                                        | **H30**                                               |
| Confiance, FAQ, pricing, team, news, menu, contact, légal, footer   | **REST — toujours**                                   |

Règles de triage :

- Un **pricing 3 colonnes** = REST. Un « comment ça marche » 4 étapes
  plein écran = H4. Une équipe de 8 portraits = REST grille, **ou** H10
  si chaque portrait ouvre un cas.
- Si un bloc ne rentre nulle part : REST + reveal E1. **Ne pas** créer
  une primitive ad hoc.
- **N libre.** Scatter 2–8, morph 2–6, REST illimité. Le spécimen 3+3
  n’est **pas** une contrainte.

### 4.4 Ordonner

```
H25 LOAD (matière in, type après)
  → chapitres du dialecte primaire (ordre du dialecte, §5)
  → [un chapitre du dialecte secondaire]
  → REST × N (ordre métier)
  → H29 footer (ou footer document)
```

On n’insère **pas** un REST au milieu d’un pin. On n’enchaîne pas deux
pins horizontaux. Le footer n’est jamais Observer. La FAQ n’est jamais
pinnée.

### 4.5 Horloge + moteurs + hauteurs

§3 et §12. Une phrase dans le YAML : `clock: R1`, `engines: [E3, E6, E0]`.
Si `H_cinematic > 1200vh`, trop pinné : basculer des chapitres en REST.

### 4.6 YAML, puis code, puis QA

Pas de code avant le YAML. Pas de « c’est fini » avant le QA §14.

### 4.7 Exemple d’exécution (sections arbitraires)

Utilisateur : _« resto, hero, 3 photos du service, menu, cave, équipe,
réservation »_.

```
inventaire     H1, 3 photos, menu, cave, team, reserve
dialecte       D4 (éditorial). Pas D1 (pas de matière-opéra), pas D6
               (pas un lookbook).
classification H1 hero
               3 photos → H11 clip + H12 parallax léger, DANS le flux D4
               menu, cave, team, reserve → REST
horloge        R1, engines [E1, E4, E0]
secondaire     aucun (un H9 service.mp4 peut s’insérer en REST, ce n’est
               pas un dialecte)
YAML           scatter: []  morph: []  observer_slides: []
```

C’est **correct**. Un morph « nos 3 valeurs » serait une trahison.

## 5. Dix dialectes (en choisir un primaire)

Chaque dialecte : effet, ordre des chapitres, moteur minimum, interdits.

### D1 — PINNED_MATTER (spécimen Ordalie)

Une texture plein écran reste collée. Le copy part, les preuves arrivent
**par-dessus les CTA encore visibles**, le fond zoome dans sa fibre,
**une carte à la fois** occupe le centre, puis le site redevient un
document pale.

```
LOAD → H1 Hero → H2 Scatter → H3 Zoom → H4 Slot morph
     → [H5] → REST* → footer wordmark
```

Moteur : **R1** + E3 (ou Port B sticky + CSS vars). WebGL **optionnel**
(upgrade de 2 `<img>` vers un shader, **même rythme**).

Interdit : Lenis, carousel de features, grille pendant H4, glass
permanente, hero copy `fixed` sans fade.

N : scatter 2–8, morph 2–6, REST illimité.
Formules : §12. Partition chiffrée : `CINEMATIC-SCROLL.md`.

### D2 — HORIZONTAL_OPERA

Le scroll **vertical** traduit une frise **horizontale** pinnée.

```
H1 (court) → pin width: n * 100vw → REST
```

```js
gsap.to('.rail', {
  x: () => -(rail.scrollWidth - innerWidth),
  ease: 'none',
  scrollTrigger: {
    trigger: '.pin-wrap',
    start: 'top top',
    end: () => '+=' + (rail.scrollWidth - innerWidth),
    scrub: 0.6,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
  },
});
```

H26 velocity skew **autorisé** sur les images du rail (±6°).
Mobile : **casser** en vertical (pas de pin horizontal sous `md`).

### D3 — STICKY_STACK

Chaque carte `sticky; top: calc(72px + i * 24px)` ; la suivante glisse
par-dessus. Scale 1 → 0.92 + overlay sur celle qui se fait recouvrir.

CSS d’abord. GSAP n’ajoute que overlay/scale si besoin.

```css
.stack {
  position: relative;
}
.card {
  position: sticky;
  top: calc(var(--header, 72px) + var(--i, 0) * 1.4rem);
  border-radius: 1.5rem;
}
```

N : 3–7. Au-delà, REST paginé.

### D4 — EDITORIAL_REVEAL

Pas de pin long. Le document scrolle. Titres en lignes (SplitText +
clip), images en `clip-path: inset()`, stagger 80–120 ms. Parallax
≤ 8 % de la hauteur de l’image.

Dialecte par défaut d’un magazine, d’un resto, d’un cabinet **sans** opéra.

### D5 — WEBGL_STAGE

Un canvas `fixed inset-0` derrière le DOM. Le scroll n’anime **plus**
des `<img>` : il écrit `uProgress`, `uSection`, `uMouse`. Le DOM est
typo + CTA. Recettes §8.

**1 canvas.** Changer de scène (couleur, noise, displacement) aux
frontières de sections, pas un canvas par section.

Ne pas combiner avec `@react-three/drei` `ScrollControls` si GSAP est
l’horloge — deux horloges = désync.

### D6 — SLIDE_OBSERVER

4–8 slides `100vh`. Molette / touch change l’index avec curtain ou clip.
Pagination dots. Escape : lien « skip » vers REST **hors** hijack.
Mobile : sections 100vh natives, **pas** d’Observer.

### D7 — PRODUCT_SCRUB

Image-sequence (24–120 frames) ou `<video preload>` dont
`currentTime = p * duration`. Pin 200–400 vh. Copy à côté (H23) change
aux keyframes 0 / 0.33 / 0.66 / 1.

Frames : WebP / JPEG, sprite **ou** `canvas.drawImage`. Pas 120 `<img>`
dans le DOM. iOS : `muted` + `playsinline` + `preload="auto"`.

### D8 — STUDIO_FLIP

Grille de thumbs. Clic : Flip capture l’état, la thumb devient hero
plein écran (**même nœud**), le reste curtain-in. Retour : Flip inverse.

### D9 — INFINITE_STRIP

Cadres plein écran qui **bouclent**. Duplication du premier cadre en
fin de piste ; quand `p` dépasse le seam, reset invisible de `scrollTop`.
Parallax de profondeur (calque mid vs back).

Safari iOS : l’address bar casse l’illusion — piste dans un scroller
interne + `ScrollTrigger.scrollerProxy`, ou **abandonner D9** sur iOS
au profit de D4.

N : 5–12 cadres. Un CTA persistant (coin) reste hors de la boucle.

### D10 — KINETIC_TYPE

Le type est la matière. Hero = un mot en variable font (H27) et/ou
vidéo clippée dans les glyphes (H28). Les chapitres suivants sont des
lignes qui s’empilent (H13) ou un Flip de mots (H10 sur du texte).

Peu de photo. Grain fort. Interdit : morph cards, scatter KPI, canvas
de particules « pour remplir ». Un seul mot en H28, jamais un paragraphe.

## 6. Primitives (alphabet)

S’utilisent **à l’intérieur** d’un dialecte. Idée, nombres, piège.

### H1 — Hero

Plein écran. Le **copy n’est pas `fixed`** en D1 (il doit pouvoir
partir). En D5 le copy peut être `fixed` **à condition** d’avoir une
fenêtre d’opacity.

| Rôle         | Comportement                                            |
| ------------ | ------------------------------------------------------- |
| `copy`       | Titre, lede — part tôt                                  |
| `cta`        | Boutons — restent pendant l’arrivée du chapitre suivant |
| `chrome`     | Marquee — meurt en premier (~140 px en D1)              |
| `persistent` | Header login / langue — tout le site                    |

Load (si matière) :

```js
gsap.fromTo(
  '.matter',
  { scale: 1.15, opacity: 0.7 },
  { scale: 1, opacity: 1, duration: 3, ease: 'power2.out' },
);
```

### H2 — Scatter (preuves)

N = 2–8. Desktop = **nuage**. Mobile = **colonne**.

```js
const n = items.length;
const st = Math.min(0.15, 0.45 / n);
tl.fromTo(items, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: st, duration: 1 })
  .to({}, { duration: 0.5 })
  .to(items, { opacity: 0, y: -200, stagger: st, duration: 1 });
```

Ancres desktop (icon tile, %) :

| N   | top/left                          |
| --- | --------------------------------- |
| 2   | 28/32, 48/58                      |
| 3   | 20/35, 36/57, 60/42               |
| 4   | 16/30, 22/62, 48/28, 58/60        |
| 5   | 14/32, 18/64, 42/26, 50/58, 68/40 |
| 6+  | deux rangées lâches, ±8–12 %      |

### H3 — Zoom / material

Hero texture scale ~1 → 0.7 (pendant H2) → ~2 et s’éteint. **Macro**
(même matière, gros plan) : `opacity 0→1`, `scale 0.8→1.15`,
`blur(20px)→0`. Chapitre presque sans UI.

Upgrade WebGL : même rythme, `uZoom` + crossfade de textures (§8.5).

### H4 — Slot morph

N = 2–6. **Un** slot, cartes **absolues, centrées, même taille**.
Handoff 0.1 s = morph, pas carousel.

```js
function morphCard(tl, sel) {
  tl.fromTo(sel, { opacity: 0, y: 40 }, { opacity: 1, duration: 0.3 })
    .to(sel, { y: -20, duration: 0.5, ease: 'none' })
    .to(sel, { opacity: 0, y: -30, duration: 0.1 });
}
// séquentiel, PAS de "<" entre les cartes
```

À tout instant : au plus **une** carte `opacity ≥ 0.6`.
`H_morph = n * 100vh`. Largeur `min(92vw, 520px)` (D1) ;
`min(92vw, 720px)` si le well l’exige.

Verre = blanc à opacity < 1 **pendant l’in**. Au hold, **solide**.
Pas de `backdrop-filter` permanent, pas de blob violet.

Well intérieur **joue une action** à l’entrée, rewind à la sortie
(marquee / typewriter / generate / video / mini-UI). Pas une image morte.

### H5 — Stagger stack

Serré, souvent colonne. Sortie `y: (i) => -150 - i * 50`.

### H6 — REST

Plus de pin. Fade d’entrée local (`opacity + y 16–24`, 0.5–0.8 s).
Wash de page déjà basculé dès la **première** REST (H22). Illimité.

### H7 — Horizontal pin

Voir D2. Snap optionnel : `snap: 1 / (n - 1)` si chaque panel est un
chapitre ; **pas** de snap si frise continue.

### H8 — Sticky stack

Voir D3. Progress par carte : scale + brightness de celle du dessous.

### H9 — Scrub (vidéo / séquence)

```js
const video = el.querySelector('video');
video.pause();
ScrollTrigger.create({
  trigger: el,
  start: 'top top',
  end: '+=300%',
  pin: true,
  scrub: 0.4,
  onUpdate: (self) => {
    if (video.duration) video.currentTime = self.progress * video.duration;
  },
});
```

### H10 — Flip (grille → full)

```js
const state = Flip.getState(card);
stage.appendChild(card); // même nœud
Flip.from(state, {
  duration: 0.8,
  ease: 'power2.inOut',
  absolute: true,
  onComplete: () => openCopy(),
});
```

Ne **jamais** cloner le nœud.

### H11 — Clip / curtain / mask

Prefer `clip-path: inset()` (GPU) à `height`.

```js
gsap.fromTo(
  '.panel',
  { clipPath: 'inset(100% 0 0 0)' },
  { clipPath: 'inset(0% 0 0 0)', duration: 1.1, ease: 'power4.inOut' },
);
```

Rideau studio : `fixed inset-0` couleur marque, `yPercent: -100 → 0 → -100`
en 2 tweens, swap de contenu au milieu.

### H12 — Parallax

Déplacement **≤ 10 %** de l’élément. Un calque mid, un back. Jamais sur
du texte lisible.

### H13 — Split text

```js
const split = SplitText.create('.h', { type: 'lines,words', mask: 'lines' });
gsap.from(split.words, {
  yPercent: 110,
  stagger: 0.04,
  duration: 1.1,
  ease: 'power4.out',
  scrollTrigger: { trigger: '.h', start: 'top 80%' },
});
```

3 usages : line mask (titres) · word stagger (lede 8–16 mots) · char
uniquement pour un mot-marque ≤ 18 glyphes. Jamais un split caractère
sur un paragraphe.

### H14 — Page transition

Trois grades :

1. Fade + rise 200–400 ms (REST interne, modales).
2. Curtain couleur marque 900–1200 ms `power4.inOut`, swap au milieu.
3. Circle expand depuis le bouton (`clip-path: circle(0% at x y) → 150%`).

Une seule transition pour tout le site. `prefers-reduced-motion` → fade
150 ms. Le load H25 **attend** la fin du curtain.

View Transitions API si navigation native :

```js
document.startViewTransition(() => router.navigate({ to: href }));
```

```css
::view-transition-old(root) {
  animation: fade 0.4s ease-out both;
}
::view-transition-new(root) {
  animation: rise 0.5s ease-out both;
}
.hero-img {
  view-transition-name: hero;
}
```

Morph thumb→hero **cross-page** : `view-transition-name` unique sur
l’image. Sinon Flip in-page (D8). Fallback : curtain H11.

### H15 — Cursor / magnetic

Desktop `pointer: fine` uniquement. Cercle 12–40 px, lerp 0.15–0.22.
Magnetic : le bouton attire le curseur de **≤ 12 px**, le bouton lui-même
de **≤ 8 px**. Mix-blend `difference` **ou** couleur marque, pas les deux.

`gsap.quickTo` pour le lerp (pas un rAF artisanal). Cacher le curseur
natif **uniquement** quand le custom est monté.

### H16 — Marquee

Track dupliqué, `translateX(-50%)`, linear infini. Mask `12%–88%`.
Tue-la au premier scroll en D1 (`+=140`, scrub 0.6). `paused` sous
reduced-motion.

### H17 — Counter

Scrub ou `once`. `snap: { textContent: 1 }`, duration 1.4, `power1.out`.
Formatter (`12 000`, `98 %`) dans `onUpdate`.

### H18 — DrawSVG / MorphSVG

```js
gsap.from('.sig', { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut' });
gsap.to('#from', {
  morphSVG: { shape: '#to', shapeIndex: 'auto' },
  duration: 0.8,
  ease: 'power2.inOut',
});
```

Une signature, un picto, un trait de plan. Pas un logo morphé à chaque hover.

### H19 — WebGL matter

§8. Une surface. Fallback : 2 stills (D1) ou un CSS gradient animé.

### H20 — Field (particules)

Instanced points, attracteur souris, **< 8 k** desktop, **< 2 k** mobile.
Couleur = tokens. Pas de fireworks, pas d’explosion on-load.

### H21 — Circle-fill (hover bouton, spécimen Ordalie)

Un disque blanc (`scale 0 → 1.15`) depuis le **bas** du bouton, 0.8 s
`cubic-bezier(.25, 1, .3, 1)`. Le label passe ink → inverse via
`mix-blend` ou deux labels. Mieux qu’un `background-color` swap.

### H22 — Color wash

Tween du **token** CSS, pas de `style.background`. Rewind obligatoire.

```js
ScrollTrigger.create({
  trigger: '#rest-start',
  start: 'top bottom',
  onEnter: () =>
    gsap.to(document.documentElement, { '--bg': pale, duration: 3, ease: 'power1.inOut' }),
  onLeaveBack: () =>
    gsap.to(document.documentElement, { '--bg': cream, duration: 3, ease: 'power1.out' }),
});
```

C’est le pale-rest d’Ordalie, réutilisable sur n’importe quel dialecte.

### H23 — Pinned side copy

Colonne copy `sticky top: 20vh` pendant que le media (H7, H9, H24, H32)
défile à droite. Le copy **change 3–5 fois** (crossfade) aux bornes du
media. Mobile : copy au-dessus, plus de sticky.

### H24 — Scale-crop

Image dans un frame. Au pin, `scale 1.2 → 1` **ou**
`clip-path inset(12%) → inset(0)`. Sens : on **entre** dans l’image.

### H25 — Preloader / boot

1.2–2.4 s max. Compteur 0–100 **ou** un mot-marque qui se dessine
(H18). La matière (H19 / still) **commence pendant** le boot, le type
hero arrive **après**. Skip sous reduced-motion et sur repeat-visit
(`sessionStorage`).

Ne jamais bloquer le site 6 s sur un % qui ment.

### H26 — Velocity skew

```js
ScrollTrigger.create({
  onUpdate: (self) => {
    const v = self.getVelocity();
    gsap.to('.skew-target', {
      skewX: gsap.utils.clamp(-6, 6, v / -400),
      overwrite: 'auto',
      duration: 0.3,
    });
  },
});
```

Cap ±6°. Images d’une frise (D2/D9). Reset à 0 si `|v| < 50`. Jamais
sur du body text. RGB-split shader (§8.7) = la version WebGL du même geste.

### H27 — Variable font

```js
gsap.to('.display', {
  fontWeight: 900, // ou "--wght": 900 si axes CSS
  ease: 'none',
  scrollTrigger: { trigger: '.display', start: 'top 80%', end: 'top 20%', scrub: true },
});
```

Un axe à la fois (`wght` **ou** `opsz`, rarement les deux). Le glyphe
doit rester lisible à `opsz` min. Fallback : `font-weight` statique si
la face n’est pas variable.

### H28 — Video-in-type

```css
.word {
  font-size: clamp(4rem, 18vw, 14rem);
  line-height: 0.85;
}
.word video,
.word img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: inset(0);
}
/* ou background-clip */
.word span {
  background: url(#vid);
  -webkit-background-clip: text;
  color: transparent;
}
```

Un **mot**, pas une phrase. Contraste : tester la vidéo la plus claire
**et** la plus sombre. Reduced-motion : still du premier frame.

### H29 — Footer reveal

La page (`.page-up`) est `relative; z-index: 2; background: var(--bg)`.
Le footer est `sticky; bottom: 0; z-index: 1; min-height: 80vh`. En
fin de document, la page glisse vers le haut et **découvre** le footer.
Le footer n’est pas pinné ; c’est la page qui s’en va.

### H30 — Hotspot / produit annoté

3–8 puces. Clic / scroll : la puce active scale 1.15, le copy à droite
crossfade (H23). Pas un carousel de puces. Mobile : liste numérotée sous
l’image, plus de position absolute.

### H31 — Grid warp

Hover = bosse gaussienne sur un atlas (shader §8.11) **ou**, sans WebGL,
`transform: scale(1.04)` de la tuile + légère translation des voisines
(≤ 8 px). ≤ 12 tuiles visibles.

### H32 — Camera dolly

`CatmullRomCurve3` échantillonnée par `p`. `camera.lookAt(target)`.
Un path. Le copy reste du DOM (H23), pas du Troika 3D text — sauf un
seul mot en D10.

## 7. GSAP — recettes de production

### 7.1 Contexte React (obligatoire)

```ts
import { useGSAP } from '@gsap/react';
useGSAP(
  () => {
    // tous les tweens / ScrollTriggers ici
  },
  { scope: rootRef },
);
```

Sans `revert()`, hot reload = triggers fantômes.

### 7.2 ScrollTrigger — pièges

| Piège                          | Fix                                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| Pin jitter                     | `anticipatePin: 1`, images dimensionnées, `refresh()` après fonts |
| Pin mort sous Lenis            | `pinType: "transform"` + wiring ticker §3.1                       |
| `end` faux après resize        | `invalidateOnRefresh: true`, `end` en **fonction**                |
| `from()` qui rejoue au refresh | `immediateRender: false` ou `fromTo`                              |
| Batch DOM                      | `ScrollTrigger.batch(".card", { onEnter, start: "top 85%" })`     |
| snap combatif                  | `snap: { snapTo: 1/(n-1), duration: 0.3, ease: "power1.inOut" }`  |

```js
ScrollTrigger.defaults({
  toggleActions: 'play none none reverse',
  invalidateOnRefresh: true,
});
```

Scrub : `true` (1:1) pour morph/zoom ; `0.5–0.8` pour horizontal.
Jamais `scrub: 2`.

### 7.3 matchMedia

```js
const mm = gsap.matchMedia();
mm.add('(min-width: 768px)', () => {
  /* nuage, rail, magnetic */
});
mm.add('(max-width: 767px)', () => {
  /* colonne, pas de pin horizontal */
});
mm.add('(prefers-reduced-motion: reduce)', () => {
  gsap.set('[data-animate]', { clearProps: 'all', opacity: 1 });
});
```

### 7.4 CustomEase — deux signatures, pas un zoo

```js
CustomEase.create('curtain', 'M0,0 C0.76,0 0.24,1 1,1');
CustomEase.create('enter', 'M0,0 C0.16,1 0.3,1 1,1');
```

| Situation                  | Ease                                       |
| -------------------------- | ------------------------------------------ |
| Scrub matière, morph drift | `none`                                     |
| Load, titles               | `power2.out` / `power4.out` / `enter`      |
| Zoom out matière           | `power2.out` puis `power3.in` pour le fade |
| Curtain                    | `power4.inOut` / `curtain`                 |
| Hover micro                | CSS `cubic-bezier(0.2, 0, 0, 1)`           |
| Snap                       | `power1.inOut`                             |

Pas d’elastic, pas de bounce sur le scroll.

### 7.5 Flip — grille, filtres, onglets

Filtres : Flip sur les items qui restent, `stagger: 0.03`,
`absoluteOnLeave: true`, 0.5–0.7 s, `power2.inOut`.
Onglets : Flip la pastille `layout`, pas le contenu.

### 7.6 Load timeline

```js
const boot = gsap.timeline({ defaults: { ease: 'power2.out' } });
boot
  .set('.page', { opacity: 1 })
  .from('.matter', { scale: 1.15, opacity: 0.7, duration: 3 }, 0)
  .from('.h-line', { yPercent: 110, stagger: 0.06, duration: 1.2 }, 0.3)
  .from('.cta', { y: 16, opacity: 0, duration: 0.6 }, 0.9);
```

Le fond **commence avant** le type.

### 7.7 Magnetic (`quickTo`)

```js
const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
el.addEventListener('pointermove', (e) => {
  const r = el.getBoundingClientRect();
  xTo(gsap.utils.clamp(-8, 8, e.clientX - (r.left + r.width / 2)));
  yTo(gsap.utils.clamp(-8, 8, e.clientY - (r.top + r.height / 2)));
});
el.addEventListener('pointerleave', () => {
  xTo(0);
  yTo(0);
});
```

### 7.8 Observer (D6)

```js
let i = 0,
  animating = false;
const go = (dir) => {
  if (animating) return;
  const n = i + dir;
  if (n < 0 || n >= slides.length) return;
  animating = true;
  const tl = gsap.timeline({
    onComplete: () => {
      animating = false;
      i = n;
    },
  });
  tl.to(
    slides[i],
    { yPercent: dir > 0 ? -100 : 100, duration: 0.9, ease: 'power4.inOut' },
    0,
  ).fromTo(
    slides[n],
    { yPercent: dir > 0 ? 100 : -100 },
    { yPercent: 0, duration: 0.9, ease: 'power4.inOut' },
    0,
  );
};
Observer.create({
  type: 'wheel,touch,pointer',
  wheelSpeed: -1,
  onDown: () => go(1),
  onUp: () => go(-1),
  tolerance: 10,
  preventDefault: true,
});
```

### 7.9 Draggable + Inertia (slider studio, pas un carousel)

```js
Draggable.create('.strip', {
  type: 'x',
  inertia: true,
  bounds: { minX: min, maxX: 0 },
  edgeResistance: 0.85,
});
```

### 7.10 Port B — sticky + CSS vars (sans GSAP)

Quand on ne veut pas GSAP, ou un seul viewport pinné (D1 sandbox) :

```
section#cinematic.h-[H_cinematic]
  .sticky.top-0.h-screen.overflow-hidden
    matter / hero / scatter / morph
#rest…  footer
```

```ts
p = clamp(-section.getBoundingClientRect().top / (section.offsetHeight - innerHeight), 0, 1);
```

`windowOpacity(p, in0, in1, out0, out1)` : si `p < in0` return 0 —
**jamais** `<=` (sinon hero invisible à `p = 0`). Vars **inline au
premier paint**. Un seul `transform` par nœud.

**Ne pas mixer** Port A (GSAP sections) et Port B (sticky unique).

## 8. WebGL — matière, pas démo Three

### 8.1 Quand (et quand NE PAS)

| Faire du WebGL                                      | Ne pas                                        |
| --------------------------------------------------- | --------------------------------------------- |
| Une matière (soie, eau, métal, fumée, grain vivant) | Décorer un hero déjà fort en photo            |
| Displacement entre 2 textures au scroll / hover     | Un cube qui tourne « pour faire 3D »          |
| Un field lié à la souris                            | Fireworks, bloom partout                      |
| Un objet produit (packshot) qu’on oriente           | Un second canvas dans le footer « parce que » |

Fallback **obligatoire** : `<img>` ou CSS. Si WebGL fail / reduced-motion /
GPU low : still. Cap `dpr = min(devicePixelRatio, 2)` ; mobile `1.5` et
moins d’octaves.

### 8.2 Stack (10 secondes)

```
Un quad plein écran, 2 textures, noise     → OGL ou Three brut (pas R3F)
Displacement hover éditorial               → OGL / Three, 1 quad actif
Produit GLTF, lumières, transmission       → R3F + drei
Field < 8 k                                → InstancedMesh / Points
Fluide souris                              → FBO ping-pong, desktop only
Vrai jeu                                   → skill building-games / threejs
```

`npm i ogl` **ou** `npm i three` **ou**
`npm i three @react-three/fiber @react-three/drei`.

**Interdit** : `ScrollControls` (drei) **plus** GSAP. Le `p` DOM écrit
les uniforms.

```tsx
<Canvas
  className="pointer-events-none fixed inset-0 -z-10"
  dpr={[1, 2]}
  gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
  camera={{ position: [0, 0, 1], fov: 50 }}
>
  <MatterQuad progress={p} mouse={mouse} />
</Canvas>
```

### 8.3 Contrat d’uniforms (le seul pont)

```
uTime  uProgress  uSection  uMouse  uZoom  uHover  uVelocity  uReduced
```

Le shader **ne calcule pas** le scroll. Pause `useFrame` / rAF si canvas
`opacity: 0` ou `document.hidden`.

### 8.4 Vertex (quad)

```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### 8.5 Soie / painterly (upgrade D1)

Ordalie original = **2 `<img>`**, pas de WebGL. Le shader reprend le
**même rythme**.

```glsl
uniform sampler2D tHero, tMacro;
uniform float uTime, uProgress, uZoom;
uniform vec2 uMouse;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f *= f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

void main() {
  vec2 uv = vUv;
  float n = noise(uv * 3.0 + uTime * 0.03);
  uv += (n - 0.5) * 0.018;
  uv += (uMouse - 0.5) * 0.02;
  vec2 uvZ = (uv - 0.5) * (1.0 / mix(1.0, 1.7, uZoom)) + 0.5;
  vec4 a = texture2D(tHero, uvZ);
  vec4 b = texture2D(tMacro, uv * mix(1.0, 1.15, uProgress));
  gl_FragColor = mix(a, b, smoothstep(0.35, 0.7, uProgress));
}
```

`uZoom` : 0 → 0.3 (resserre) → 1 (macro).

### 8.6 Displacement hover

```glsl
vec2 disp = (texture2D(tNoise, vUv).rg - 0.5) * uHover * 0.12;
vec4 a = texture2D(tA, vUv + disp);
vec4 b = texture2D(tB, vUv - disp);
gl_FragColor = mix(a, b, uHover);
```

`uHover` lerp 0.12. Un visuel actif à la fois.

### 8.7 RGB split sur vélocité

```glsl
float a = uVelocity * 0.012;
float r = texture2D(tMap, vUv + vec2(a, 0.0)).r;
float g = texture2D(tMap, vUv).g;
float b = texture2D(tMap, vUv - vec2(a, 0.0)).b;
gl_FragColor = vec4(r, g, b, 1.0);
```

`uVelocity` vient de `ScrollTrigger.getVelocity()`, clamp, smooth.
Accent, pas un filtre permanent.

### 8.8 Fluide / trail souris

FBO ping-pong : splat souris (couleur marque, rayon 0.04) + dissipation
0.97 / frame. Le FBO module le visuel §8.5 (`uv += fbo.rg * 0.04`).
Mobile : **off**. Freeze si `fps < 40` deux secondes.

### 8.9 Field (H20)

Position = hash(id). Souris = attracteur `mix(pos, mouseWorld, 0.04)`.
Alpha par profondeur. Rotation `uTime * 0.02`. < 8 k / < 2 k.

### 8.10 Vidéo-texture

`THREE.VideoTexture`, `muted` + `playsInline` + `loop`. Mix `tStill → tVid`
avec `uProgress`. `video.pause()` quand le canvas est caché.

### 8.11 Grid warp (H31)

```glsl
vec2 d = vUv - uMouse;
float f = exp(-dot(d, d) / (uRadius * uRadius)); // uRadius ~ 0.25
vec2 uv = vUv + d * f * 0.08;
gl_FragColor = texture2D(tMap, uv);
```

### 8.12 Produit GLTF (D5 / D7)

R3F : `useGLTF` + `Environment preset="studio"` + `ContactShadows`.
`rotation.y = p * Math.PI * 2`. Transmission / iridescence seulement
si le matériau **est** du verre ou du métal. Stills des mêmes angles =
fallback. Mobile : stills, pas de GLTF.

H32 dolly : une `CatmullRomCurve3`, un target. Copy en DOM (H23).

### 8.13 Grain (presque toujours)

```css
.grain {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 80;
  opacity: 0.06;
  background-image: url('/grain.png'); /* 128² */
  animation: grain 0.4s steps(4) infinite;
}
@keyframes grain {
  to {
    transform: translate3d(-2%, -2%, 0);
  }
}
```

Sans grain, le shader sent le demo reel. Couper l’anim en reduced-motion ;
garder le tile statique.

### 8.14 Post / couleur

Un grade : lift des noirs vers le cream / pale. **Pas** d’UnrealBloom
par défaut. Si bloom : `threshold` haut, `strength < 0.4`. Jamais
FXAA + bloom + noise + DOF ensemble.

### 8.15 Chaîne de fallback (obligatoire)

```
1. WebGL matter
2. Context loss / GPU low  → still <img> des mêmes textures
3. prefers-reduced-motion  → premier frame figé (uTime = 0)
4. no-JS                   → le même still en HTML
```

Jamais un écran noir.

## 9. CSS scroll-driven + extras

### 9.1 `view()` / `scroll()` — REST et D4

Production 2026 : Chromium + Safari 18. Firefox encore inégal.
**Toujours** wrapper :

```css
@supports (animation-timeline: view()) {
  .rest-block {
    animation: rise linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 80%;
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
```

Le shorthand `animation:` reset `animation-timeline` à `auto`. Déclarer
`animation-timeline` **après**. Ne pas remplacer D1/D2/D5 par du CSS
scroll-driven (pas de pin complexe, pas de morph séquentiel robuste).

### 9.2 Son, haptique (hors Ordalie, même gamme)

Seulement si le domaine le justifie (lookbook, product film). Sinon silence.

- Whoosh < 200 ms, −18 dB, au **curtain** — jamais au scrub.
- `navigator.vibrate(10)` sur le CTA primary, mobile only.
- ScrambleText sur un kicker mono (fintech, cyber) — 0.4 s, une fois.
- MotionPath : un pictogramme sur un trait de plan (archi, logistique). Un path.

## 10. Curseur, magnetic, micro

Le micro **tient** un site elite quand le scroll s’arrête.

| Geste           | Recette                                           | Durée      |
| --------------- | ------------------------------------------------- | ---------- |
| Press bouton    | `scale(0.96)` CSS                                 | 150 ms     |
| Hover bouton    | Circle-fill H21 **ou** underline scaleX from left | 400–800 ms |
| Icon swap       | scale 0.25↔1 + blur 4, spring bounce **0**        | 300 ms     |
| Lien éditorial  | `background-size` underline                       | 300 ms     |
| Image hover D4  | `scale(1.04)` dans overflow hidden                | 700 ms     |
| Magnetic        | lerp 0.18, max 8–12 px                            | continu    |
| Cursor follower | deux cercles (dot + ring), ring delay             | continu    |
| Input focus     | caret / ring token, pas de glow                   | —          |

Cursor custom : `* { cursor: none }` **seulement** sous `(pointer: fine)`
et quand JS a monté le follower.

## 11. Mappings par domaine (exemples, pas des prisons)

Le domaine fournit le **contenu** et la **matière**. Le dialecte se
choisit ensuite. Si ça ne colle pas, D4 + REST.

| Domaine                    | Matière                | Dialecte           | Chapitres typiques                                  |
| -------------------------- | ---------------------- | ------------------ | --------------------------------------------------- |
| Legal / SaaS B2B (Ordalie) | Soie / papier          | **D1**             | Hero, 3–5 preuves, zoom, 3–5 morph, security, FAQ   |
| Cabinet / finance          | Papier, noir, or       | D1 ou D4           | Hero sobre, KPI scatter, morph process, REST tarifs |
| Architecture               | Béton, trait, lumière  | **D7 + H23** ou D4 | Scrub façade, pinned copy, grille D8                |
| Fashion / lookbook         | Tissu, peau            | **D6** ou D2       | 6 slides Observer, puis e-com REST                  |
| E-com produit              | Packshot               | **D7** + D8        | Scrub 360°, Flip coloris, REST specs                |
| Restaurant                 | Plat, nappe, vapeur    | D4 + H9            | Reveals, une vidéo service, menu REST               |
| Agence / studio            | Projets                | **D8 + D2**        | Grille Flip, un horizontal « selected »             |
| Éditorial / magazine       | Type                   | **D4** ou **D10**  | Split lines, clip images, ou type-as-matter         |
| Hardware / device          | Métal, verre           | D5 ou D7           | WebGL packshot + scrub explode, REST specs          |
| Santé / pharma             | Clair, organique       | D1 doux            | Scatter preuves, morph parcours, REST légal         |
| Musique / festival         | Line-up, light         | D2 + H16           | Horizontal artistes, marquees, REST billets         |
| Immobilier                 | Espace                 | D7 + D3            | Walkthrough, stack des lots, REST plans             |
| Fine dining                | 1 matière (nappe, vin) | D1                 | Hero, 3 preuves, morph 3 actes, REST menu           |
| Portfolio photo            | Image                  | D8 + H24           | Grille, scale-crop, grain, pas de WebGL             |
| Fintech app                | UI product             | D1                 | Morph = wells d’UI live, REST pricing               |
| NGO / impact               | Visage, chiffre        | D4 + H2            | Hero, scatter KPI, REST récits — **pas** de hijack  |
| Galerie / photo infinite   | Image                  | **D9**             | Boucle de cadres, CTA persistant                    |

Règle : **1 matière par site**. Si tu ne sais pas la nommer (soie,
béton, nappe, métal, papier, tissu, grain), tu n’es pas prêt à choisir
D1 ou D5.

### 11.1 Six briefs remplis (pour voir N changer)

Les YAML complets vivent aussi dans la skill
`.grok/skills/elite-motion/references/worked.md`. Ici, le **choix** :

| Brief                    | Dialecte                   | Matière | Refusé (piège Ordalie) |
| ------------------------ | -------------------------- | ------- | ---------------------- |
| Archi « Atelier Vale »   | D7 + D8                    | béton   | Scatter + morph        |
| Mode « Sika SS27 »       | D6                         | tissu   | Pin document long      |
| Resto « Ndjolé »         | D4                         | nappe   | Observer, morph, WebGL |
| Hardware « Kora »        | D5 + D7                    | métal   | Deux canvases, bloom   |
| Studio « North & Grain » | D8 + D2                    | grain   | Soie pinnée            |
| SaaS « Fieldnote »       | **D1**, scatter 5, morph 4 | papier  | Forcer N=3             |

Fieldnote prouve que D1 **scale** : `H_scatter = 140vh`, `H_morph = 400vh`.
Les wells sont de l’UI live, pas du stock video. Les 5 autres briefs
prouvent que D1 est **optionnel**.

## 12. Formules (N, hauteurs, fenêtres)

### 12.1 Runway cinématique

```
H_hero         = 100vh
H_scatter      = 100vh                          n ≤ 3
               = 100vh + (n - 3) * 20vh         n ∈ [4, 8]
H_morph        = nMorph * 100vh                 nMorph ∈ [2, 6]
H_stagger      = 80vh + n * 20vh                si H5
H_horizontal   = (railWidth / vw) * 100vh       D2
H_scrub        = 300vh                          D7 défaut (200–400)
H_stack        = n * 70vh                       D3
H_observer     = n * 100vh                      D6 (mais clock = index)
H_infinite     = n * 100vh + 100vh (seam)       D9
H_rest_i       = auto | 80–100vh
H_footer       = 80vh

H_cinematic    = somme des chapitres pinnés
cap            = 1200vh  (sinon tu as trop pinné)
```

Port B : une section `h-[H_cinematic]`, REST **après**.

### 12.2 Fenêtres Port B (p ∈ [0,1] sur le runway)

Poids = hauteur / H_cinematic. Découper `[0,1]`. Chevauchement
volontaire (CTA encore là quand scatter entre).

```
windowOpacity(p, in0, in1, out0, out1):
  if p < in0 or p > out1: 0
  if p > in1 and p < out0: 1
  if p < in1: smoothstep(in0, in1, p)
  else:        1 - smoothstep(out0, out1, p)
```

**`p < in0`, jamais `<=`.**

### 12.3 Staggers

```
hero words     0.04–0.08
scatter enter  min(0.15, 0.45 / n)
REST cards     0.08–0.12
Flip items     0.03
Split lines    0.06–0.1
```

Hold morph = 50 % de la fenêtre de la carte. In 25 / out 25.

## 13. Perf, mobile, accessibilité

### 13.1 Perf

- Un listener scroll, coalescé rAF (Port B) ; GSAP gère le sien.
- `will-change` **uniquement** sur le calque actif. Le retirer au hold.
- Images matière : `fetchpriority="high"` + preload hero ; macro `lazy`
  jusqu’à sa fenêtre.
- WebGL : pause quand `opacity: 0` ou `document.hidden`.
- Pas de `filter: blur()` CSS sur un calque qui scale. Blur **dans** le
  shader, ou une texture déjà soft.
- Le jank au doigt est le juge. 60 fps desktop, 30 fps mobile acceptable
  **si stable**.

### 13.2 Mobile (~390)

- Pas de D6 Observer.
- Pas de D2 / D9 horizontal (stack vertical).
- Pas de cursor / magnetic.
- WebGL : shader low ou still. Pas de GLTF.
- Scatter en colonne.
- Morph : même slot, `w-[min(92vw,520px)]`.
- Tap ≥ 44 px.
- Address bar iOS : resize → recalculer `p` / `ScrollTrigger.refresh()`.

### 13.3 A11y

```css
@media (prefers-reduced-motion: reduce) {
  .marquee,
  .grain {
    animation: none;
  }
  [data-animate] {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

- Focus visible sur tout CTA (le cursor custom ne le remplace pas).
- SplitText 2025+ (screen reader).
- Observer : bouton skip ; slides restent dans le DOM.
- Contraste des cartes glass **au hold** (solides).

## 14. QA — le produit **est** la timeline

Stills desktop 1280×800 + 3 mobile 390×844. Noms : `beat-<chapitre>-<état>`.
Mesurer `p` sur **la section pinnée**, jamais `document.body.scrollHeight`.

| Test           | Échec si                                                         |
| -------------- | ---------------------------------------------------------------- |
| Reverse        | Un calque reste à opacity 1 en remontant                         |
| Horloge unique | Lenis **et** `fixed` maison, ou Observer **et** pin long         |
| Budget         | 2 canvases + hijack + 4 pins, ou 3 dialectes                     |
| Overlap D1     | Scatter **sans** CTA encore visibles                             |
| Un slot        | Deux morph ≥ 0.6                                                 |
| Dialecte       | Un REST coincé dans le pin                                       |
| Inventé        | Morph/scatter présents alors que les tableaux YAML étaient vides |
| Mobile         | `scrollWidth > innerWidth + 1`, ou pin horizontal                |
| Motion         | Marquee / grain / cursor encore actifs en reduced-motion         |
| WebGL fail     | Écran noir au lieu du still                                      |
| Mix A/B        | Sticky unique **et** ScrollTrigger.pin sur les mêmes nœuds       |
| CTA transform  | `-translate-x-1/2` Tailwind **plus** un `transform` JS           |
| Flip           | Clone du nœud, l’original se vide                                |
| Lenis R2       | `lagSmoothing` encore à défaut, pins qui jitter                  |
| Wash           | Le pale ne revient pas au cream en reverse                       |

Beats minimaux : `beat-load`, `beat-hero`, `beat-rest-0`, `beat-footer`,
`beat-reverse-<last>`, `beat-reduced`, `beat-mobile-hero`.

## 15. YAML de brief (à remplir, puis coder)

```yaml
brand:
  name: ''
  domain: '' # legal, fashion, archi, resto, studio, hardware, …
  matter: '' # soie | papier | béton | tissu | métal | grain | nappe | …
  tokens: { bg: '', ink: '', accent: '', pale: '' }
  type: { display: '', body: '' }

clock: R1 # R1 | R2 | R3
engines: [E3, E0] # max 3
dialect:
  primary: D4 # D1–D10 — D4 si tu hésites
  secondary: null # ou D2, D8, D7…

hero:
  title: ''
  lede: ''
  ctas: [{ label: '', href: '', role: primary|secondary }]
  extras: [{ text: '', role: copy|cta|chrome }]
  partners: [] # 0–12, marquee

matter:
  hero: '' # still wide
  macro: '' # still close, même matière
  webgl: false # true → §8, mêmes stills en textures
  grain: true

scatter: [] # 2–8 { n, title, body, icon } ou []
morph: [] # 2–6 { title, lede, icon, inner } ou []
stagger: [] # 0–6
horizontal: [] # D2 panels
stack: [] # D3 cards
scrub: null # { frames: n | video: url, copy: [3-5] }
flip_grid: [] # D8 items
observer_slides: [] # D6, 4–8
infinite: [] # D9 frames
kinetic: null # D10 { word, font, video? }

rest: # 1–N, ordre métier
  - { id: faq, items: [] }
  - { id: pricing }
  - { id: team }

footer: { wordmark: '', links: [], social: [] }

cursor: false # desktop only si true
page_transition: fade # fade | curtain | circle
preloader: false
velocity_skew: false
reduced_motion: honor
```

Champs vides = primitive **absente** (pas un chapitre fantôme). Un resto
D4 a `scatter: []` et `morph: []` — et c’est **voulu**.

## 16. Mini-prompt prêt à coller

```
Réfère-toi strictement à ELITE-MOTION.md.

Marque / domaine / matière :
Sections (toutes, dans l’ordre métier) :
Références visuelles (optionnel) :

Exécute §4. Un dialecte primaire, un secondaire max.
Remplis le YAML §15 (N libre ; tableaux vides = chapitres absents).
Horloge §3 — R1 si calques fixed ; R2 seulement si tout le pin est GSAP ;
pas de Lenis sur du D1.
WebGL seulement si la matière le justifie (§8), avec still fallback.
QA §14 avant de dire que c’est fini.
Budget §1.4. REST illimité après les chapitres pinnés.
Ne force pas le 3+3 d’Ordalie.
```

## 17. Interdits (ne pas « améliorer »)

- Forcer D1 (3 scatter + 3 morph) sur un resto, un magazine, une grille
  de projets, un lookbook, un objet hardware.
- Remplir un YAML vide avec les chapitres du spécimen.
- Lenis + `position: fixed` maison.
- Deux horloges (Observer global + pin scrub ; ScrollControls + GSAP).
- Carousel / swipe à la place d’un morph ou d’un Flip.
- Elastic / bounce sur le scroll.
- Bloom + particles + hijack + custom cursor ensemble.
- WebGL sans fallback.
- `filter: blur` CSS sur un calque en `scale`.
- Animer `top` / `height`.
- Split caractères sur un paragraphe.
- Pin de la FAQ, du pricing, du footer.
- Glass permanente, blob violet, gradient hero « IA ».
- Trois familles typo, cinq accents.
- Mixer Port A et Port B.
- Cloner un nœud pour Flip.
- `animation-fill-mode: forwards` sur la timeline principale.
- Un canvas WebGL par section.
- Horizontal pin / infinite strip conservé tel quel sur mobile.
- Preloader de plus de 2.4 s.
- 3D text sur chaque titre.
- Lottie comme horloge.

## 18. Rapport à Ordalie, en une ligne

Ordalie = **D1 + R1 + E3 + 2 `<img>` + H21 circle-fill + marquee +
H22 pale REST**. Reprendre ce dialecte quand la matière et le récit
collent (SaaS B2B, papier, 2–8 preuves, 2–6 features one-at-a-time).
Sinon, garder **le niveau** (horloge, calques, rewind, budget, matière,
palette §2) et changer de dialecte.

`CINEMATIC-SCROLL.md` reste la **partition chiffrée** de D1 (beat sheet,
fenêtres, wells). Celui-ci est l’**orchestre** — et la palette pour
tous les autres sites.
