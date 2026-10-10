import { flushSync } from 'react-dom';

/**
 * Name of a shared view transition (ADR 0145): derived from the resource and from its place on
 * the screen (`useId` of the component that shows it), so that a resource shown twice (a
 * publication and its repost) never carries the same name twice. A valid CSS identifier.
 */
export function transitionName(...parts: (string | number)[]): string {
  return `vt-${parts.join('-')}`.replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * A shared transition from `source` (a thumbnail) to the element the update shows (the viewer):
 * the name is put on the source just before the old state is captured, removed from it in the
 * update, and the new element carries it while `onSettled` has not run. Without the API, or with
 * less motion, the update runs alone. Returns false when no transition started.
 */
export function startSharedTransition({
  source,
  name,
  update,
  onSettled,
  reduced,
}: {
  source: HTMLElement | null;
  name: string;
  update: () => void;
  /** The transition is over (or skipped): the new element gives its name back. */
  onSettled: () => void;
  reduced: boolean;
}): boolean {
  if (!source || reduced || !('startViewTransition' in document)) {
    update();
    onSettled();
    return false;
  }
  source.style.viewTransitionName = name;
  const transition = document.startViewTransition(() => {
    source.style.viewTransitionName = '';
    flushSync(update);
  });
  // A skipped transition rejects its promises: nothing to report, the update has run.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .finally(() => {
      source.style.viewTransitionName = '';
      onSettled();
    });
  return true;
}
