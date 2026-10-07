import { DEFAULT_LOCALE, type Locale, LOCALES } from '@pitchorium/contracts';

interface WeightedTag {
  language: string;
  quality: number;
  position: number;
}

function parseAcceptLanguage(header: string): WeightedTag[] {
  return header
    .split(',')
    .map((part, position): WeightedTag | undefined => {
      const [tag, ...params] = part.trim().split(';');
      const language = tag?.trim().toLowerCase().split('-')[0];
      if (!language || language === '*') return undefined;
      const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return Number.isFinite(quality) && quality > 0 ? { language, quality, position } : undefined;
    })
    .filter((tag): tag is WeightedTag => tag !== undefined)
    .sort((a, b) => b.quality - a.quality || a.position - b.position);
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the preferred active locale from an Accept-Language header (RFC 9110), falling back to
 * the source locale, or to the first active one if the source locale were disabled.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  active: readonly Locale[],
): Locale {
  for (const { language } of parseAcceptLanguage(acceptLanguage ?? '')) {
    if (isLocale(language) && active.includes(language)) return language;
  }
  return active.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (active[0] ?? DEFAULT_LOCALE);
}
