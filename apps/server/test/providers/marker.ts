/**
 * Metadata set on every object the provider tests create at Stripe or Flutterwave, so that
 * `pnpm providers:cleanup` removes them and nothing else.
 */
export const PROVIDER_TEST_MARKER = { key: 'pitchorium_test', value: 'provider-tests' } as const;

/** Value of the same key on the connected account kept for the Checkout test (never cleaned). */
export const CHECKOUT_ACCOUNT_MARKER_VALUE = 'checkout-account';
