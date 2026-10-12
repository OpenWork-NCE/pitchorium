import { describe, expect, it } from 'vitest';
import { resumeAddress, withoutResume } from './resume';

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
});
