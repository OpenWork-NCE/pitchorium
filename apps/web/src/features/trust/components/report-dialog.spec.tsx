// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import ReportDialog from './report-dialog';

const api = vi.hoisted(() => ({ reasons: vi.fn(), report: vi.fn() }));
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  reportsControllerReasons: api.reasons,
  reportsControllerReport: api.report,
}));
vi.mock('@/features/access', () => ({
  useWithPrerequisites: () => (action: () => Promise<unknown>) => action(),
}));

// The Radix radio group measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const REASONS = ['spam', 'harassment', 'other'].map((code) => ({
  code,
  labelKey: `reportReasons.${code}`,
}));

afterEach(() => vi.clearAllMocks());

function open(type: 'post' | 'message' | 'profile', id = 'target-1') {
  api.reasons.mockResolvedValue({ items: REASONS });
  renderWithProviders(<ReportDialog target={{ type, id }} open onOpenChange={() => undefined} />);
}

describe('the dialog of a report', () => {
  it('names the target and offers the reasons the api lists, nothing else', async () => {
    open('post');
    expect(screen.getByRole('dialog', { name: 'Signaler cette publication' })).toBeTruthy();
    expect(await screen.findByRole('radio', { name: 'Spam' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Harcèlement' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Fraude ou arnaque' })).toBeNull();
    expect(screen.queryByText(/trois messages qui le précèdent/)).toBeNull();
  });

  it('says what a reported message sends to the moderation', async () => {
    open('message');
    expect(screen.getByRole('dialog', { name: 'Signaler ce message' })).toBeTruthy();
    await screen.findByRole('radio', { name: 'Spam' });
    expect(
      screen.getByText(/Seuls ce message et les trois messages qui le précèdent/),
    ).toBeTruthy();
  });

  it('sends the report of a profile by its handle, then acknowledges it', async () => {
    api.report.mockResolvedValue({});
    open('profile', 'kofi-mensah');
    fireEvent.click(await screen.findByRole('radio', { name: 'Harcèlement' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
      await Promise.resolve();
    });
    expect(await screen.findByRole('dialog', { name: 'Signalement reçu' })).toBeTruthy();
    expect(api.report).toHaveBeenCalledWith({
      targetType: 'profile',
      targetId: 'kofi-mensah',
      reason: 'harassment',
      details: null,
    });
  });
});
