import type { LegalAcceptanceRequest, LegalDocument } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface LegalVersions {
  termsVersion: string;
  privacyVersion: string;
}

export interface LegalRecord {
  acceptedTermsVersion: string | null;
  acceptedPrivacyVersion: string | null;
  adultDeclaredAt: Date | null;
}

/** Recorded value of the age declaration: the minimum age that was declared. */
export const AGE_DECLARATION_VERSION = '18+';

/** Up to date when the versions in force are accepted and the age declaration exists. */
export function isLegalUpToDate(record: LegalRecord, current: LegalVersions): boolean {
  return (
    record.acceptedTermsVersion === current.termsVersion &&
    record.acceptedPrivacyVersion === current.privacyVersion &&
    record.adultDeclaredAt !== null
  );
}

/**
 * A client may only accept the versions in force: accepting a version displayed before an
 * update would record consent to a text the user has not seen.
 */
export function acceptedDocuments(
  request: LegalAcceptanceRequest,
  current: LegalVersions,
): { document: LegalDocument; version: string }[] {
  if (
    request.termsVersion !== current.termsVersion ||
    request.privacyVersion !== current.privacyVersion
  ) {
    throw new DomainError(
      'IDENTITY_LEGAL_VERSION_OUTDATED',
      'Accepted versions differ from the versions in force',
    );
  }
  return [
    { document: 'terms_of_service', version: current.termsVersion },
    { document: 'privacy_policy', version: current.privacyVersion },
    { document: 'age_declaration', version: AGE_DECLARATION_VERSION },
  ];
}
