/**
 * Rules of the review guard that judge what a page measured (layout-guard.ts): pure functions on
 * boxes and texts, tested without a browser (test/review/layout-rules.spec.ts).
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A line of text on the screen: one client rect of a text node of an element. */
export interface TextFragment {
  /** Index of the element that owns the text node. */
  owner: number;
  /** Overlay the element sits in (a dialog, a popover), or 0 for the page. */
  layer: number;
  text: string;
  box: Box;
}

/** A visible title (h1 to h6, a heading role, a figure caption, a legend). */
export interface Title {
  text: string;
  /** Index of the nearest container (card, section, figure, dialog, main...). */
  container: number;
}

const overlap = (a: number, b: number, c: number, d: number) => Math.min(b, d) - Math.max(a, c);

/**
 * Texts of two elements drawn over each other in the same layer: more than 2 px across and more
 * than 40 % of the height of the smaller line, so that two lines of a tight leading that touch do
 * not count, and an overlay over the page (another layer) neither.
 */
export function overlappingTexts(fragments: readonly TextFragment[]): string[] {
  const problems = new Set<string>();
  for (let i = 0; i < fragments.length; i += 1) {
    const a = fragments[i]!;
    for (let j = i + 1; j < fragments.length; j += 1) {
      const b = fragments[j]!;
      if (a.owner === b.owner || a.layer !== b.layer) continue;
      const across = overlap(a.box.left, a.box.right, b.box.left, b.box.right);
      const down = overlap(a.box.top, a.box.bottom, b.box.top, b.box.bottom);
      const smaller = Math.min(a.box.bottom - a.box.top, b.box.bottom - b.box.top);
      if (across > 2 && down > smaller * 0.4) {
        problems.add(`overlap: « ${a.text.slice(0, 40)} » and « ${b.text.slice(0, 40)} »`);
      }
    }
  }
  return [...problems];
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Two identical titles one after the other in the same container (the title of a card and the
 * same caption of the chart in it): one title per block. Titles in document order.
 */
export function repeatedTitles(titles: readonly Title[]): string[] {
  const problems: string[] = [];
  for (let i = 1; i < titles.length; i += 1) {
    const previous = titles[i - 1]!;
    const current = titles[i]!;
    if (
      previous.container === current.container &&
      normalize(previous.text) !== '' &&
      normalize(previous.text) === normalize(current.text)
    ) {
      problems.push(`repeated title: « ${current.text.trim().slice(0, 60)} »`);
    }
  }
  return problems;
}
