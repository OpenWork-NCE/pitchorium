import type { OrganizationRole, VerificationStatus } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import {
  assertCanLeave,
  assertRemoval,
  assertRoleChange,
  transferOwnership,
} from './membership-rules';
import { assertSlugAllowed, slugBaseFromName } from './organization';
import {
  assertKnownCriteria,
  emailOnDomain,
  nextVerificationStatus,
  type VerificationStep,
  websiteDomain,
} from './verification';

const codeOf = (work: () => unknown) => {
  try {
    work();
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
  return 'none';
};

describe('internal roles', () => {
  it('lets owners manage everyone and admins manage non-owners only', () => {
    const cases: [OrganizationRole, OrganizationRole, OrganizationRole, number, string][] = [
      ['owner', 'member', 'admin', 1, 'none'],
      ['owner', 'admin', 'owner', 1, 'none'],
      ['owner', 'owner', 'admin', 2, 'none'],
      ['admin', 'member', 'admin', 1, 'none'],
      ['admin', 'admin', 'member', 1, 'none'],
      ['admin', 'owner', 'admin', 2, 'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN'],
      ['admin', 'member', 'owner', 1, 'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN'],
      ['member', 'member', 'admin', 1, 'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN'],
    ];
    for (const [actor, target, next, owners, expected] of cases) {
      expect(
        codeOf(() => assertRoleChange(actor, target, next, owners)),
        `${actor} ${target}`,
      ).toBe(expected);
    }
  });

  it('never leaves an organization without an owner', () => {
    expect(codeOf(() => assertRoleChange('owner', 'owner', 'admin', 1))).toBe(
      'ORGANIZATIONS_LAST_OWNER',
    );
    expect(codeOf(() => assertRemoval('owner', 'owner', 1))).toBe('ORGANIZATIONS_LAST_OWNER');
    expect(codeOf(() => assertCanLeave('owner', 1))).toBe('ORGANIZATIONS_LAST_OWNER');
    expect(codeOf(() => assertCanLeave('owner', 2))).toBe('none');
    expect(codeOf(() => assertCanLeave('member', 1))).toBe('none');
    expect(codeOf(() => assertRemoval('admin', 'owner', 3))).toBe(
      'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN',
    );
    expect(codeOf(() => assertRemoval('admin', 'member', 1))).toBe('none');
  });

  it('transfers ownership from an owner to another member, who keeps the previous as admin', () => {
    expect(transferOwnership('owner', 'member', false)).toEqual({
      previousOwner: 'admin',
      newOwner: 'owner',
    });
    expect(codeOf(() => transferOwnership('admin', 'member', false))).toBe(
      'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN',
    );
    expect(codeOf(() => transferOwnership('owner', null, false))).toBe(
      'ORGANIZATIONS_MEMBER_NOT_FOUND',
    );
    expect(codeOf(() => transferOwnership('owner', 'owner', true))).toBe(
      'ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN',
    );
  });
});

describe('verification state machine', () => {
  const statuses: VerificationStatus[] = [
    'unverified',
    'pending',
    'verified',
    'rejected',
    'revoked',
  ];
  const allowed: Record<
    VerificationStep,
    Partial<Record<VerificationStatus, VerificationStatus>>
  > = {
    request: { unverified: 'pending', rejected: 'pending', revoked: 'pending' },
    approve: { pending: 'verified' },
    reject: { pending: 'rejected' },
    revoke: { verified: 'revoked' },
  };

  it.each(Object.keys(allowed) as VerificationStep[])('%s', (step) => {
    for (const status of statuses) {
      const expected = allowed[step][status];
      if (expected) expect(nextVerificationStatus(status, step)).toBe(expected);
      else {
        expect(
          codeOf(() => nextVerificationStatus(status, step)),
          status,
        ).toBe('ORGANIZATIONS_VERIFICATION_INVALID_STATE');
      }
    }
  });

  it('accepts only configured criteria', () => {
    expect(codeOf(() => assertKnownCriteria(['statutes'], ['statutes', 'website']))).toBe('none');
    expect(codeOf(() => assertKnownCriteria(['made_up'], ['statutes']))).toBe(
      'ORGANIZATIONS_VERIFICATION_CRITERION_UNKNOWN',
    );
  });

  it('signals a member email on the website domain, without deciding', () => {
    expect(websiteDomain('https://www.Teranga.org/about')).toBe('teranga.org');
    expect(websiteDomain(null)).toBeNull();
    expect(emailOnDomain('awa@teranga.org', 'teranga.org')).toBe(true);
    expect(emailOnDomain('awa@teranga.org', 'sn.teranga.org')).toBe(true);
    expect(emailOnDomain('awa@mail.teranga.org', 'teranga.org')).toBe(true);
    expect(emailOnDomain('awa@gmail.com', 'teranga.org')).toBe(false);
    expect(emailOnDomain('awa@notteranga.org', 'teranga.org')).toBe(false);
    expect(emailOnDomain('awa@teranga.org', null)).toBe(false);
  });
});

describe('organization slugs', () => {
  it('derives a slug from the name and refuses reserved ones', () => {
    expect(slugBaseFromName('Fondation Téranga pour l’Éducation')).toBe(
      'fondation-teranga-pour-l-education',
    );
    expect(slugBaseFromName('Admin')).toBe('organization-page');
    expect(codeOf(() => assertSlugAllowed('organizations'))).toBe('ORGANIZATIONS_SLUG_RESERVED');
    expect(codeOf(() => assertSlugAllowed('-bad-'))).toBe('VALIDATION_FAILED');
    expect(codeOf(() => assertSlugAllowed('teranga'))).toBe('none');
  });
});
