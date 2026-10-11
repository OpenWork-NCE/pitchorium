/**
 * Legal pages of the public site (ADR 0157), each rendered from a Markdown file versioned in
 * `content/legal/<locale>/<slug>.md`. `version` names the legal version of the api it carries
 * (`terms`, `privacy`) or `none`; `status: pending` shows the block awaiting legal validation.
 */
export const LEGAL_DOCUMENTS = [
  'terms',
  'privacy',
  'legal-notice',
  'cookies',
  'reporting',
  'accessibility',
] as const;

export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export function isLegalDocument(value: string): value is LegalDocument {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}

/** The legal versions of the api (`GET /v1/legal-documents/current`). */
export interface LegalVersions {
  termsVersion: string;
  privacyVersion: string;
}

/**
 * Version shown on a legal page: the one in force in the api for the terms and the privacy
 * policy (what a member accepts at the onboarding), none for the other pages.
 */
export function versionShown(
  kind: string | undefined,
  versions: LegalVersions | null,
): string | null {
  if (!versions) return null;
  if (kind === 'terms') return versions.termsVersion;
  if (kind === 'privacy') return versions.privacyVersion;
  return null;
}
