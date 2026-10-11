// @vitest-environment jsdom
import { ApiProblemError } from '@pitchorium/api-client';
import type * as ApiClient from '@pitchorium/api-client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { MissionForm } from './mission-form';

const offer = vi.hoisted(() => vi.fn());
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  missionsControllerOffer: offer,
  useProfilesControllerReferenceData: () => ({ data: { sectors: [], countries: [] } }),
  useProjectsControllerMine: () => ({ data: { items: [] } }),
}));
vi.mock('@/features/access', () => ({
  useWithPrerequisites: () => (action: () => Promise<unknown>) => action(),
  useCompletePrerequisites: () => null,
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

// The Radix radio group measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('form of a mission', () => {
  it('explains a refused vocabulary of a job offer under the description, in the summary', async () => {
    offer.mockRejectedValue(
      new ApiProblemError({
        type: 'about:blank',
        title: 'x',
        status: 422,
        code: 'MISSIONS_JOB_POSTING_REFUSED',
      }),
    );
    renderWithProviders(<MissionForm direction="offer" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Mentorat marketing' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Description/ }), {
      target: { value: 'Recrutement en CDI avec salaire.' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Champ d’expertise/ }), {
      target: { value: 'Marketing' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Heures estimées/ }), {
      target: { value: '4' },
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Publier la mission' }));
    });
    await waitFor(() => expect(offer).toHaveBeenCalled());
    const summary = await screen.findByRole('group', { name: 'Le formulaire contient 1 erreur.' });
    expect(summary.textContent).toMatch(/Une mission est bénévole/);
  });
});
