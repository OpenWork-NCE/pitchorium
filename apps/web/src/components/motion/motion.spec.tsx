// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { media } from '../../../test/support/setup';
import { AnimatedNumber } from './animated-number';
import { IconSwap } from './icon-swap';
import { Reveal } from './reveal';
import { DURATION_MS, EASE } from './tokens';

const format = (value: number) => `${value} €`;

/** IntersectionObserver that reports the element as visible at once. */
class VisibleObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
}

describe('AnimatedNumber', () => {
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('IntersectionObserver', VisibleObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => vi.unstubAllGlobals());

  function runFrames(at: number) {
    const pending = frames;
    frames = [];
    for (const frame of pending) frame(at);
  }

  it('shows the final value at once with reduced motion', () => {
    media.reducedMotion = true;
    render(<AnimatedNumber value={1250} format={format} />);
    const counter = screen.getByText('1250 €');
    expect(counter.dataset.ready).toBe('true');
    expect(frames).toHaveLength(0);
  });

  it('counts up with the formatter and the step, then lands on the value', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    render(<AnimatedNumber value={1250} format={format} step={10} />);
    expect(screen.getByText('0 €')).toBeTruthy();
    act(() => runFrames(DURATION_MS.counter / 4));
    const midway = Number(screen.getByText(/€$/).textContent?.replace(' €', ''));
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1250);
    expect(midway % 10).toBe(0);
    act(() => runFrames(DURATION_MS.counter));
    expect(screen.getByText('1250 €')).toBeTruthy();
    expect(frames).toHaveLength(0);
  });

  it('leaves no filter, shadow nor blur on the amount once counted (H17)', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    render(<AnimatedNumber value={1250} format={format} />);
    act(() => runFrames(DURATION_MS.counter));
    const counter = screen.getByText('1250 €');
    // Only its text changes while it counts: no style is ever written on it.
    expect(counter.getAttribute('style')).toBeNull();
    expect(['', 'none']).toContain(getComputedStyle(counter).filter);
  });
});

describe('IconSwap', () => {
  it('keeps every icon in one cell and shows the one of the state only', () => {
    const { container, rerender } = render(
      <IconSwap
        state="light"
        icons={{ light: <svg data-icon="sun" />, dark: <svg data-icon="moon" /> }}
      />,
    );
    const [sun, moon] = [...container.querySelectorAll('.icon-swap > span')];
    expect(sun?.hasAttribute('data-active')).toBe(true);
    expect(moon?.getAttribute('aria-hidden')).toBe('true');
    rerender(
      <IconSwap
        state="dark"
        icons={{ light: <svg data-icon="sun" />, dark: <svg data-icon="moon" /> }}
      />,
    );
    expect(sun?.hasAttribute('data-active')).toBe(false);
    expect(moon?.hasAttribute('data-active')).toBe(true);
    expect(moon?.getAttribute('aria-hidden')).toBe('false');
  });
});

describe('Reveal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves scroll-driven animations to CSS when the browser supports them', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').dataset.revealed).toBeUndefined();
  });

  it('reveals at once with reduced motion when CSS cannot', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    media.reducedMotion = true;
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').dataset.revealed).toBe('true');
  });

  it('reveals on intersection otherwise', () => {
    vi.stubGlobal('CSS', { supports: () => false });
    vi.stubGlobal('IntersectionObserver', VisibleObserver);
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content').dataset.revealed).toBe('true');
  });
});

describe('motion tokens', () => {
  const css = readFileSync(join(import.meta.dirname, '../../styles/tokens.css'), 'utf8');
  const variable = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

  it('gives CSS the same curves as Motion and GSAP', () => {
    for (const [name, curve] of Object.entries(EASE)) {
      expect(variable(`ease-${name}`)).toBe(`cubic-bezier(${curve.join(', ')})`);
    }
  });

  it('gives CSS the same durations', () => {
    for (const [name, milliseconds] of Object.entries(DURATION_MS)) {
      expect(variable(`duration-${name}`)).toBe(`${milliseconds}ms`);
    }
  });
});
