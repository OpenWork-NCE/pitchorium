import type { Locale } from '@pitchorium/contracts';
import { type CatalogTree, catalogs, localeManifest } from '@pitchorium/i18n';
import compile from 'icu-minify/compile';
import type { AbstractIntlMessages } from 'next-intl';

/** Namespaces of `@pitchorium/i18n` the web app reads on the server. */
export const WEB_NAMESPACES = [
  'common',
  'discovery',
  'errors',
  'notifications',
  'reference',
  'web',
] as const;

type WebNamespace = (typeof WEB_NAMESPACES)[number];

/** A message compiled ahead of time (icu-minify): a plain string stays a string. */
export type CompiledMessage = ReturnType<typeof compile>;
/** A tree of compiled messages, as next-intl reads them (ADR 0094). */
export type MessageTree = { [key: string]: CompiledMessage | MessageTree };
export type WebMessages = Record<WebNamespace, MessageTree>;

const isTree = (value: CompiledMessage | MessageTree | undefined): value is MessageTree =>
  typeof value === 'object' && !Array.isArray(value);

/** Messages of every document: the header, the theme, the languages and the error page. */
const DOCUMENT_MESSAGES = ['web.a11y', 'web.theme', 'web.locale', 'web.error'] as const;

/**
 * Messages serialized to the browser by each route group: what its client components read,
 * nothing more (the server components read every namespace). A path is a namespace or a subtree
 * (`web.home`); the bundle regime is in ADR 0094.
 */
/** Texts of the design system and of the forms (components/ui), for the interactive groups. */
const DESIGN_SYSTEM_MESSAGES = ['web.ui', 'web.forms'] as const;

/** Mandatory mentions (Notice, ImpactBadge) and the translated reasons the components show. */
const MENTIONS = [
  'web.notices',
  'common.machineTranslation',
  'reference.impactMentions',
  'reference.impactLevels',
] as const;

/** The feed (publications, suggestions with their reasons, completion of the profile). */
const FEED_MESSAGES = [
  'web.feed',
  'web.discovery',
  'web.content',
  'web.composer',
  'web.activity',
  'web.post',
  'web.saved',
  'reference.postVisibilities',
  'web.projects',
  'web.profile',
  'discovery',
  'reference.reactionTypes',
  'reference.profileElements',
  'reference.entrepreneurNeeds',
  'reference.contributorHats',
  'reference.sectors',
  'reference.sectorsShort',
  'reference.fundingInstruments',
  'reference.countries',
] as const;

export const CLIENT_MESSAGES = {
  document: DOCUMENT_MESSAGES,
  marketing: [...DOCUMENT_MESSAGES, 'web.home'],
  public: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    ...MENTIONS,
    // The lists of a member read by a visitor: their next pages and what may go wrong.
    'web.network.lists',
    // The publications of a page (activity, a public publication): their parts read in the
    // browser (images, document, cut text) and the next ones of an activity.
    'web.content',
    'web.activity',
    'reference.postVisibilities',
    'reference.reactionTypes',
    'errors.INTERNAL_ERROR',
    'errors.RATE_LIMITED',
    'errors.NETWORK_LIST_HIDDEN',
  ],
  auth: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    'errors',
    'web.auth',
    'web.onboarding',
    'reference.mediaRejectionReasons',
  ],
  member: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    ...MENTIONS,
    'web.nav',
    'web.counters',
    'web.banners',
    'web.search',
    'web.actions',
    'web.shortcuts',
    'web.access',
    'web.settings',
    'web.prerequisites',
    'web.onboarding.terms',
    'web.auth.failures',
    'web.locale.names',
    'errors',
    'reference.prerequisiteElements',
    'reference.mediaRejectionReasons',
    'reference.signInProviders',
    // Profiles, organisations and the network (PROMPT FRONT 3): relationships, editors, lists.
    'web.network',
    'web.organizations',
    'web.media',
    'reference.stages',
    'reference.structureTypes',
    'reference.patronageTypes',
    'reference.relationDegrees',
    'reference.profileStrengthLevels',
    'reference.intentions',
    'reference.visibilityLevels',
    'reference.organizationRoles',
    'reference.organizationInvitationStatuses',
    'reference.verificationStatuses',
    // The feed and the suggestions of every page: their texts, the reasons and their labels.
    ...FEED_MESSAGES,
  ],
  admin: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    'web.nav',
    'web.admin',
    'web.access',
    'errors',
    'reference.prerequisiteElements',
  ],
  dev: [...DOCUMENT_MESSAGES, 'web.health'],
} as const satisfies Record<string, readonly string[]>;

