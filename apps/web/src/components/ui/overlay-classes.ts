/** Surfaces of the overlays (docs/design/direction.md: one elevation above the content). */
export const floatingSurface =
  'z-(--z-overlay) rounded-lg border border-border bg-surface-elevated text-foreground shadow-md outline-none';

/** Entrance of a floating surface: fade and scale from its origin (motion catalogue). */
export const floatingEnter =
  'data-[state=open]:animate-[menu-in_var(--duration-micro)_var(--ease-enter)]';

/** Backdrop of a modal surface. */
export const backdrop =
  'fixed inset-0 z-(--z-modal) bg-overlay data-[state=open]:animate-[fade-in_var(--duration-page)_var(--ease-enter)] data-[state=closed]:animate-[fade-out_var(--duration-micro)_var(--ease-enter)]';
