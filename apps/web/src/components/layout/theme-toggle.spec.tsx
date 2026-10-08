// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/support/render';
import { media } from '../../../test/support/setup';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle', () => {
  const animate = vi.fn();
  let themeDuringTransition: string | undefined;

  beforeEach(() => {
    animate.mockReset();
    document.documentElement.animate = animate;
    Object.assign(document, {
      startViewTransition: (update: () => void) => {
        themeDuringTransition = document.documentElement.dataset.themeTransition;
        update();
        return { ready: Promise.resolve(), finished: Promise.resolve() };
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('grows the new theme as a circle from the button', async () => {
    renderWithProviders(<ThemeToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Passer au thème sombre' }));
    expect(themeDuringTransition).toBe('circle');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await waitFor(() => expect(animate).toHaveBeenCalledOnce());
    const [keyframes, options] = animate.mock.calls[0] as [
      { clipPath: string[] },
      KeyframeAnimationOptions,
    ];
    expect(keyframes.clipPath[0]).toMatch(/^circle\(0px at /);
    expect(options).toMatchObject({ pseudoElement: '::view-transition-new(root)' });
    expect(await screen.findByRole('button', { name: 'Passer au thème clair' })).toBeTruthy();
  });

  it('only fades with reduced motion', async () => {
    media.reducedMotion = true;
    renderWithProviders(<ThemeToggle />);
    fireEvent.click(await screen.findByRole('button', { name: 'Passer au thème sombre' }));
    expect(themeDuringTransition).toBe('fade');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await waitFor(() => expect(document.documentElement.dataset.themeTransition).toBeUndefined());
    expect(animate).not.toHaveBeenCalled();
  });
});
