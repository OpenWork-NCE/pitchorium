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

/** GET /v1/locales: interface locales whose `locale.<code>` flag is on (§8.3, ADR 0077). */
export const activeLocalesSchema = z.object({
  defaultLocale: localeSchema,
  /** Never empty: the default locale is the last resort when every flag is off. */
  locales: z.array(localeSchema),
});

export const SIGN_IN_PROVIDERS = ['credential', 'google', 'linkedin', 'microsoft'] as const;
export const signInProviderSchema = z.enum(SIGN_IN_PROVIDERS);

/** OAuth providers, in the order of the sign-in buttons (§7.2). */
export const OAUTH_PROVIDERS = ['google', 'linkedin', 'microsoft'] as const;
export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

/** Minimum length of a password (§7, identity module). */
export const MIN_PASSWORD_LENGTH = 12;

/** Longest password accepted by /v1/auth. */
export const MAX_PASSWORD_LENGTH = 128;

/** Display name typed at sign-up (the profile keeps the same bound). */
export const ACCOUNT_NAME_MAX_LENGTH = 100;

const emailField = z.email().max(254);
const passwordField = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

/**
 * Inputs of the /v1/auth routes as the web app validates them before Better Auth validates them
 * again (sign-up, sign-in, links sent by email, new password, second factor).
 */
export const signUpRequestSchema = z.object({
  name: z.string().trim().min(1).max(ACCOUNT_NAME_MAX_LENGTH),
  email: emailField,
  password: passwordField,
});

export const signInRequestSchema = z.object({
  email: emailField,
  /** Any length: a refused password answers like an unknown account. */
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

export const emailRequestSchema = z.object({ email: emailField });

export const newPasswordRequestSchema = z.object({ newPassword: passwordField });

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: passwordField,
});

/** Code of an authenticator application (TOTP, six digits). */
export const totpCodeRequestSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

/** Backup code of the second factor, as Better Auth prints it. */
export const backupCodeRequestSchema = z.object({
  code: z.string().trim().min(6).max(32),
});

/** Password typed again to confirm a sensitive change (second factor). */
export const passwordConfirmationRequestSchema = z.object({
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});

/** How the web app shows Cloudflare Turnstile: only when an interaction is needed, or always. */
export const TURNSTILE_APPEARANCES = ['interaction-only', 'always'] as const;

/**
 * What the sign-in screens need to know before any session, without a secret (ADR 0103):
 * OAuth providers enabled, Turnstile site key when it is required, legal versions in force.
 */
export const authConfigurationSchema = z.object({
  oauthProviders: z.array(oauthProviderSchema),
  turnstile: z
    .object({ siteKey: z.string(), appearance: z.enum(TURNSTILE_APPEARANCES) })
    .nullable(),
  legal: legalVersionsSchema,
  minPasswordLength: z.number().int(),
});

export type LegalDocument = z.infer<typeof legalDocumentSchema>;
export type LegalVersions = z.infer<typeof legalVersionsSchema>;
export type LegalAcceptanceRequest = z.infer<typeof legalAcceptanceRequestSchema>;
export type LegalStatus = z.infer<typeof legalStatusSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
export type SignInProvider = z.infer<typeof signInProviderSchema>;
export type ActiveLocales = z.infer<typeof activeLocalesSchema>;
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type AuthConfiguration = z.infer<typeof authConfigurationSchema>;
