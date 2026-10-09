import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './user-agent';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
      { device: 'computer', browser: 'Firefox', system: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      { device: 'computer', browser: 'Safari', system: 'macOS' },
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
      { device: 'phone', browser: 'Chrome', system: 'iOS' },
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      { device: 'computer', browser: 'Edge', system: 'Windows' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      { device: 'phone', browser: 'Chrome', system: 'Android' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      { device: 'tablet', browser: 'Chrome', system: 'Android' },
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      { device: 'tablet', browser: 'Safari', system: 'iOS' },
    ],
  ])('names %s', (userAgent, expected) => {
    expect(describeUserAgent(userAgent)).toEqual(expected);
  });

  it('leaves an unknown agent unnamed', () => {
    expect(describeUserAgent(null)).toEqual({ device: null, browser: null, system: null });
    expect(describeUserAgent('curl/8.0')).toEqual({ device: null, browser: null, system: null });
  });
});
