// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import type { ModerationDecision, ModerationStanding } from '@pitchorium/contracts';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { ModerationSettings } from './moderation-settings';

const appeal = vi.hoisted(() => vi.fn());
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  standingControllerAppeal: appeal,
}));

const NOW = '2026-10-12T10:00:00.000Z';
const decision = (patch: Partial<ModerationDecision> = {}): ModerationDecision => ({
  id: '0192f4a0-8000-7000-8000-000000000201',
  caseId: '0192f4a0-8000-7000-8000-000000000101',
  targetType: 'post',
  targetId: '0192f4a0-8000-7000-8000-000000000002',
  kind: 'hide',
  reason: 'misleading_information',
  statement: 'Les rendements annoncés ne sont accompagnés d’aucune source.',
  ground: 'terms',
  groundReference: 'Conditions d’utilisation, informations exactes',
  automatedDetection: false,
  suspensionEndsAt: null,
  decidedAt: '2026-10-10T10:00:00.000Z',
  appealableUntil: '2027-04-10T10:00:00.000Z',
  appeal: null,
  ...patch,
});
const standing = (decisions: ModerationDecision[]): ModerationStanding => ({
  suspension: null,
  decisions,
});
const reports = { items: [], nextCursor: null };

afterEach(() => vi.clearAllMocks());

describe('the moderation of the member', () => {
  it('states the reasons of a decision and the ground with its reference', () => {
    renderWithProviders(
      <ModerationSettings standing={standing([decision()])} reports={reports} now={NOW} />,
    );
    expect(screen.getByRole('heading', { name: 'Masquage' })).toBeTruthy();
    expect(screen.getByText(/aucune source/)).toBeTruthy();
    expect(
      screen.getByText('Conditions d’utilisation : Conditions d’utilisation, informations exactes'),
    ).toBeTruthy();
  });

  it('shows the decisions of a suspended account without the reports the api does not list', () => {
    renderWithProviders(
      <ModerationSettings
        standing={{
          suspension: {
            id: '0192f4a0-8000-7000-8000-000000000301',
            userId: '0192f4a0-8000-7000-8000-000000000001',
            decisionId: decision().id,
            startsAt: '2026-10-10T10:00:00.000Z',
            endsAt: '2026-10-17T10:00:00.000Z',
            liftedAt: null,
          },
          decisions: [decision({ kind: 'suspend' })],
        }}
        reports={null}
        now={NOW}
      />,
    );
    expect(screen.getByText('Votre compte est suspendu')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Vos signalements' })).toBeNull();
  });

  it('sends one appeal per decision, then shows it in place of the form', async () => {
    appeal.mockResolvedValue({
      id: '0192f4a0-8000-7000-8000-000000000401',
      decisionId: decision().id,
      statement: 'Le bilan de la coopérative les source.',
      status: 'pending',
      outcomeStatement: null,
      createdAt: NOW,
      resolvedAt: null,
    });
    renderWithProviders(
      <ModerationSettings standing={standing([decision()])} reports={reports} now={NOW} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Faire appel' }));
    fireEvent.change(screen.getByLabelText('Vos arguments'), {
      target: { value: 'Le bilan de la coopérative les source.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’appel' }));
      await Promise.resolve();
    });
    expect(await screen.findByText(/Votre appel, envoyé le/)).toBeTruthy();
    expect(appeal).toHaveBeenCalledWith(decision().id, {
      statement: 'Le bilan de la coopérative les source.',
    });
    expect(screen.queryByRole('button', { name: 'Faire appel' })).toBeNull();
  });

  it('shows the final decision of an appeal, and no appeal past its date', () => {
    renderWithProviders(
      <ModerationSettings
        standing={standing([
          decision({
            appeal: {
              id: '0192f4a0-8000-7000-8000-000000000402',
              decisionId: decision().id,
              statement: 'Je conteste.',
              status: 'upheld',
              outcomeStatement: 'La décision est maintenue, faute de source.',
              createdAt: '2026-10-11T10:00:00.000Z',
              resolvedAt: '2026-10-11T18:00:00.000Z',
            },
          }),
          decision({
            id: '0192f4a0-8000-7000-8000-000000000203',
            kind: 'warn',
            appealableUntil: '2026-10-01T10:00:00.000Z',
          }),
        ])}
        reports={reports}
        now={NOW}
      />,
    );
    expect(screen.getByText('La décision est maintenue, faute de source.')).toBeTruthy();
    expect(screen.getByText('Décision maintenue')).toBeTruthy();
    expect(screen.getByText('Cette décision ne peut plus faire l’objet d’un appel.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Faire appel' })).toBeNull();
  });
});
