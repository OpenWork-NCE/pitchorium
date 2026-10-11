// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileActionBar } from './mobile-action-bar';

describe('the action bar of a project page on a phone', () => {
  it('sums the progress up on one line, then one main action and the bell named by its label', () => {
    render(
      <MobileActionBar summary="62 % · 12 jours restants" label="Actions du projet">
        <button type="button" data-bar-main="">
          Contribuer
        </button>
        <button type="button" aria-label="Suivre Ferme solaire coopérative de Thiès">
          <svg aria-hidden />
        </button>
      </MobileActionBar>,
    );
    const bar = screen.getByRole('region', { name: 'Actions du projet' });
    expect(bar.hasAttribute('data-action-bar')).toBe(true);
    const summary = within(bar).getByText('62 % · 12 jours restants');
    expect(summary.classList.contains('truncate')).toBe(true);
    const [main, bell] = within(bar).getAllByRole('button');
    expect(main!.hasAttribute('data-bar-main')).toBe(true);
    expect(bell!.textContent).toBe('');
    expect(bell!.getAttribute('aria-label')).toBe('Suivre Ferme solaire coopérative de Thiès');
    // A fixed height, the one the end of the document clears (globals.css).
    expect(bar.className).toContain('h-(--action-bar-height)');
  });

  it('sticks to the bottom of the screen in the flow of the page: it never covers the content', () => {
    render(
      <MobileActionBar summary="56 %" label="Actions du projet">
        <button type="button" data-bar-main="">
          Contribuer
        </button>
      </MobileActionBar>,
    );
    const bar = screen.getByRole('region', { name: 'Actions du projet' });
    // Sticky, not fixed: it takes its own height in the page, which ends with it.
    expect(bar.className).toContain('sticky');
    expect(bar.className).not.toContain('fixed');
    // No rule of the whole document for it (a `body:has()` costs every change of the page).
    const css = readFileSync(join(import.meta.dirname, '../../../../styles/globals.css'), 'utf8');
    expect(css).not.toMatch(/body:has\(/);
  });
});
