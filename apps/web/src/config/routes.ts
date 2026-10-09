/**
 * Paths of the web app, without the locale prefix: in English for every locale, never translated
 * (ADR 0092), so that only the prefix changes with the language. The member space and the
 * administration are listed by their first segment: the proxy only checks that a session cookie
 * is present there, the api remains the authority (ADR 0015). A test keeps these lists in line
 * with the folders of `(app)` and `(admin)`.
 */
export const routes = {
  home: '/',
  // Authentication (§7.2): one entry for every method, then the screens of each step.
  signIn: '/sign-in',
  signUp: '/sign-up',
  /** Email step: a sign-in link by default, a password on request. */
  magicLink: '/sign-in/email',
  signInPassword: '/sign-in/password',
  twoFactor: '/sign-in/two-factor',
  checkEmail: '/check-email',
  emailVerified: '/email-verified',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authError: '/auth/error',
  /** Where every sign-in lands: the terms to accept first, then the requested page. */
  continue: '/continue',
  // Progressive onboarding (§7.2): terms, intention, minimum profile.
  onboarding: '/onboarding',
  onboardingTerms: '/onboarding/terms',
  onboardingIntention: '/onboarding/intention',
  onboardingProfile: '/onboarding/profile',
  health: '/health',
  // Member space (§6.1): the sections of the header.
  feed: '/feed',
  network: '/network',
  projects: '/projects',
  /** The projects the member follows: a view of the showcase (the right column of a wide screen). */
  followedProjects: '/projects?view=followed',
  messages: '/messages',
  notifications: '/notifications',
  profile: '/profile',
  settings: '/settings',
  settingsAccount: '/settings/account',
  settingsSecurity: '/settings/security',
  settingsPreferences: '/settings/preferences',
  /** Decision and appeal of a moderated account (page of the PROMPT FRONT 8). */
  moderation: '/settings/moderation',
  // Pages of a resource, one address for visitors and members (ADR 0101), the showcase included.
  project: (slug: string) => `/projects/${encodeURIComponent(slug)}`,
  member: (handle: string) => `/members/${encodeURIComponent(handle)}`,
  organization: (slug: string) => `/organizations/${encodeURIComponent(slug)}`,
  event: (slug: string) => `/events/${encodeURIComponent(slug)}`,
  // Contextual actions of the header, opened by their section (PROMPT FRONT 3 and 4).
  compose: '/feed?compose=1',
  createProject: '/projects?create=1',
  // Administration (ADR 0078): `/admin/<domain>`.
  admin: '/admin',
  adminModeration: '/admin/moderation',
  adminMembers: '/admin/members',
  adminFlags: '/admin/flags',
} as const;

export const MEMBER_SEGMENTS = [
  'feed',
  'network',
  'messages',
  'notifications',
  'profile',
  'settings',
] as const;

export const ADMIN_SEGMENTS = ['admin'] as const;

/** Pages of the authentication group that need a session: the onboarding and its entry. */
export const SIGNED_IN_AUTH_SEGMENTS = ['onboarding', 'continue'] as const;

/** Name of the Better Auth session cookie, with the `__Secure-` prefix over HTTPS. */
export const SESSION_COOKIES = ['pitchorium.session_token', '__Secure-pitchorium.session_token'];

/** True when the path (without locale) belongs to the member space or the administration. */
export function requiresSession(pathname: string): boolean {
  const segment = pathname.split('/')[1] ?? '';
  return (
    (MEMBER_SEGMENTS as readonly string[]).includes(segment) ||
    (ADMIN_SEGMENTS as readonly string[]).includes(segment) ||
    (SIGNED_IN_AUTH_SEGMENTS as readonly string[]).includes(segment)
  );
}
