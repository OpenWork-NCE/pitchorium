/**
 * Paths of the web app, without the locale prefix: in English for every locale, never translated
 * (ADR 0092), so that only the prefix changes with the language. One export each, read through a
 * namespace (`import * as routes from '@/config/paths'`): a page only carries the paths it reads
 * (FRONT 7, A2). The segments of the member space and of the administration are in `routes.ts`.
 */
export const home = '/';
// Authentication (§7.2): one entry for every method, then the screens of each step.
export const signIn = '/sign-in';
export const signUp = '/sign-up';
/** Email step: a sign-in link by default, a password on request. */
export const magicLink = '/sign-in/email';
export const signInPassword = '/sign-in/password';
export const twoFactor = '/sign-in/two-factor';
export const checkEmail = '/check-email';
export const emailVerified = '/email-verified';
export const forgotPassword = '/forgot-password';
export const resetPassword = '/reset-password';
export const authError = '/auth/error';
/** Where every sign-in lands: the terms to accept first, then the requested page. */
const continueTo = '/continue';
// `continue` is a reserved word: exported under its name all the same.
export { continueTo as continue };
// Progressive onboarding (§7.2): terms, intention, minimum profile.
export const onboarding = '/onboarding';
export const onboardingTerms = '/onboarding/terms';
export const onboardingIntention = '/onboarding/intention';
export const onboardingProfile = '/onboarding/profile';
export const health = '/health';
// Member space (§6.1): the sections of the header.
export const feed = '/feed';
export const network = '/network';
/** Invitations to join an organisation or the team of a project, answered here (ADR 0149). */
export const invitations = '/network/invitations';
/** Who viewed the profile of the member (§10.2). */
export const profileViews = '/network/profile-views';
export const projects = '/projects';
/** The projects the member follows: a view of the showcase (the right column of a wide screen). */
export const followedProjects = '/projects?view=followed';
export const messages = '/messages';
/** A conversation, beside the list on a computer, on its own on a phone (§10.4). */
export const conversation = (id: string) => `/messages/${encodeURIComponent(id)}`;
/** The message requests received (first messages out of network). */
export const messageRequests = '/messages?filter=requests';
/** A first message to a member: the conversation once it exists (`?to=<handle>`). */
export const newMessage = (handle: string) => `/messages/new?to=${encodeURIComponent(handle)}`;
/** Introductions between three members (§10.4): received, proposed, and one of them. */
export const introductions = '/introductions';
export const introduction = (id: string) => `/introductions/${encodeURIComponent(id)}`;
export const notifications = '/notifications';
export const profile = '/profile';
export const settings = '/settings';
export const settingsAccount = '/settings/account';
export const settingsSecurity = '/settings/security';
export const settingsPreferences = '/settings/preferences';
export const settingsPrivacy = '/settings/privacy';
/** Who may write to the member, and the copy of unread messages by email (§10.4). */
export const settingsMessaging = '/settings/messaging';
/** The notifications of each type by channel, and the digests (§10.5). */
export const settingsNotifications = '/settings/notifications';
/** « Mes organisations »: the organisations of the member and their role. */
export const settingsOrganizations = '/settings/organizations';
/**
 * « Versement et vérification »: payout account and identity check of a holder (§9.5); also the
 * return address of a hosted onboarding the api gives the provider.
 */
export const settingsPayouts = '/settings/payouts';
// Pages of a resource, one address for visitors and members (ADR 0101), the showcase included.
export const project = (slug: string) => `/projects/${encodeURIComponent(slug)}`;
/** Creation of a project, step by step (`new` is a reserved slug, ADR 0131). */
export const createProject = '/projects/new';
/** A step of the creation or of the edition of a project (ADR 0131). */
export const projectEdit = (slug: string, step: string) =>
  `/projects/${encodeURIComponent(slug)}/edit/${encodeURIComponent(step)}`;
/** Management of a project by its team (§11.3). */
export const projectManage = (slug: string) => `/projects/${encodeURIComponent(slug)}/manage`;
/** The methodology of the self-declared impact in force (§12). */
export const impactMethodology = '/impact/methodology';
/** The self-declared impact of the entrepreneur facet of the member, and its history. */
export const profileImpact = '/profile/impact';
export const member = (handle: string) => `/members/${encodeURIComponent(handle)}`;
/** Network lists of a member (connections, followers, following), as their privacy allows. */
export const memberNetwork = (handle: string) => `/members/${encodeURIComponent(handle)}/network`;
export const organization = (slug: string) => `/organizations/${encodeURIComponent(slug)}`;
/** Management of an organisation by its owners and admins (§10.7). */
export const organizationManage = (slug: string) =>
  `/organizations/${encodeURIComponent(slug)}/manage`;
/** Guided creation of an organisation (`new` is a reserved slug). */
export const createOrganization = '/organizations/new';
/** An invitation to an organisation received by email (`/invitations/<token>`). */
export const invitation = (token: string) => `/invitations/${encodeURIComponent(token)}`;
export const event = (slug: string) => `/events/${encodeURIComponent(slug)}`;
/** The events, upcoming and past, public and indexable (§14). */
export const events = '/events';
/** Creation of an event (`new` is a reserved slug). */
export const createEvent = '/events/new';
/** Edition of an event by its organizers. */
export const eventEdit = (slug: string) => `/events/${encodeURIComponent(slug)}/edit`;
/** Expertise missions (§6.3, §14): offers and requests, voluntary skills sponsorship. */
export const missions = '/missions';
/** A mission, by its identifier (it has no slug). */
export const mission = (id: string) => `/missions/${encodeURIComponent(id)}`;
/** Creation of a mission: an offer (`?direction=offer`) or a request (`?direction=request`). */
export const createMission = '/missions/new';
/** The results of the global search (§10.6): query, kind and filters in the address. */
export const search = '/search';
/** « Découvrir » (§10.6): recent projects, ending soon, suggested profiles, events, missions. */
export const discover = '/discover';
/** A section of « Découvrir » on its own page, paginated. */
export const discoverSection = (section: string) => `/discover/${encodeURIComponent(section)}`;
/** The personal calendar feed of the member (ICS), in the settings. */
export const settingsCalendar = '/settings/calendar';
/** A publication (§10.3): public and indexable when it is public, a member view otherwise. */
export const post = (id: string) => `/posts/${encodeURIComponent(id)}`;
/** The publications the member saved. */
export const saved = '/saved';
/** The page of the link of an email that turns its notifications off (`?token=`), no session. */
export const unsubscribe = '/unsubscribe';
/**
 * Return from the hosted page of a payment provider (§9.3, ADR 0137), the address the api gives
 * the provider: `/contributions/<id>/return`.
 */
export const contributionReturn = (id: string) => `/contributions/${encodeURIComponent(id)}/return`;
/** A contribution of the member: the quote applied, its status, « pas un reçu fiscal ». */
export const contribution = (id: string) => `/contributions/${encodeURIComponent(id)}`;
/** The engagement dashboard of the member, or of an organisation (`?organization=<slug>`). */
export const dashboard = '/dashboard';
/** The shared time log: hours of mentoring and expertise, declared and received (§6.3). */
export const timeLog = '/dashboard/time';
// Contextual actions of the header, opened by their section (PROMPT FRONT 3 and 4).
export const compose = '/feed?compose=1';
// Administration (ADR 0078): `/admin/<domain>`.
export const admin = '/admin';
export const adminModeration = '/admin/moderation';
export const adminMembers = '/admin/members';
export const adminFlags = '/admin/flags';
