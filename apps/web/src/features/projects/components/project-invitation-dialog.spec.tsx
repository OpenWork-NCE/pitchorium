// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { ProjectInvitation } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { ProjectInvitationDialog } from './project-invitation-dialog';

const accept = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
const push = vi.hoisted(() => vi.fn());
const invitations = vi.hoisted(() => ({ items: [] as ProjectInvitation[] }));
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  teamControllerAccept: accept,
  // The hook of the generated client calls its own function: replaced as a whole.
  useTeamControllerInvitations: () => ({ data: invitations, isPending: false, isSuccess: true }),
}));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const invitation = {
  project: { id: '0199a0b0-0000-7000-8000-00000000000a', slug: 'thies', title: 'Pompes de Thiès' },
  role: 'editor',
  function: null,
  invitedBy: { handle: 'aissatou-ba', displayName: 'Aïssatou Ba', headline: null, avatarUrl: null },
  invitedAt: '2026-10-10T10:00:00.000Z',
} as unknown as ProjectInvitation;

function open(slug: string) {
  return renderWithProviders(
    <QueryClientProvider client={new QueryClient()}>
      <ProjectInvitationDialog slug={slug} title="Pompes de Thiès" open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('invitation to a team, from its notification', () => {
  it('asks for the consent to the public display before joining, then joins with it', async () => {
    invitations.items = [invitation];
    open('thies');
    expect(await screen.findByRole('dialog', { name: /Rejoindre l['’]équipe de Pompes de Thiès/ }));
    const join = await screen.findByRole('button', { name: /Rejoindre l['’]équipe/ });
    fireEvent.click(join);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Cochez le consentement/);
    expect(accept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /affichés publiquement/ }));
    act(() => {
      fireEvent.click(join);
    });
    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(invitation.project.id, { publicDisplayConsent: true }),
    );
    expect(push).toHaveBeenCalledWith('/projects/thies');
  });

  it('says when the invitation no longer awaits an answer', async () => {
    invitations.items = [];
    open('thies');
    expect(await screen.findByText(/n’attend plus de réponse/)).toBeTruthy();
  });
});
