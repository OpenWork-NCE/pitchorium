# 0082. Design system possédé sur Radix UI

Statut : acceptée (2026-10-08).

## Contexte

L'interface doit être accessible, cohérente avec la marque et maîtrisée dans le temps. Plusieurs bibliothèques de primitives (Radix UI, Headless UI, React Aria) se recouvrent ; en mélanger deux multiplie les comportements clavier, les dépendances et les styles.

## Décision

- Radix UI (`radix-ui` 1.7.0) est l'unique couche de primitives accessibles ; Headless UI et toute autre bibliothèque de primitives sont exclues.
- Le design system vit dans le dépôt (`apps/web/src/components/ui`), à la manière de shadcn : composants copiés, typés et adaptés aux tokens, sans dépendance boîte noire. Utilitaires : `class-variance-authority` (variantes), `clsx` et `tailwind-merge` (`cn`), `lucide-react` (icônes), `sonner` (toasts).
- `components/ui` ne connaît aucun métier : il n'importe ni feature, ni coquille, ni route (frontières, ADR 0089).
- Les menus Radix sont non modaux (`modal={false}`) tant que le verrouillage du défilement injecte un style sans nonce (ADR 0088).
- Ajoutées avec leur premier usage (PROMPT FRONT 1) : `cmdk` (palette de commandes, recherche globale), `vaul` (panneaux mobiles, si l'usage le justifie), `embla-carousel-react` (visionneuse de médias seulement, jamais de carrousel décoratif), `react-hook-form` et `@hookform/resolvers` (formulaires sur les schémas de `@pitchorium/contracts`). Les installer sans usage ferait échouer le contrôle de code mort (knip).

## Conséquences

- Chaque primitive a sa story Storybook avec l'addon d'accessibilité.
- Les mises à jour de Radix se font composant par composant, sans dépendre d'un générateur externe.
