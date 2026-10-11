import type { ReactNode } from 'react';

/**
 * Contextual action bar of the page of a project on a phone (ADR 0132): fixed at the bottom of
 * the screen under `lg`, the progress summed up on one line, one main action (`data-bar-main`:
 * « Contribuer », or the interest when contributions are not open) and the bell to follow, an
 * icon button named by its label. Not a navigation bar: the member shell keeps none (ADR 0099).
 * Its height is fixed (`--action-bar-height`, globals.css), and the end of the document clears it:
 * it never covers the content.
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
      data-action-bar=""
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) h-(--action-bar-height) border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-md lg:hidden"
    >
      <div className="mx-auto grid max-w-3xl gap-2">
        <p className="truncate text-sm/5 font-medium tabular-nums">{summary}</p>
        {/* « Contribuer » present, the interest steps back: one main action. */}
        <div className="flex items-center gap-2 [&_[data-bar-main]]:min-w-0 [&_[data-bar-main]]:flex-1 [&:has([data-testid=contribute-bar])_[data-bar-interest]]:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
