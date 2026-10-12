import { franc } from 'franc';

/**
 * The languages of the contents Pitchorium addresses (§8.2), by their ISO 639-3 code in franc
 * mapped to ISO 639-1: French, English, Swahili, Wolof, Lingala. The full franc (187 languages)
 * is used on the server, where its weight does not count: franc-min has no Wolof (ADR 0169).
 */
const ISO_639_1: Readonly<Record<string, string>> = {
  eng: 'en',
  fra: 'fr',
  lin: 'ln',
  swh: 'sw',
  wol: 'wo',
};

/**
 * Language of a text (ISO 639-1) among those of the platform, by statistical detection
 * (trigrams) against every language franc knows; null when undetermined, for texts under 10
 * characters, and when another language comes first (German, Portuguese, Hausa, or a misread
 * identifier): restricted to the five, franc would name one of them for any text, and the
 * interface would offer a translation from a language the text is not in. Shared by the modules
 * that show user contents: the interface offers their translation only in another language than
 * its own (§8.3).
 */
export function detectLanguage(text: string | null | undefined): string | null {
  if (!text) return null;
  return ISO_639_1[franc(text, { minLength: 10 })] ?? null;
}
