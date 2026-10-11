import { describe, expect, it } from 'vitest';
import { parseExactJson } from '../provider-http';
import { unitsPerEurFrom } from './flutterwave.provider';

const answer = (source: string, destination: string, currency = 'EUR') =>
  parseExactJson(
    `{"rate":0.000605877,"source":{"currency":"NGN","amount":${source}},"destination":{"currency":"${currency}","amount":${destination}}}`,
  );

/** Documented contract of `GET /v3/transfers/rates` (ADR 0160): source paid for 1 000 euros. */
describe('unitsPerEurFrom', () => {
  it('divides the source amount by the thousand euros asked for, exactly', () => {
    expect(unitsPerEurFrom(answer('1650500', '1000'))).toBe('1650.5');
    expect(unitsPerEurFrom(answer('1650512.37', '1000'))).toBe('1650.51237');
    expect(unitsPerEurFrom(answer('950.25', '1000'))).toBe('0.95025');
    expect(unitsPerEurFrom(answer('1000', '1000.00'))).toBe('1');
  });

  it('never reads the rate field, which goes the other way and is a float', () => {
    expect(unitsPerEurFrom(answer('1440240', '1000'))).not.toContain('0.0006');
  });

  it('refuses an answer for another destination or amount', () => {
    expect(() => unitsPerEurFrom(answer('1650500', '1'))).toThrow();
    expect(() => unitsPerEurFrom(answer('1650500', '1000', 'USD'))).toThrow();
    expect(() => unitsPerEurFrom(answer('0', '1000'))).toThrow();
    expect(() => unitsPerEurFrom(parseExactJson('{"rate":1650.5}'))).toThrow();
  });
});
