import type { Locale } from '@pitchorium/contracts';
import { type CatalogTree, catalogs, localeManifest } from '@pitchorium/i18n';

/** Namespaces of `@pitchorium/i18n` the web app reads on the server. */
export const WEB_NAMESPACES = ['common', 'errors', 'reference', 'web'] as const;

/** Namespaces serialized to the browser; the others stay on the server until a feature needs them. */
export const CLIENT_NAMESPACES = ['common', 'web'] as const;

type WebNamespace = (typeof WEB_NAMESPACES)[number];
export type WebMessages = Record<WebNamespace, CatalogTree>;

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

export function clientMessages(
  messages: WebMessages,
): Pick<WebMessages, (typeof CLIENT_NAMESPACES)[number]> {
  return { common: messages.common, web: messages.web };
}
