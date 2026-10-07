import type { Locale } from '@pitchorium/contracts';
import { type CatalogTree, catalogs, type Namespace } from './catalogs.js';
import manifest from './locales/manifest.json' with { type: 'json' };

export type TranslationParams = Record<string, string | number>;

function lookup(tree: CatalogTree, key: string): string | undefined {
  let node: string | CatalogTree | undefined = tree;
  for (const segment of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

/**
 * Falls back to the source locale when a key is missing, and to the key itself as a last resort
 * so that a missing translation is visible instead of silently empty.
 */
export function translate(
  locale: Locale,
  namespace: Namespace,
  key: string,
  params: TranslationParams = {},
): string {
  const fallback = manifest.fallbackLocale as Locale;
  const template =
    lookup(catalogs[locale][namespace], key) ?? lookup(catalogs[fallback][namespace], key) ?? key;
  return interpolate(template, params);
}
