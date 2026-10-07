import type { VerificationStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export type VerificationStep = 'request' | 'approve' | 'reject' | 'revoke';

/**
 * Verification state machine:
 * unverified, rejected or revoked --request--> pending --approve--> verified --revoke--> revoked
 * pending --reject--> rejected.
 */
const TRANSITIONS: Readonly<
  Record<VerificationStep, Partial<Record<VerificationStatus, VerificationStatus>>>
> = {
  request: { unverified: 'pending', rejected: 'pending', revoked: 'pending' },
  approve: { pending: 'verified' },
  reject: { pending: 'rejected' },
  revoke: { verified: 'revoked' },
};

export function nextVerificationStatus(
  current: VerificationStatus,
  step: VerificationStep,
): VerificationStatus {
  const next = TRANSITIONS[step][current];
  if (!next) {
    throw new DomainError(
      'ORGANIZATIONS_VERIFICATION_INVALID_STATE',
      `Cannot ${step} a verification that is ${current}`,
    );
  }
  return next;
}

/** Criteria ticked by a reviewer must belong to the configured list. */
export function assertKnownCriteria(
  ticked: readonly string[],
  configured: readonly string[],
): void {
  const unknown = ticked.find((criterion) => !configured.includes(criterion));
  if (unknown) {
    throw new DomainError(
      'ORGANIZATIONS_VERIFICATION_CRITERION_UNKNOWN',
      `Unknown verification criterion ${unknown}`,
    );
  }
}

/** Host of a website without `www.`, null without a usable URL. */
export function websiteDomain(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  try {
    return new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * Non-decisive signal: the email domain is the website domain, or one is a subdomain of the
 * other (`fr.ngo.org` and `ngo.org`).
 */
export function emailOnDomain(email: string, domain: string | null): boolean {
  if (!domain) return false;
  const emailDomain = email.toLowerCase().split('@')[1];
  if (!emailDomain) return false;
  return (
    emailDomain === domain ||
    emailDomain.endsWith(`.${domain}`) ||
    domain.endsWith(`.${emailDomain}`)
  );
}
