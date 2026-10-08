import { z } from 'zod';
import { localeSchema } from './locale.js';

/** Minimum age declared at sign-up. */
export const MINIMUM_AGE = 18;

export const LEGAL_DOCUMENTS = ['terms_of_service', 'privacy_policy', 'age_declaration'] as const;
export const legalDocumentSchema = z.enum(LEGAL_DOCUMENTS);

const legalVersionSchema = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);

/** Versions in force, provided by the configuration. */
export const legalVersionsSchema = z.object({
  termsVersion: z.string(),
  privacyVersion: z.string(),
  minimumAge: z.number().int(),
});

export const legalAcceptanceRequestSchema = z.object({
  termsVersion: legalVersionSchema,
  privacyVersion: legalVersionSchema,
  /** Declaration that the user is at least MINIMUM_AGE years old. */
  adultDeclaration: z.literal(true),
});

export const legalStatusSchema = z.object({
  /** True when the current terms and privacy policy are accepted and age is declared. */
  upToDate: z.boolean(),
  acceptedTermsVersion: z.string().nullable(),
  acceptedPrivacyVersion: z.string().nullable(),
  adultDeclaredAt: z.iso.datetime().nullable(),
  current: legalVersionsSchema,
});

/** True for an IANA time zone known to the runtime (`Europe/Paris`, `Africa/Lagos`, `UTC`). */
export function isTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_TIME_ZONE = 'UTC';

export const timeZoneSchema = z
  .string()
  .max(64)
  .refine(isTimeZone, { message: 'Unknown IANA time zone' });

export const preferencesSchema = z.object({
  locale: localeSchema,
  /** Time zone of the digests (ADR 0061); from the `X-Time-Zone` header at sign-up. */
  timeZone: timeZoneSchema,
});

/** PUT /v1/me/preferences: the time zone is kept when absent. */
export const updatePreferencesRequestSchema = z.object({
  locale: localeSchema,
  timeZone: timeZoneSchema.optional(),
});

export const SIGN_IN_PROVIDERS = ['credential', 'google', 'linkedin', 'microsoft'] as const;
export const signInProviderSchema = z.enum(SIGN_IN_PROVIDERS);

export type LegalDocument = z.infer<typeof legalDocumentSchema>;
export type LegalVersions = z.infer<typeof legalVersionsSchema>;
export type LegalAcceptanceRequest = z.infer<typeof legalAcceptanceRequestSchema>;
export type LegalStatus = z.infer<typeof legalStatusSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
export type SignInProvider = z.infer<typeof signInProviderSchema>;