export type MessageScope = keyof typeof CLIENT_MESSAGES;

const PARAMETER = /\{\{(\w+)\}\}/g;

/** A rich tag of next-intl: an opening and its closing tag, `<link>texte</link>`. */
const RICH_TAG = /<([a-z][a-zA-Z0-9]*)>([\s\S]*?)<\/\1>/g;

/**
 * The shared catalogues write parameters `{{name}}` (server emails, Crowdin); next-intl reads ICU
 * messages. Literal ICU syntax characters are quoted, `{{name}}` becomes `{name}`, and a pair of
 * tags (`<link>...</link>`, for `t.rich`) stays a tag; a lone `<` stays a character.
 */
export function toIcu(text: string): string {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(RICH_TAG)) {
    result += parameters(text.slice(last, match.index));
    result += `<${match[1]}>${toIcu(match[2] ?? '')}</${match[1]}>`;
    last = match.index + match[0].length;
  }
  return result + parameters(text.slice(last));
}

function parameters(text: string): string {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(PARAMETER)) {
    result += quote(text.slice(last, match.index)) + `{${match[1]}}`;
    last = match.index + match[0].length;
  }
  return result + quote(text.slice(last));
}

function quote(literal: string): string {
  // A run of syntax characters is quoted at once: `'#''#'` would read as `#'#` (`''` is a quote).
  return literal.replace(/'/g, "''").replace(/[{}<>#|]+/g, (run) => `'${run}'`);
}

/**
 * ICU messages compiled once per locale (icu-minify, the format of next-intl's `precompile`):
 * `use-intl/format-message` resolves to its formatter of compiled messages (next.config.ts,
 * vitest.config.mts, .storybook/main.ts), and the parser of ICU messages leaves every page.
 */
function convert(tree: CatalogTree): MessageTree {
  return Object.fromEntries<CompiledMessage | MessageTree>(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? compile(toIcu(value)) : convert(value),
    ]),
  );
}

/** Keys missing from a locale fall back to the source locale, as `translate()` does. */
function withFallback(source: CatalogTree, target: CatalogTree): CatalogTree {
  return Object.fromEntries<string | CatalogTree>(
    Object.entries(source).map(([key, value]) => {
      const own = target[key];
      if (typeof value === 'string')
        return [key, typeof own === 'string' && own !== '' ? own : value];
      return [key, withFallback(value, typeof own === 'object' ? own : {})];
    }),
  );
}

const cache = new Map<Locale, WebMessages>();

export function messagesFor(locale: Locale): WebMessages {
  const cached = cache.get(locale);
  if (cached) return cached;
  const fallback = localeManifest.fallbackLocale as Locale;
  const messages = Object.fromEntries(
    WEB_NAMESPACES.map((namespace) => [
      namespace,
      convert(withFallback(catalogs[fallback][namespace], catalogs[locale][namespace])),
    ]),
  ) as WebMessages;
  cache.set(locale, messages);
  return messages;
}

/** Copy of the subtrees at `paths` (dotted), the rest left out; an unknown path is an error. */
export function pickMessages(messages: WebMessages, paths: readonly string[]): MessageTree {
  const picked: MessageTree = {};
  for (const path of paths) {
    const keys = path.split('.');
    let source: CompiledMessage | MessageTree = messages;
    let target = picked;
    keys.forEach((key, index) => {
      const next: CompiledMessage | MessageTree | undefined = isTree(source)
        ? source[key]
        : undefined;
      if (next === undefined) throw new Error(`Unknown message path: ${path}`);
      if (index === keys.length - 1) {
        target[key] = next;
      } else {
        const existing = target[key];
        target = target[key] = isTree(existing) ? existing : {};
      }
      source = next;
    });
  }
  return picked;
}

/**
 * Messages a route group sends to the browser (CLIENT_MESSAGES). next-intl types messages as
 * strings; compiled ones are what its formatter of compiled messages reads.
 */
export function clientMessages(locale: Locale, scope: MessageScope): AbstractIntlMessages {
  return pickMessages(messagesFor(locale), CLIENT_MESSAGES[scope]) as AbstractIntlMessages;
}
