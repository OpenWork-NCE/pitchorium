import { describe, expect, it } from 'vitest';
import { parseRoleResume, resumeAddress, roleResumeKey, withoutResume } from './resume';

describe('resume after a new sign-in', () => {
  it('comes back to the same page with the action to open again', () => {
    expect(resumeAddress('/fr/admin/flags', '?q=locale', 'flag:locale.sw')).toBe(
      '/fr/admin/flags?q=locale&resume=flag%3Alocale.sw',
    );
  });

  it('forgets the action once it is open', () => {
    expect(withoutResume('/fr/admin/flags', '?q=locale&resume=flag%3Alocale.sw')).toBe(
      '/fr/admin/flags?q=locale',
    );
    expect(withoutResume('/fr/admin/flags', '?resume=x')).toBe('/fr/admin/flags');
  });

  it('comes back with the very role to grant or revoke, for this member only', () => {
    const key = roleResumeKey('u1', 'revoke', 'admin');
    expect(parseRoleResume(key, 'u1', ['moderator', 'admin'])).toEqual({
      intent: 'revoke',
      role: 'admin',
    });
    expect(parseRoleResume(key, 'u2', ['moderator', 'admin'])).toBeNull();
    expect(parseRoleResume('roles:u1:grant:owner', 'u1', ['moderator', 'admin'])).toBeNull();
    expect(parseRoleResume(null, 'u1', ['moderator'])).toBeNull();
  });
});
