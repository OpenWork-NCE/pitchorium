import { describe, expect, it } from 'vitest';
import { timeZoneOrDefault } from './time-zone';

describe('timeZoneOrDefault', () => {
  it('keeps a known IANA zone and falls back to UTC otherwise', () => {
    expect(timeZoneOrDefault('Africa/Lagos')).toBe('Africa/Lagos');
    expect(timeZoneOrDefault(' Europe/Paris ')).toBe('Europe/Paris');
    expect(timeZoneOrDefault('Mars/Olympus')).toBe('UTC');
    expect(timeZoneOrDefault(null)).toBe('UTC');
  });
});
