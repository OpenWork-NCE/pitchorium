import type { Page } from '@playwright/test';
import { overlappingTexts, repeatedTitles } from './layout-rules';

/**
 * Guard of the review captures (docs/design/review/README.md), run on every capture before it is
 * taken: nothing past the edges of the region, nothing cut by a container that hides its overflow,
 * one logo, nothing touching the border of a card, no text drawn over another text, no title
 * repeated in the same block, no chart without a number. Returns the problems found, empty when the screen is clean.
 */
export async function layoutProblems(page: Page, rootSelector: string): Promise<string[]> {
  const measured = await page.evaluate((selector) => {
    const root = document.querySelector(selector)!;
    const frame = root.getBoundingClientRect();
    const name = (element: Element) =>
      `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`;
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      // Text for screen readers only (1 px, clipped) is not on the screen.
      return (
        box.width > 1 &&
        box.height > 1 &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        style.clipPath !== 'inset(50%)' &&
        style.clip === 'auto'
      );
    };
    const clipped = (element: Element, until: Element) => {
      for (
        let parent = element.parentElement;
        parent && parent !== until;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return true;
      }
      return false;
    };
    const elements = [...root.querySelectorAll('*')].filter(visible);
    // Overlays (a dialog, a popover, a fixed bar) are layers above the page.
    const layers = new Map<Element, number>();
    const layerOf = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        // A fixed or sticky element, or a positioned one with its own background (the « voir
        // plus » of a truncated text, a header), is drawn above the page on purpose.
        const opaque =
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
        if (
          style.position === 'fixed' ||
          style.position === 'sticky' ||
          (style.position === 'absolute' && opaque) ||
          node.getAttribute('role') === 'dialog' ||
          node.getAttribute('role') === 'tooltip' ||
          node.hasAttribute('data-radix-popper-content-wrapper')
        ) {
          if (!layers.has(node)) layers.set(node, layers.size + 1);
          return layers.get(node)!;
        }
      }
      return 0;
    };
    // 1. Nothing goes past any of the four edges of the region, unless a container scrolls or
    // clips it (a wide table scrolls in its own frame).
    const outside = elements
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          layerOf(element) === 0 &&
          (box.left < frame.left - 0.5 ||
            box.top < frame.top - 0.5 ||
            box.right > frame.right + 0.5 ||
            box.bottom > frame.bottom + 0.5) &&
          !clipped(element, root)
        );
      })
      .map((element) => `edge: ${name(element)}`);
    // 1b. Nothing is cut by a container that hides its overflow without scrolling (a panel, a
    // card), except images cropped on purpose and texts truncated on purpose.
    const truncated = (element: Element) => {
      for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') return true;
      }
      return false;
    };
    const cut = elements
      .filter((element) => {
        if (
          ['IMG', 'VIDEO', 'svg', 'path', 'circle', 'g', 'rect', 'line'].includes(element.tagName)
        ) {
          return false;
        }
        const style = getComputedStyle(element);
        // Positioned or moved on purpose (the indicator of a progress bar slides in its track),
        // or truncated on purpose.
        if (style.position === 'absolute' || style.position === 'fixed') return false;
        if (style.transform !== 'none' || truncated(element)) return false;
        // A slide of a carousel out of view is hidden from everyone on purpose.
        if (element.closest('[aria-hidden="true"]')) return false;
        for (
          let parent = element.parentElement;
          parent && parent !== root;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') return false;
          if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
            const own = element.getBoundingClientRect();
            const frame = parent.getBoundingClientRect();
            return own.right > frame.right + 0.5 || own.left < frame.left - 0.5;
          }
        }
        return false;
      })
      .map((element) => `cut: ${name(element)}`);
    // 2. One logo per screen: the marks of the brand, and the backgrounds of the kit that carry
    // their own logotype (the discreet backgrounds).
    // A page captured whole has a logo in its header and one in its footer: two marks count
    // only when they are less than one screen apart.
    const marks = elements
      .filter((element) => element.hasAttribute('data-brand-mark'))
      .map((element) => element.getBoundingClientRect().top)
      .sort((a, b) => a - b);
    const marksTogether = marks.some(
      (top, index) => index > 0 && top - marks[index - 1]! < window.innerHeight,
    );
    const logoBackgrounds = [root, ...root.querySelectorAll('*')].filter((element) =>
      /-discreet\.svg/.test(getComputedStyle(element).backgroundImage),
    );
    const logos =
      marksTogether ||
      (marks.length > 0 && logoBackgrounds.length > 0) ||
      logoBackgrounds.length > 1
        ? [
            `logos: ${marks.length} mark(s), ${logoBackgrounds.length} background(s) with a logotype`,
          ]
        : [];
    // 3. Nothing in a card touches its border: at least 8 px of its padding stay free (all of it
    // when the padding is smaller, none for a card without padding).
    const touching = [...root.querySelectorAll('[data-card]')].flatMap((card) => {
      const box = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      const free = (padding: string) => Math.min(parseFloat(padding), 8);
      const inner = {
        left: box.left + parseFloat(style.borderLeftWidth) + free(style.paddingLeft),
        right: box.right - parseFloat(style.borderRightWidth) - free(style.paddingRight),
        top: box.top + parseFloat(style.borderTopWidth) + free(style.paddingTop),
        bottom: box.bottom - parseFloat(style.borderBottomWidth) - free(style.paddingBottom),
      };
      return [...card.querySelectorAll('*')]
        .filter(visible)
        .filter((element) => {
          if (clipped(element, card)) return false;
          const position = getComputedStyle(element).position;
          return position !== 'absolute' && position !== 'fixed';
        })
        .flatMap((element) => {
          const own = element.getBoundingClientRect();
          const sides = [
            ['left', own.left - inner.left],
            ['right', inner.right - own.right],
            ['top', own.top - inner.top],
            ['bottom', inner.bottom - own.bottom],
          ].filter(([, gap]) => (gap as number) < -0.5);
          return sides.length > 0
            ? [
                `card: ${name(element)} (${sides
                  .map(([side, gap]) => `${side} ${Math.round((gap as number) * 10) / 10}px`)
                  .join(', ')})`,
              ]
            : [];
        });
    });

    // 4. Text drawn over text: every line of every text node, with the overlay it sits in. A text
    // hidden on purpose does not count: transparent, clipped to nothing (the copy of the label of
    // a button under its fill), or under a layer that the page leaves behind.
    const hiddenText = (element: Element) => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.opacity === '0' || style.visibility === 'hidden') return true;
        if (style.clipPath !== 'none' && style.clipPath !== '') return true;
        if (style.clip !== 'auto') return true;
      }
      return false;
    };
    const owners = new Map<Element, number>();
    const fragments: {
      owner: number;
      layer: number;
      text: string;
      box: { left: number; top: number; right: number; bottom: number };
    }[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const content = text.textContent?.trim() ?? '';
      const owner = text.parentElement;
      if (!content || !owner || !visible(owner) || hiddenText(owner)) continue;
      if (!owners.has(owner)) owners.set(owner, owners.size);
      const range = document.createRange();
      range.selectNodeContents(text);
      // The part of a line that its boxes let show: a truncated or clamped text overflows them.
      const clips = [] as DOMRect[];
      for (
        let node: Element | null = owner;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          clips.push(node.getBoundingClientRect());
        }
      }
      for (const rect of range.getClientRects()) {
        const box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        for (const clip of clips) {
          box.left = Math.max(box.left, clip.left);
          box.top = Math.max(box.top, clip.top);
          box.right = Math.min(box.right, clip.right);
          box.bottom = Math.min(box.bottom, clip.bottom);
        }
        if (box.right - box.left < 1 || box.bottom - box.top < 1) continue;
        fragments.push({ owner: owners.get(owner)!, layer: layerOf(owner), text: content, box });
      }
    }

    // 5. Titles, in document order, with the block they belong to.
    const containers = new Map<Element, number>();
    const titles = [
      ...root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], figcaption, legend'),
    ]
      .filter((element) => visible(element) && !hiddenText(element))
      .map((element) => {
        const block =
          element.parentElement?.closest(
            '[data-card], section, figure, [role="dialog"], [role="region"], article, aside, form, main',
          ) ?? root;
        if (!containers.has(block)) containers.set(block, containers.size);
        return { text: element.textContent ?? '', container: containers.get(block)! };
      });
    // 6. A chart says its numbers: a figure drawn in SVG shows at least one figure in its text
    // (a graduation, a summary, a value), never bars alone.
    const mute = [...root.querySelectorAll('figure')]
      // A chart: bars (three rectangles at least) drawn in an SVG, not an icon.
      .filter((figure) => visible(figure) && figure.querySelectorAll('svg rect').length >= 3)
      .filter(
        (figure) =>
          !fragments.some(
            (fragment) =>
              /\d/.test(fragment.text) &&
              figure.contains(
                [...owners.entries()].find(([, index]) => index === fragment.owner)![0],
              ),
          ),
      )
      .map((figure) => `mute chart: ${figure.textContent?.trim().slice(0, 60) ?? ''}`);
    return { problems: [...outside, ...cut, ...logos, ...touching, ...mute], fragments, titles };
  }, rootSelector);
  return [
    ...measured.problems,
    ...overlappingTexts(measured.fragments),
    ...repeatedTitles(measured.titles),
  ];
}
