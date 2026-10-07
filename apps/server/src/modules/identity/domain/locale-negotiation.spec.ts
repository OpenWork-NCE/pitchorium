import { describe, expect, it } from 'vitest';
import { negotiateLocale } from './locale-negotiation';

describe('negotiateLocale', () => {
  it.each([
    ['en-GB,en;q=0.9,fr;q=0.8', ['fr', 'en'], 'en'],
    ['fr-CA;q=0.5, en;q=0.7', ['fr', 'en'], 'en'],
    ['de-DE,de;q=0.9', ['fr', 'en'], 'fr'],
    ['sw-KE,sw;q=0.9,en;q=0.5', ['fr', 'en'], 'en'],
    ['sw;q=1,en;q=0.5', ['fr', 'en', 'sw'], 'sw'],
    ['en;q=0, fr', ['fr', 'en'], 'fr'],
    ['*', ['fr', 'en'], 'fr'],
    [null, ['fr', 'en'], 'fr'],
    ['en', ['en'], 'en'],
    ['de', ['en'], 'en'],
  ] as const)('%s with %j active gives %s', (header, active, expected) => {
    expect(negotiateLocale(header, active)).toBe(expected);
  });
});
