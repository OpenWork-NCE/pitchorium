// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { ReceivedInvitation } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { OrganizationInvitations } from './organization-invitations';

const accept = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
const decline = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const push = vi.hoisted(() => vi.fn());
const received = vi.hoisted(() => ({ items: [] as ReceivedInvitation[] }));
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  // The hook of the generated client calls its own function: replaced as a whole.
  useInvitationsControllerReceived: () => ({
    data: received,
    isPending: false,
    isError: false,
    isSuccess: true,
  }),
  invitationsControllerAcceptReceived: accept,
  invitationsControllerDeclineReceived: decline,
}));
vi.mock('@/features/access', () => ({
  useWithPrerequisites: () => (action: () => Promise<unknown>) => action(),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const teranga: ReceivedInvitation = {
  id: '0199a0b0-0000-7000-8000-0000000000b1',
  organization: {
    slug: 'fondation-teranga',
    name: 'Fondation Teranga',
    logoUrl: null,
    verified: true,
  },
  role: 'admin',
  expiresAt: '2026-10-20T10:00:00.000Z',
  createdAt: '2026-10-10T10:00:00.000Z',
};
const sahel: ReceivedInvitation = {
  ...teranga,
  id: '0199a0b0-0000-7000-8000-0000000000b2',
  organization: { slug: 'sahel', name: 'Réseau du Sahel', logoUrl: null, verified: false },
  role: 'member',
};

function render() {
  return renderWithProviders(
    <QueryClientProvider client={new QueryClient()}>
      <OrganizationInvitations />
    </QueryClientProvider>,
  );
}

describe('pending invitations to an organisation', () => {
  it('lists each one with its role and validity, accepted or declined without the email', async () => {
    received.items = [teranga, sahel];
    render();
    const cards = await screen.findAllByRole('heading', { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual(['Fondation Teranga', 'Réseau du Sahel']);
    expect(screen.getByText(/Invitation comme administrateur, valable jusqu’au 20 octobre 2026/i));
    const sahelCard = cards[1]!.closest('[data-invitation]') as HTMLElement;
    act(() => {
      fireEvent.click(within(sahelCard).getByRole('button', { name: 'Refuser' }));
    });
    await waitFor(() => expect(decline).toHaveBeenCalledWith(sahel.id));
    expect(within(sahelCard).getByRole('status').textContent).toMatch(/refusée/);
    const terangaCard = cards[0]!.closest('[data-invitation]') as HTMLElement;
    act(() => {
      fireEvent.click(within(terangaCard).getByRole('button', { name: 'Rejoindre' }));
    });
    await waitFor(() => expect(accept).toHaveBeenCalledWith(teranga.id));
    expect(push).toHaveBeenCalledWith('/organizations/fondation-teranga');
  });

  it('says that none waits', async () => {
    received.items = [];
    render();
    expect(await screen.findByText('Aucune invitation d’organisation')).toBeTruthy();
  });
});
