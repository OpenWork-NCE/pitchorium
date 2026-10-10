import type { ReactNode } from 'react';

/**
 * Contextual action bar of the page of a project on a phone (ADR 0132): fixed at the bottom of
 * the screen under `lg`, the state of the funding and the actions of the page. Not a navigation
 * bar: the member shell keeps none (ADR 0099); this bar belongs to this page only, and leaves
 * once the funding block shows them in its column.
 */
export function MobileActionBar({
  summary,
  label,
  children,
}: {
  /** The state of the campaign in a few words (percent, days left or the final state). */
  summary: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-md lg:hidden"
    >
      <div className="mx-auto grid max-w-3xl gap-2">
        <p className="truncate text-sm font-medium tabular-nums">{summary}</p>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
