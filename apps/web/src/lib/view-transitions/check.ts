/**
 * Duplicate names of view transitions in a document (ADR 0145). Each function is self-contained
 * (no import, no closure): the console guard of the end-to-end tests injects them as they are in
 * every page, and the development build installs them too.
 */

/** Names of view transitions carried by more than one rendered element of the document. */
export function duplicateTransitionNames(root: Document): string[] {
  const seen = new Map<string, number>();
  for (const element of root.querySelectorAll('*')) {
    // An element without a box (display: none) takes no part in a transition.
    if (element.getClientRects().length === 0) continue;
    const name = getComputedStyle(element).getPropertyValue('view-transition-name').trim();
    if (!name || name === 'none' || name === 'auto' || name === 'match-element') continue;
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([name]) => name);
}

/**
 * Checks the document when a view transition starts (the old state is captured right after) and
 * once its update has run (the new state), and reports the names carried twice: the browser would
 * abort the transition (« Duplicate view-transition-name value while capturing old state »).
 */
export function watchTransitionNames(
  report: (text: string) => void,
  scan: (root: Document) => string[],
): void {
  const prototype = Document.prototype as Partial<Document> & { transitionNamesWatched?: true };
  const start = prototype.startViewTransition;
  if (!start || prototype.transitionNamesWatched) return;
  prototype.transitionNamesWatched = true;
  const check = (root: Document, state: string) => {
    const duplicates = scan(root);
    if (duplicates.length > 0) {
      report(`view-transition-name used more than once (${state}): ${duplicates.join(', ')}`);
    }
  };
  prototype.startViewTransition = function (
    this: Document,
    argument?: Parameters<Document['startViewTransition']>[0],
  ) {
    check(this, 'old state');
    const update = typeof argument === 'function' ? argument : argument?.update;
    const checked = async () => {
      await update?.();
      check(this, 'new state');
    };
    return start.call(
      this,
      typeof argument === 'object' && argument !== null
        ? { ...argument, update: checked }
        : checked,
    );
  } as Document['startViewTransition'];
}
