# 0086. Mouvement

Statut : acceptée (2026-10-08).

## Contexte

La référence `docs/design/ELITE-MOTION.md` décrit un mouvement de niveau studio. Pitchorium est d'abord une webapp professionnelle, utilisée en 4G sur des téléphones modestes ; ses pages publiques éditoriales peuvent aller plus loin.

## Décision

- Espace membre : document natif et micro-interactions (horloge R1, défilement natif), sans pin, WebGL, curseur personnalisé, marquee, préchargeur, détournement de la molette ni défilement lissé (pas de Lenis).
- Pages publiques éditoriales : dialecte D4 (EDITORIAL_REVEAL) sans dialecte secondaire, moteurs E0 (transitions CSS), E1 (animations liées au défilement avec repli) et E3 (GSAP ScrollTrigger et SplitText, chargés à la demande).
- Motion 14 (`motion/react`, composants `m` sous `LazyMotion`) pour les micro-interactions de l'application ; GSAP 3.15 et `@gsap/react` réservés aux pages éditoriales, jamais dans les bundles de l'espace membre (règle ESLint et contrôle du build, ADR 0089 et 0090).
- Deux courbes (`enter`, `curtain`) et des durées partagées par le CSS, Motion et GSAP (`components/motion/tokens.ts`, égalité testée).
- Primitives livrées (`components/motion`) : pression, remplissage circulaire (H21), échange d'icône, nombre animé (H17), révélation au défilement (E1), indicateur partagé (`layoutId`), transition de page de niveau 1 (View Transitions, repli Motion), bascule de thème en cercle (H14) ; catalogue et YAML dans `docs/design/motion.md`.
- Moins de mouvement (`prefers-reduced-motion`, `prefers-reduced-data`, `Save-Data`) : chaque primitive montre son état final ; la bascule de thème devient un fondu. Seuls `transform`, `opacity`, `filter` et `clip-path` s'animent ; une révélation apparaît en fondu, et le contraste AA se vérifie au repos : les audits d'accessibilité s'exécutent en mouvement réduit (état final), ce qui supprime l'exception du socle, où la révélation se faisait sans fondu.

## Conséquences

- La matière nommée dans le YAML (le motif d'élévation des fonds de marque) reste à valider (question 94).
- Motion pesait environ 42 kB compressés au premier chargement du socle, fonctions de mise en page comprises ; l'ADR 0094 le sort du premier chargement : seul l'indicateur partagé l'utilise, chargé à l'inactivité de la page.
