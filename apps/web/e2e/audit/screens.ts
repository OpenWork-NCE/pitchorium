/**
 * Every screen of the web app (PROMPT FRONT 9B, audits B1, B2 and B6): one address on the stub
 * api per page of `src/app/[locale]`, with the account that opens it. `screens.audit.ts` proves the
 * list complete against the files of the app.
 */
export const MEMBER = 'aissatou.ba@demo.pitchorium.test';
/** A new account: its terms not accepted, its email not verified (the onboarding). */
export const NEWCOMER = 'kofi.mensah@demo.pitchorium.test';
export const ADMIN = 'claudine.pierre.louis@demo.pitchorium.test';
export const MODERATOR = 'koffi.agbodjan@demo.pitchorium.test';
export const SUSPENDED = 'moussa.diop@demo.pitchorium.test';

const ADMIN_ID = (n: number) => `0192f4a0-9000-7000-8000-${String(n).padStart(12, '0')}`;
const CONVERSATION = (n: number) => `0192f4a0-6000-7000-8000-${String(n).padStart(12, '0')}`;
const INTRODUCTION = (n: number) => `0192f4a0-6200-7000-8000-${String(n).padStart(12, '0')}`;
const CONTRIBUTION = (n: number) => `0192f4a0-5000-7000-8000-${String(n).padStart(12, '0')}`;
const DISCOVERY = (n: number) => `0192f4a0-7000-7000-8000-${String(n).padStart(12, '0')}`;
const POST = (n: number) => `0192f4a0-2000-7000-8000-${String(n).padStart(12, '0')}`;

export interface Screen {
  /** Name of the captures. */
  id: string;
  /** Folder of the page under `src/app/[locale]`, route groups included. */
  route: string;
  /** Address without its locale. */
  path: string;
  /** Account of the session; null for a visitor. */
  as: string | null;
  /** The page answers 404 on purpose (a screen of the console refused, a page that does not exist). */
  notFound?: boolean;
}

