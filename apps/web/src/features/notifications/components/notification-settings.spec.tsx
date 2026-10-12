// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { NotificationPreferences } from '@pitchorium/contracts';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { NotificationSettings } from './notification-settings';

const update = vi.hoisted(() => vi.fn());
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  notificationsControllerUpdatePreferences: update,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const preferences: NotificationPreferences = {
  emailDigest: 'daily',
  digestSchedule: { hour: 8, weeklyDay: 'monday', timeZone: 'Africa/Dakar' },
  types: [
    { type: 'reaction', transactional: false, channels: { in_app: true, email: false } },
    { type: 'connection_request', transactional: false, channels: { in_app: true, email: true } },
    { type: 'security_alert', transactional: true, channels: { in_app: true, email: true } },
  ],
};

describe('preferences of the notifications', () => {
  it('shows each type by channel in its section, a transactional one locked with the reason', () => {
    renderWithProviders(<NotificationSettings initial={preferences} />);
    const posts = screen.getByRole('table', { name: 'Publications' });
    const reactions = within(posts).getByRole('switch', { name: 'Réactions\u00a0: Email' });
    expect(reactions.getAttribute('aria-checked')).toBe('false');
    const security = screen.getByRole('switch', { name: 'Sécurité du compte\u00a0: Email' });
    expect(security.getAttribute('aria-checked')).toBe('true');
    expect((security as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Indispensable, toujours envoyée')).toBeTruthy();
  });

  it('says when the digests leave, in the time zone of the member', () => {
    renderWithProviders(<NotificationSettings initial={preferences} />);
    expect(screen.getByText('Un résumé chaque jour, à partir de 08:00.')).toBeTruthy();
    expect(screen.getByText('Un résumé chaque lundi, à partir de 08:00.')).toBeTruthy();
    expect(screen.getByText(/Africa\/Dakar/)).toBeTruthy();
  });

  it('applies a change at once and puts it back when the api refuses it', async () => {
    update.mockRejectedValueOnce(new Error('refused'));
    renderWithProviders(<NotificationSettings initial={preferences} />);
    const reactions = screen.getByRole('switch', { name: 'Réactions\u00a0: Email' });
    await act(async () => {
      fireEvent.click(reactions);
      await Promise.resolve();
    });
    expect(update).toHaveBeenCalledWith({
      changes: [{ type: 'reaction', channel: 'email', enabled: true }],
    });
    expect(reactions.getAttribute('aria-checked')).toBe('false');
  });
});
