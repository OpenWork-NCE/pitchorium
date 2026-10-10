// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { duplicateTransitionNames, watchTransitionNames } from './check';

/** jsdom has no layout: every element gets a box, and the inline name is the computed one. */
function render(html: string) {
  document.body.innerHTML = html;
  for (const element of document.body.querySelectorAll('*')) {
    (element as HTMLElement).getClientRects = () =>
      (element as HTMLElement).hidden
        ? ([] as unknown as DOMRectList)
        : ([{}] as unknown as DOMRectList);
  }
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('duplicateTransitionNames', () => {
  it('finds a name carried twice, and only rendered elements', () => {
    render(`
      <img style="view-transition-name: vt-a">
      <img style="view-transition-name: vt-a">
      <img style="view-transition-name: vt-b">
      <img hidden style="view-transition-name: vt-b">
      <div style="view-transition-name: none"></div>
      <div style="view-transition-name: none"></div>`);
    expect(duplicateTransitionNames(document)).toEqual(['vt-a']);
  });

  it('accepts unique names', () => {
    render(`<img style="view-transition-name: vt-a"><img style="view-transition-name: vt-b">`);
    expect(duplicateTransitionNames(document)).toEqual([]);
  });
});

describe('watchTransitionNames', () => {
  it('reports a duplicate of the old and of the new state when a transition starts', async () => {
    type Update = () => void;
    const native = vi.fn((argument: Update | { update: Update }) => {
      const update = typeof argument === 'function' ? argument : argument.update;
      return { finished: Promise.resolve(update()) };
    });
    (Document.prototype as unknown as { startViewTransition: unknown }).startViewTransition =
      native;
    const report = vi.fn<(text: string) => void>();
    watchTransitionNames(report, duplicateTransitionNames);
    render(`<img style="view-transition-name: vt-a"><img style="view-transition-name: vt-a">`);
    const transition = document.startViewTransition(() => {
      render(`<img style="view-transition-name: vt-c"><p style="view-transition-name: vt-c"></p>`);
    });
    await transition.finished;
    expect(native).toHaveBeenCalledOnce();
    expect(report.mock.calls.map(([text]) => text)).toEqual([
      'view-transition-name used more than once (old state): vt-a',
      'view-transition-name used more than once (new state): vt-c',
    ]);
  });
});
