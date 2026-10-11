// @vitest-environment jsdom
import type { Notification } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { NotificationItem } from './notification-item';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const amina = {
  handle: 'amina-diallo',
  displayName: 'Amina Diallo',
  headline: null,
  avatarUrl: null,
};
const kofi = { handle: 'kofi-mensah', displayName: 'Kofi Mensah', headline: null, avatarUrl: null };

function notification(change: Partial<Notification>): Notification {
  return {
    id: '0199a0b0-0000-7000-8000-000000000001',
    type: 'reaction',
    priority: 'normal',
    actors: [amina, kofi],
    actorCount: 13,
    eventCount: 14,
    target: { type: 'post', key: 'p', path: '/posts/0199a0b0-0000-7000-8000-000000000002' },
    data: { reaction: 'bravo' },
    excerpt: 'Notre coopérative recrute.',
    read: false,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T11:00:00.000Z',
    ...change,
  };
}

function render(item: Notification, handlers: { onOpen?: () => void; onRemove?: () => void } = {}) {
  return renderWithProviders(
    <QueryClientProvider client={new QueryClient()}>
      <ul>
        <NotificationItem notification={item} {...handlers} />
      </ul>
    </QueryClientProvider>,
  );
}

describe('notification item', () => {
  it('says a group by its latest actor and the count of the others', () => {
    render(notification({}));
    expect(
      screen
        .getByRole('link', { name: /Amina Diallo et 12 autres ont réagi à votre publication/ })
        .getAttribute('href'),
    ).toBe('/posts/0199a0b0-0000-7000-8000-000000000002');
    expect(screen.getByText('« Notre coopérative recrute. »')).toBeTruthy();
  });

  it('says one actor alone, and the data of its event', () => {
    render(
      notification({
        type: 'project_team_invitation',
        actors: [kofi],
        actorCount: 1,
        eventCount: 1,
        excerpt: null,
        data: { title: 'Pompes solaires de Thiès', role: 'editor' },
        target: { type: 'project_invitations', key: 'thies', path: '/network/invitations' },
      }),
    );
    // An invitation to a team opens its acceptance dialog in place, not a page.
    const line = screen.getByRole('button', {
      name: /Kofi Mensah vous invite dans l['’]équipe de Pompes solaires/,
    });
    expect(line.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('is read when opened, removed on demand, and never links a page still to come', () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    render(notification({}), { onOpen, onRemove });
    fireEvent.click(screen.getByRole('link'));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la notification' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);

    render(
      notification({
        id: '0199a0b0-0000-7000-8000-000000000009',
        type: 'moderation_decision',
        actors: [],
        actorCount: 0,
        target: { type: 'moderation_decision', key: 'd', path: '/me/moderation/decisions/d' },
      }),
    );
    expect(screen.getByText(/décision/i).closest('a')).toBeNull();
  });

  it('answers an introduction from the notification', () => {
    render(
      notification({
        type: 'introduction_proposed',
        actors: [amina],
        actorCount: 1,
        target: {
          type: 'introduction',
          key: '0199a0b0-0000-7000-8000-000000000005',
          path: '/introductions/0199a0b0-0000-7000-8000-000000000005',
        },
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Accepter l’introduction de Amina Diallo' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Décliner l’introduction de Amina Diallo' }),
    ).toBeTruthy();
  });
});
