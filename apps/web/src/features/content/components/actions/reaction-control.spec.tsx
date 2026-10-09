// @vitest-environment jsdom
import type { ReactionSummary } from '@pitchorium/contracts';
import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type * as Ui from '@/components/ui';
import { renderWithProviders } from '../../../../../test/support/render';
import { ReactionControl } from './reaction-control';

const notify = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/components/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  notify: { ...notify, success: vi.fn(), info: vi.fn(), undoable: vi.fn() },
}));

const initial: ReactionSummary = {
  counts: { like: 3, bravo: 0, insightful: 0, support: 0 },
  total: 3,
  viewerReaction: null,
};

function Harness({
  send,
}: {
  send: (next: ReactionSummary['viewerReaction']) => Promise<ReactionSummary>;
}) {
  const [summary, setSummary] = useState(initial);
  return (
    <>
      <ReactionControl summary={summary} onChange={setSummary} send={send} />
      <output data-testid="total">{summary.total}</output>
    </>
  );
}

describe('reaction to a publication', () => {
  it('shows the reaction at once, then the summary of the api', async () => {
    let answer: (summary: ReactionSummary) => void = () => undefined;
    const send = vi.fn(() => new Promise<ReactionSummary>((resolve) => (answer = resolve)));
    renderWithProviders(<Harness send={send} />);
    const like = screen.getByRole('button', { name: "J'aime" });
    fireEvent.click(like);
    // Before the api answers.
    expect(like.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('total').textContent).toBe('4');
    expect(send).toHaveBeenCalledWith('like');
    await act(async () => {
      answer({
        ...initial,
        counts: { ...initial.counts, like: 5 },
        total: 5,
        viewerReaction: 'like',
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('total').textContent).toBe('5');
  });

  it('comes back with the reason when the api refuses', async () => {
    const send = vi.fn(() => Promise.reject(new Error('refused')));
    renderWithProviders(<Harness send={send} />);
    const like = screen.getByRole('button', { name: "J'aime" });
    await act(async () => {
      fireEvent.click(like);
      await Promise.resolve();
    });
    expect(like.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('total').textContent).toBe('3');
    expect(notify.error).toHaveBeenCalled();
  });
});
