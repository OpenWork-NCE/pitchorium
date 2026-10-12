// @vitest-environment jsdom
import type { ContributionQuote } from '@pitchorium/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/support/render';
import { UnavailableMethods } from '../shared/unavailable-methods';
import { ReviewStep } from './review-step';

const eur = (amountMinor: string) => ({ amountMinor, currency: 'EUR' });

/** A quote whose figures are not 5 % of the amount: the page must show them as they are. */
const QUOTE: ContributionQuote = {
  kind: 'donation',
  amount: eur('4000'),
  eurEquivalent: eur('4000'),
  rate: { unitsPerEur: '1', source: 'identity', at: '2026-10-10T09:00:00.000Z' },
  commission: eur('777'),
  commissionRateBps: 500,
  commissionVersion: '2026-10',
  estimatedProviderFee: eur('123'),
  estimatedHolderAmount: eur('3100'),
  reward: null,
  methods: [],
};

const api = vi.hoisted(() => ({
  quote: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  contributionsControllerQuote: api.quote,
  contributionsControllerCreate: api.create,
}));

afterEach(() => vi.clearAllMocks());

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <ReviewStep
        projectId="0192f4a0-3000-7000-8000-666572736f6c"
        onStep={() => undefined}
        choices={{
          kind: 'donation',
          country: 'FR',
          currency: 'EUR',
          amountMinor: '4000',
          rewardId: null,
          organizationId: null,
          publicDisplay: false,
          anonymous: false,
          method: 'card',
        }}
      />
    </QueryClientProvider>,
  );
}

describe('the quote before the payment', () => {
  it('shows every amount the api gives, without computing any', async () => {
    api.quote.mockResolvedValue(QUOTE);
    renderReview();
    const summary = await screen.findByTestId('quote-summary', {}, { timeout: 3000 });
    // 7,77 € is not 5 % of 40 €: it is the api's, written as it is.
    expect(summary.textContent).toContain('7,77');
    expect(summary.textContent).toContain('1,23');
    expect(summary.textContent).toContain('31,00');
    expect(screen.getByTestId('payment-mentions').textContent).toContain('n’est pas un titre');
  });

  it('creates one contribution for two clicks, with one idempotency key', async () => {
    api.quote.mockResolvedValue(QUOTE);
    api.create.mockReturnValue(new Promise(() => undefined));
    renderReview();
    await screen.findByTestId('quote-summary', {}, { timeout: 3000 });
    const pay = screen.getByTestId('pay');
    fireEvent.click(pay);
    fireEvent.click(pay);
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    const [, , options] = api.create.mock.calls[0] as [
      string,
      unknown,
      { headers: Record<string, string> },
    ];
    const headers = options.headers;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('the methods a contributor cannot use', () => {
  it('says each reason, then what is accepted', () => {
    renderWithProviders(
      <UnavailableMethods
        notices={[
          { method: 'mobile_money', reason: 'contributor_country_not_covered' },
          { method: 'paypal', reason: 'not_covered_by_holder_rail' },
        ]}
        available={[{ method: 'card', operators: [] }]}
        country="France"
      />,
    );
    const text = screen.getByTestId('unavailable-methods').textContent;
    expect(text).toContain('Mobile Money n’est pas disponible depuis ce pays (France).');
    expect(text).toContain('PayPal n’est pas disponible pour ce projet.');
    expect(text).toContain('Accepté pour ce paiement\u00a0: carte bancaire.');
  });
});
