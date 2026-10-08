import type { Locale } from '@pitchorium/contracts';
import { type CatalogTree, catalogs, NAMESPACES } from './catalogs.js';

export interface CatalogCompleteness {
  /** Keys of the source locale (French). */
  total: number;
  /** `namespace:key` missing from the locale, or empty. */
  missing: string[];
  complete: boolean;
}

function flatten(tree: CatalogTree, prefix = ''): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') keys.set(`${prefix}${key}`, value);
    else for (const [nested, text] of flatten(value, `${prefix}${key}.`)) keys.set(nested, text);
  }
  return keys;
}

/**
 * Share of the French catalogue a locale translates: a locale is activated only when it is
 * complete and humanly reviewed (« une langue mal traduite vaut mieux absente », §4).
 */
export function catalogCompleteness(locale: Locale): CatalogCompleteness {
  const missing: string[] = [];
  let total = 0;
  for (const namespace of NAMESPACES) {
    const source = flatten(catalogs.fr[namespace]);
    const target = flatten(catalogs[locale][namespace]);
    total += source.size;
    for (const key of source.keys()) {
      if (!target.get(key)?.trim()) missing.push(`${namespace}:${key}`);
    }
  }
  return { total, missing, complete: missing.length === 0 };
}