export const SCREENS: Screen[] = [
  // The public site (PROMPT FRONT 8A).
  { id: 'home', route: '(marketing)', path: '', as: null },
  { id: 'how-it-works', route: '(marketing)/how-it-works', path: '/how-it-works', as: null },
  { id: 'transparency', route: '(marketing)/transparency', path: '/transparency', as: null },
  {
    id: 'methodology',
    route: '(marketing)/impact/methodology',
    path: '/impact/methodology',
    as: null,
  },
  { id: 'legal-terms', route: '(marketing)/legal/[document]', path: '/legal/terms', as: null },
  { id: 'not-found', route: '[...rest]', path: '/page-absente', as: null, notFound: true },
  { id: 'health', route: '(dev)/health', path: '/health', as: null, notFound: true },

  // Authentication and onboarding (ADR 0104).
  { id: 'sign-in', route: '(auth)/sign-in', path: '/sign-in', as: null },
  { id: 'sign-in-email', route: '(auth)/sign-in/email', path: '/sign-in/email', as: null },
  { id: 'sign-in-password', route: '(auth)/sign-in/password', path: '/sign-in/password', as: null },
  {
    id: 'sign-in-two-factor',
    route: '(auth)/sign-in/two-factor',
    path: '/sign-in/two-factor',
    as: null,
  },
  { id: 'sign-up', route: '(auth)/sign-up', path: '/sign-up', as: null },
  { id: 'forgot-password', route: '(auth)/forgot-password', path: '/forgot-password', as: null },
  {
    id: 'reset-password',
    route: '(auth)/reset-password',
    path: '/reset-password?token=stub-reset-token',
    as: null,
  },
  {
    id: 'check-email',
    route: '(auth)/check-email',
    path: '/check-email?email=aissatou.ba%40demo.pitchorium.test',
    as: null,
  },
  { id: 'email-verified', route: '(auth)/email-verified', path: '/email-verified', as: null },
  { id: 'auth-error', route: '(auth)/auth/error', path: '/auth/error?error=unknown', as: null },
  { id: 'continue', route: '(auth)/continue', path: '/continue', as: NEWCOMER },
  { id: 'onboarding', route: '(auth)/onboarding', path: '/onboarding', as: NEWCOMER },
  {
    id: 'onboarding-terms',
    route: '(auth)/onboarding/terms',
    path: '/onboarding/terms',
    as: NEWCOMER,
  },
  {
    id: 'onboarding-intention',
    route: '(auth)/onboarding/intention',
    path: '/onboarding/intention',
    as: MEMBER,
  },
  {
    id: 'onboarding-profile',
    route: '(auth)/onboarding/profile',
    path: '/onboarding/profile',
    as: MEMBER,
  },
  { id: 'report', route: '(auth)/report', path: '/report', as: null },
  {
    id: 'unsubscribe',
    route: '(auth)/unsubscribe',
    path: '/unsubscribe?token=stub-message-token-0001',
    as: null,
  },
  { id: 'account-deleted', route: '(auth)/account-deleted', path: '/account-deleted', as: null },

  // The member space.
  { id: 'feed', route: '(app)/feed', path: '/feed', as: MEMBER },
  { id: 'saved', route: '(app)/saved', path: '/saved', as: MEMBER },
  { id: 'profile', route: '(app)/profile', path: '/profile', as: MEMBER },
  { id: 'profile-impact', route: '(app)/profile/impact', path: '/profile/impact', as: MEMBER },
  { id: 'network', route: '(app)/network', path: '/network', as: MEMBER },
  {
    id: 'network-invitations',
    route: '(app)/network/invitations',
    path: '/network/invitations',
    as: MEMBER,
  },
  {
    id: 'network-profile-views',
    route: '(app)/network/profile-views',
    path: '/network/profile-views',
    as: MEMBER,
  },
  { id: 'messages', route: '(app)/messages', path: '/messages', as: MEMBER },
  {
    id: 'messages-thread',
    route: '(app)/messages/[conversationId]',
    path: `/messages/${CONVERSATION(1)}`,
    as: MEMBER,
  },
  {
    id: 'messages-new',
    route: '(app)/messages/new',
    path: '/messages/new?to=claudine-pierre-louis',
    as: MEMBER,
  },
  {
    id: 'messages-requests',
    route: '(app)/messages/requests',
    path: '/messages/requests',
    as: MEMBER,
  },
  { id: 'introductions', route: '(app)/introductions', path: '/introductions', as: MEMBER },
  {
    id: 'introduction',
    route: '(app)/introductions/[introductionId]',
    path: `/introductions/${INTRODUCTION(1)}`,
    as: MEMBER,
  },
  { id: 'notifications', route: '(app)/notifications', path: '/notifications', as: MEMBER },
  { id: 'dashboard', route: '(app)/dashboard', path: '/dashboard', as: MEMBER },
  { id: 'dashboard-time', route: '(app)/dashboard/time', path: '/dashboard/time', as: MEMBER },
  {
    id: 'contribution',
    route: '(app)/contributions/[contributionId]',
    path: `/contributions/${CONTRIBUTION(4)}`,
    as: MEMBER,
  },
  {
    id: 'contribution-return',
    route: '(app)/contributions/[contributionId]/return',
    path: `/contributions/${CONTRIBUTION(2)}/return`,
    as: MEMBER,
  },
  { id: 'settings', route: '(app)/settings', path: '/settings', as: MEMBER },
  {
    id: 'settings-account',
    route: '(app)/settings/account',
    path: '/settings/account',
    as: MEMBER,
  },
  {
    id: 'settings-security',
    route: '(app)/settings/security',
    path: '/settings/security',
    as: MEMBER,
  },
  {
    id: 'settings-privacy',
    route: '(app)/settings/privacy',
    path: '/settings/privacy',
    as: MEMBER,
  },
  {
    id: 'settings-preferences',
    route: '(app)/settings/preferences',
    path: '/settings/preferences',
    as: MEMBER,
  },
  {
    id: 'settings-organizations',
    route: '(app)/settings/organizations',
    path: '/settings/organizations',
    as: MEMBER,
  },
  {
    id: 'settings-payouts',
    route: '(app)/settings/payouts',
    path: '/settings/payouts',
    as: MEMBER,
  },
  {
    id: 'settings-messaging',
    route: '(app)/settings/messaging',
    path: '/settings/messaging',
    as: MEMBER,
  },
  {
    id: 'settings-notifications',
    route: '(app)/settings/notifications',
    path: '/settings/notifications',
    as: MEMBER,
  },
  {
    id: 'settings-calendar',
    route: '(app)/settings/calendar',
    path: '/settings/calendar',
    as: MEMBER,
  },
  {
    id: 'settings-moderation',
    route: '(app)/settings/moderation',
    path: '/settings/moderation',
    as: SUSPENDED,
  },
  {
    id: 'settings-personal-data',
    route: '(app)/settings/personal-data',
    path: '/settings/personal-data',
    as: MEMBER,
  },

  // One address per resource (ADR 0101): the visitor's view, then the member's.
  {
    id: 'member-visitor',
    route: '(public)/members/[handle]',
    path: '/members/aissatou-ba',
    as: null,
  },
  {
    id: 'member-member',
    route: '(public)/members/[handle]',
    path: '/members/kofi-mensah',
    as: MEMBER,
  },
  {
    id: 'member-network',
    route: '(public)/members/[handle]/network',
    path: '/members/aissatou-ba/network',
    as: MEMBER,
  },
  {
    id: 'organization-visitor',
    route: '(public)/organizations/[slug]',
    path: '/organizations/fondation-teranga',
    as: null,
  },
  {
    id: 'organization-member',
    route: '(public)/organizations/[slug]',
    path: '/organizations/fondation-teranga',
    as: MEMBER,
  },
  {
    id: 'organization-manage',
    route: '(public)/organizations/[slug]/manage',
    path: '/organizations/fondation-teranga/manage',
    as: MEMBER,
  },
  {
    id: 'organization-new',
    route: '(public)/organizations/new',
    path: '/organizations/new',
    as: MEMBER,
  },
  {
    id: 'invitation',
    route: '(public)/invitations/[token]',
    path: '/invitations/stub-invitation-token',
    as: MEMBER,
  },
  { id: 'post-visitor', route: '(public)/posts/[postId]', path: `/posts/${POST(4)}`, as: null },
  { id: 'post-member', route: '(public)/posts/[postId]', path: `/posts/${POST(1)}`, as: MEMBER },
  { id: 'showcase-visitor', route: '(public)/projects', path: '/projects', as: null },
  { id: 'showcase-member', route: '(public)/projects', path: '/projects', as: MEMBER },
  {
    id: 'project-visitor',
    route: '(public)/projects/[slug]',
    path: '/projects/ferme-solaire-thies',
    as: null,
  },
  {
    id: 'project-member',
    route: '(public)/projects/[slug]',
    path: '/projects/ferme-solaire-thies',
    as: MEMBER,
  },
  { id: 'project-new', route: '(public)/projects/new', path: '/projects/new', as: MEMBER },
  {
    id: 'project-edit',
    route: '(public)/projects/[slug]/edit',
    path: '/projects/projet-en-preparation/edit',
    as: MEMBER,
  },
  {
    id: 'project-edit-step',
    route: '(public)/projects/[slug]/edit/[step]',
    path: '/projects/projet-en-preparation/edit/funding',
    as: MEMBER,
  },
  {
    id: 'project-edit-preview',
    route: '(public)/projects/[slug]/edit/preview',
    path: '/projects/projet-en-preparation/edit/preview',
    as: MEMBER,
  },
  {
    id: 'project-manage',
    route: '(public)/projects/[slug]/manage',
    path: '/projects/ferme-solaire-thies/manage',
    as: MEMBER,
  },
  { id: 'search-visitor', route: '(public)/search', path: '/search?q=solaire', as: null },
  { id: 'search-member', route: '(public)/search', path: '/search?q=solaire', as: MEMBER },
  { id: 'discover-visitor', route: '(public)/discover', path: '/discover', as: null },
  { id: 'discover-member', route: '(public)/discover', path: '/discover', as: MEMBER },
  {
    id: 'discover-section',
    route: '(public)/discover/[section]',
    path: '/discover/recent_projects',
    as: MEMBER,
  },
  { id: 'events-visitor', route: '(public)/events', path: '/events', as: null },
  { id: 'events-member', route: '(public)/events', path: '/events', as: MEMBER },
  {
    id: 'event-visitor',
    route: '(public)/events/[slug]',
    path: '/events/webinaire-mecenat-diaspora',
    as: null,
  },
  {
    id: 'event-member',
    route: '(public)/events/[slug]',
    path: '/events/atelier-levee-de-fonds',
    as: MEMBER,
  },
  { id: 'event-new', route: '(public)/events/new', path: '/events/new', as: MEMBER },
  {
    id: 'event-edit',
    route: '(public)/events/[slug]/edit',
    path: '/events/webinaire-mecenat-diaspora/edit',
    as: MEMBER,
  },
  { id: 'missions-visitor', route: '(public)/missions', path: '/missions', as: null },
  { id: 'missions-member', route: '(public)/missions', path: '/missions', as: MEMBER },
  {
    id: 'mission',
    route: '(public)/missions/[id]',
    path: `/missions/${DISCOVERY(301)}`,
    as: MEMBER,
  },
  {
    id: 'mission-new',
    route: '(public)/missions/new',
    path: '/missions/new?direction=offer',
    as: MEMBER,
  },
  {
    id: 'mission-engagement',
    route: '(public)/missions/engagements/[engagementId]',
    path: `/missions/engagements/${DISCOVERY(602)}`,
    as: MEMBER,
  },

  // The console (PROMPT FRONT 9A).
  { id: 'admin', route: '(admin)/admin', path: '/admin', as: ADMIN },
  { id: 'admin-members', route: '(admin)/admin/members', path: '/admin/members?q=demo', as: ADMIN },
  {
    id: 'admin-member',
    route: '(admin)/admin/members/[userId]',
    path: `/admin/members/${ADMIN_ID(1)}`,
    as: ADMIN,
  },
  {
    id: 'admin-moderation',
    route: '(admin)/admin/moderation',
    path: '/admin/moderation',
    as: MODERATOR,
  },
  {
    id: 'admin-case',
    route: '(admin)/admin/moderation/cases/[caseId]',
    path: `/admin/moderation/cases/${ADMIN_ID(802)}`,
    as: MODERATOR,
  },
  {
    id: 'admin-appeals',
    route: '(admin)/admin/moderation/appeals',
    path: '/admin/moderation/appeals',
    as: MODERATOR,
  },
  {
    id: 'admin-transparency',
    route: '(admin)/admin/moderation/transparency',
    path: '/admin/moderation/transparency?from=2026-09-10&to=2026-10-09',
    as: ADMIN,
  },
  {
    id: 'admin-organizations',
    route: '(admin)/admin/organizations',
    path: '/admin/organizations',
    as: MODERATOR,
  },
  {
    id: 'admin-organization',
    route: '(admin)/admin/organizations/[requestId]',
    path: `/admin/organizations/${ADMIN_ID(601)}`,
    as: MODERATOR,
  },
  {
    id: 'admin-contributions',
    route: '(admin)/admin/payments/contributions',
    path: '/admin/payments/contributions',
    as: ADMIN,
  },
  {
    id: 'admin-contribution',
    route: '(admin)/admin/payments/contributions/[contributionId]',
    path: `/admin/payments/contributions/${ADMIN_ID(501)}`,
    as: ADMIN,
  },
  {
    id: 'admin-offline',
    route: '(admin)/admin/payments/offline',
    path: '/admin/payments/offline',
    as: ADMIN,
  },
  { id: 'admin-kyc', route: '(admin)/admin/payments/kyc', path: '/admin/payments/kyc', as: ADMIN },
  {
    id: 'admin-kyc-review',
    route: '(admin)/admin/payments/kyc/[submissionId]',
    path: `/admin/payments/kyc/${ADMIN_ID(101)}`,
    as: ADMIN,
  },
  {
    id: 'admin-discrepancies',
    route: '(admin)/admin/payments/discrepancies',
    path: '/admin/payments/discrepancies',
    as: ADMIN,
  },
  { id: 'admin-impact', route: '(admin)/admin/impact', path: '/admin/impact', as: ADMIN },
  {
    id: 'admin-methodology',
    route: '(admin)/admin/impact/[methodologyId]',
    path: `/admin/impact/${ADMIN_ID(401)}`,
    as: ADMIN,
  },
  { id: 'admin-flags', route: '(admin)/admin/flags', path: '/admin/flags', as: ADMIN },
  {
    id: 'admin-highlights',
    route: '(admin)/admin/highlights',
    path: '/admin/highlights',
    as: ADMIN,
  },
  { id: 'admin-jobs', route: '(admin)/admin/jobs', path: '/admin/jobs', as: ADMIN },
  { id: 'admin-audit', route: '(admin)/admin/audit', path: '/admin/audit', as: ADMIN },
  { id: 'admin-privacy', route: '(admin)/admin/privacy', path: '/admin/privacy', as: ADMIN },
];
