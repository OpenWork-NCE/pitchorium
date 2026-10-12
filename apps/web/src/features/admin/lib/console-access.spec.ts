import type { ConsoleCapabilities } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { consoleActionState } from './console-access';

const capabilities: ConsoleCapabilities = {
  roles: ['member', 'moderator'],
  reauthenticationMaxAgeMinutes: 15,
  actions: [
    { action: 'trust.moderation.decide', allowed: true, code: null, recentAuthentication: false },
    { action: 'payment.refund', allowed: false, code: 'FORBIDDEN', recentAuthentication: true },
    {
      action: 'admin.flags.manage',
      allowed: false,
      code: 'ACCESS_REAUTHENTICATION_REQUIRED',
      recentAuthentication: true,
    },
    {
      action: 'trust.appeal.resolve',
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
      recentAuthentication: false,
    },
  ],
};

describe('what the console offers (ADR 0172)', () => {
  it('offers what the api allows', () => {
    expect(consoleActionState(capabilities, 'trust.moderation.decide')).toMatchObject({
      visible: true,
      allowed: true,
      reauthenticate: false,
    });
  });

  it('hides what the role never gives, and anything the api did not list', () => {
    expect(consoleActionState(capabilities, 'payment.refund').visible).toBe(false);
    expect(consoleActionState(capabilities, 'admin.audit.export').visible).toBe(false);
    expect(consoleActionState(null, 'trust.moderation.read').visible).toBe(false);
  });

  it('disables with its reason what the reader may unlock', () => {
    expect(consoleActionState(capabilities, 'trust.appeal.resolve')).toMatchObject({
      visible: true,
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
    });
  });

  it('offers an action that asks for a new sign-in, which it then asks', () => {
    expect(consoleActionState(capabilities, 'admin.flags.manage')).toMatchObject({
      visible: true,
      allowed: true,
      reauthenticate: true,
      recentAuthentication: true,
    });
  });
});
