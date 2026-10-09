// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { Relationship } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { RelationshipActions } from './relationship-actions';

const api = vi.hoisted(() => ({
  server: null as Relationship | null,
  follow: vi.fn<() => Promise<void>>(),
}));

vi.mock('@pitchorium/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof ApiClient>();
  return {
    ...original,
    followsControllerFollow: api.follow,
    // The relationship as the api holds it, read again once a change settles.
    useMemberNetworkControllerRelationship: (
      handle: string,
      options: { query: { initialData: Relationship; staleTime: number } },
    ) =>
      useQuery({
        queryKey: original.getMemberNetworkControllerRelationshipQueryKey(handle),
        queryFn: () => Promise.resolve(api.server ?? options.query.initialData),
        ...options.query,
      }),
  };
});

// The menu of the relationship navigates after a block: no router in a unit test.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const stranger: Relationship = {
  degree: 'second',
  mutualConnections: { count: 2, capped: false },
  connection: 'none',
  requestId: null,
  following: false,
  followedBy: false,
  blocked: false,
  counts: { followers: 10, connections: 4 },
};

function render(relationship: Relationship) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <RelationshipActions
        handle="kofi-mensah"
        name="Kofi Mensah"
        relationship={relationship}
        url="https://pitchorium.test/fr/members/kofi-mensah"
      />
    </QueryClientProvider>,
  );
}

const followButton = () => screen.getByRole('button', { name: /suivre Kofi Mensah/i });

describe('relationship actions (ADR 0112, 0113)', () => {
  beforeEach(() => {
    api.server = null;
    api.follow.mockReset();
  });

  it('shows the step of the connection the api gives', () => {
    const { unmount } = render(stranger);
    expect(screen.getByRole('button', { name: 'Se connecter avec Kofi Mensah' })).toBeTruthy();
    unmount();

    const pending = render({ ...stranger, connection: 'request_sent', requestId: 'r-1' });
    expect(screen.getByRole('button', { name: /Demande envoyée à Kofi Mensah/ })).toBeTruthy();
    pending.unmount();

    const connected = render({ ...stranger, degree: 'first', connection: 'connected' });
    expect(screen.getByRole('button', { name: /En relation avec Kofi Mensah/ })).toBeTruthy();
    connected.unmount();

    render({ ...stranger, connection: 'request_received', requestId: 'r-2' });
    expect(screen.getByRole('button', { name: 'Accepter la demande de Kofi Mensah' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ignorer la demande de Kofi Mensah' })).toBeTruthy();
  });

  it('shows a follow at once, before the api answers', async () => {
    let answer: () => void = () => undefined;
    api.follow.mockReturnValue(new Promise<void>((resolve) => (answer = resolve)));
    render(stranger);
    await act(async () => {
      fireEvent.click(followButton());
      // The optimistic state follows the cancellation of the reads in flight.
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(api.follow).toHaveBeenCalledOnce();
    expect(followButton().getAttribute('aria-pressed')).toBe('true');
    api.server = { ...stranger, following: true };
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(followButton().getAttribute('aria-pressed')).toBe('true');
  });

  it('puts the previous state back when the api refuses', async () => {
    api.follow.mockRejectedValue(new Error('unavailable'));
    render(stranger);
    await act(async () => {
      fireEvent.click(followButton());
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(followButton().getAttribute('aria-pressed')).toBe('false');
  });
});
