// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { PrivacyOverview } from '@pitchorium/contracts';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { PersonalDataSettings } from './personal-data-settings';

const api = vi.hoisted(() => ({ erase: vi.fn(), overview: vi.fn() }));
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  privacyControllerRequestErasure: api.erase,
  privacyControllerOverview: api.overview,
}));
vi.mock('@/features/identity', () => ({ useSignOut: () => vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const overview = (patch: Partial<PrivacyOverview> = {}): PrivacyOverview => ({
  exports: [],
  nextExportAt: null,
  erasure: null,
  erasureBlockers: [],
  ...patch,
});

afterEach(() => vi.clearAllMocks());

describe('the deletion of the account', () => {
  it('lists each blocker with the action it asks for, and no deletion meanwhile', () => {
    renderWithProviders(
      <PersonalDataSettings
        initial={overview({
          erasureBlockers: [
            {
              code: 'PRIVACY_CAMPAIGN_IN_PROGRESS',
              resource: { type: 'project', slug: 'ferme-solaire-thies', name: 'Ferme solaire' },
            },
            {
              code: 'PRIVACY_SOLE_OWNER',
              resource: { type: 'organization', slug: 'fondation-teranga', name: 'Teranga' },
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/La campagne « Ferme solaire » est en financement/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voir la campagne' }).getAttribute('href')).toBe(
      '/projects/ferme-solaire-thies',
    );
    expect(screen.getByRole('link', { name: 'Gérer les membres' }).getAttribute('href')).toBe(
      '/organizations/fondation-teranga/manage?tab=members',
    );
    expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).toBeNull();
  });

  it('confirms only once the phrase is typed exactly', async () => {
    api.erase.mockResolvedValue({});
    api.overview.mockResolvedValue(overview());
    renderWithProviders(<PersonalDataSettings initial={overview()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    const confirm = await screen.findByRole('button', { name: 'Programmer la suppression' });
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
    const phrase = screen.getByRole('textbox');
    fireEvent.change(phrase, { target: { value: 'supprimer mon compt' } });
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(phrase, { target: { value: 'supprimer mon compte' } });
    // Without its reason, the button is drawn anew.
    const ready = screen.getByRole('button', { name: 'Programmer la suppression' });
    expect(ready.getAttribute('aria-disabled')).toBeNull();
    await act(async () => {
      fireEvent.click(ready);
      await Promise.resolve();
    });
    expect(api.erase).toHaveBeenCalledWith({ confirm: true });
  });

  it('shows the grace period and its reminder as the api gives them', () => {
    renderWithProviders(
      <PersonalDataSettings
        initial={overview({
          erasure: {
            id: '0192f4a0-8000-7000-8000-000000000601',
            status: 'scheduled',
            requestedAt: '2026-10-10T10:00:00.000Z',
            scheduledFor: '2099-11-09T10:00:00.000Z',
            canceledAt: null,
            completedAt: null,
            blockedBy: null,
            reminderAt: '2099-11-02T10:00:00.000Z',
          },
        })}
      />,
    );
    expect(screen.getByText('Suppression programmée le 9 novembre 2099')).toBeTruthy();
    expect(screen.getByText('Un rappel vous sera envoyé le 2 novembre 2099.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Annuler la suppression' })).toBeTruthy();
  });
});
