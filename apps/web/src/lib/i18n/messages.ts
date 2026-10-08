import type { Locale } from '@pitchorium/contracts';
import { type CatalogTree, catalogs, localeManifest } from '@pitchorium/i18n';

/** Namespaces of `@pitchorium/i18n` the web app reads on the server. */
export const WEB_NAMESPACES = ['common', 'errors', 'reference', 'web'] as const;

type WebNamespace = (typeof WEB_NAMESPACES)[number];
export type WebMessages = Record<WebNamespace, CatalogTree>;

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

export const CLIENT_MESSAGES = {
  document: DOCUMENT_MESSAGES,
  marketing: [...DOCUMENT_MESSAGES, 'web.home'],
  public: [...DOCUMENT_MESSAGES, ...DESIGN_SYSTEM_MESSAGES, ...MENTIONS],
  auth: [...DOCUMENT_MESSAGES, ...DESIGN_SYSTEM_MESSAGES, 'errors'],
  member: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    ...MENTIONS,
    'web.shell',
    'web.nav',
    'web.access',
    'errors',
    'reference.prerequisiteElements',
    'reference.mediaRejectionReasons',
  ],
  admin: [
    ...DOCUMENT_MESSAGES,
    ...DESIGN_SYSTEM_MESSAGES,
    'web.shell',
    'web.nav',
    'web.access',
    'errors',
    'reference.prerequisiteElements',
  ],
  dev: [...DOCUMENT_MESSAGES, 'web.health'],
} as const satisfies Record<string, readonly string[]>;

export type MessageScope = keyof typeof CLIENT_MESSAGES;

const PARAMETER = /\{\{(\w+)\}\}/g;

/**
 * The shared catalogues write parameters `{{name}}` (server emails, Crowdin); next-intl reads ICU
 * messages. Literal ICU syntax characters are quoted, then `{{name}}` becomes `{name}`.
 */
export function toIcu(text: string): string {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(PARAMETER)) {
    result += quote(text.slice(last, match.index)) + `{${match[1]}}`;
    last = match.index + match[0].length;
  }
  return result + quote(text.slice(last));
}

function quote(literal: string): string {
  return literal.replace(/'/g, "''").replace(/[{}<>#|]/g, (char) => `'${char}'`);
}

function convert(tree: CatalogTree): CatalogTree {
  return Object.fromEntries<string | CatalogTree>(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'string' ? toIcu(value) : convert(value),
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
export function pickMessages(messages: WebMessages, paths: readonly string[]): CatalogTree {
  const picked: CatalogTree = {};
  for (const path of paths) {
    const keys = path.split('.');
    let source: string | CatalogTree = messages;
    let target = picked;
    keys.forEach((key, index) => {
      const next: string | CatalogTree | undefined =
        typeof source === 'object' ? source[key] : undefined;
      if (next === undefined) throw new Error(`Unknown message path: ${path}`);
      if (index === keys.length - 1) {
        target[key] = next;
      } else {
        const existing = target[key];
        target = target[key] = typeof existing === 'object' ? existing : {};
      }
      source = next;
    });
  }
  return picked;
}

/** Messages a route group sends to the browser (CLIENT_MESSAGES). */
export function clientMessages(locale: Locale, scope: MessageScope): CatalogTree {
  return pickMessages(messagesFor(locale), CLIENT_MESSAGES[scope]);
}
